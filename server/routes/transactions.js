import { RequestHandler } from "express";
import pool from "../db/database.js";
import { createApiResponse, createApiError } from "../../shared/api.js";

// Get all transactions with filtering
export const getTransactions = async (req, res) => {
  try {
    const {
      storeId,
      type,
      dateRange = "all",
      startDate,
      endDate,
      search,
      limit = 100,
      offset = 0,
    } = req.query;

    let query = `
      SELECT 
        id,
        reference_number,
        transaction_type as type,
        product_id,
        product_name,
        category,
        quantity,
        unit_price,
        total_amount,
        store_id,
        store_name,
        transfer_to_store_id,
        transfer_to_store_name,
        user_id,
        user_name,
        notes,
        created_at as timestamp
      FROM inventory_transactions 
      WHERE 1=1
    `;

    const params = [];

    // Filter by store
    if (storeId && storeId !== "all") {
      query += " AND store_id = ?";
      params.push(storeId);
    }

    // Filter by transaction type
    if (type && type !== "all") {
      query += " AND transaction_type = ?";
      params.push(type);
    }

    // Filter by date range
    if (dateRange !== "all") {
      const now = new Date();
      let startDateTime;

      switch (dateRange) {
        case "today":
          startDateTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          break;
        case "week":
          startDateTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          startDateTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      if (startDateTime) {
        query += " AND created_at >= ?";
        params.push(startDateTime);
      }
    }

    // Custom date range
    if (startDate) {
      query += " AND created_at >= ?";
      params.push(new Date(startDate));
    }

    if (endDate) {
      query += " AND created_at <= ?";
      params.push(new Date(endDate));
    }

    // Search functionality
    if (search) {
      query += ` AND (
        product_name LIKE ? OR 
        product_id LIKE ? OR 
        reference_number LIKE ? OR 
        user_name LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Order and pagination
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.execute(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM inventory_transactions 
      WHERE 1=1
    `;

    const countParams = params.slice(0, -2); // Remove LIMIT and OFFSET params

    if (storeId && storeId !== "all") {
      countQuery += " AND store_id = ?";
    }
    if (type && type !== "all") {
      countQuery += " AND transaction_type = ?";
    }
    if (dateRange !== "all") {
      const now = new Date();
      let startDateTime;

      switch (dateRange) {
        case "today":
          startDateTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          break;
        case "week":
          startDateTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          startDateTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      if (startDateTime) {
        countQuery += " AND created_at >= ?";
      }
    }
    if (startDate) {
      countQuery += " AND created_at >= ?";
    }
    if (endDate) {
      countQuery += " AND created_at <= ?";
    }
    if (search) {
      countQuery += ` AND (
        product_name LIKE ? OR 
        product_id LIKE ? OR 
        reference_number LIKE ? OR 
        user_name LIKE ?
      )`;
    }

    const [countRows] = await pool.execute(countQuery, countParams);
    const total = countRows[0].total;

    res.status(200).json(
      createApiResponse(
        {
          transactions: rows,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + parseInt(limit) < total,
          },
        },
        "Transactions retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get transaction analytics/summary
export const getTransactionSummary = async (req, res) => {
  try {
    const { storeId, dateRange = "month" } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN transaction_type = 'Sale' THEN total_amount ELSE 0 END) as total_sales,
        COUNT(CASE WHEN transaction_type = 'Restock' THEN 1 END) as total_restocks,
        COUNT(CASE WHEN transaction_type = 'Transfer' THEN 1 END) as total_transfers,
        COUNT(CASE WHEN transaction_type = 'Adjustment' THEN 1 END) as total_adjustments
      FROM inventory_transactions 
      WHERE 1=1
    `;

    const params = [];

    // Filter by store
    if (storeId && storeId !== "all") {
      query += " AND store_id = ?";
      params.push(storeId);
    }

    // Filter by date range
    if (dateRange !== "all") {
      const now = new Date();
      let startDateTime;

      switch (dateRange) {
        case "today":
          startDateTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          break;
        case "week":
          startDateTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          startDateTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      if (startDateTime) {
        query += " AND created_at >= ?";
        params.push(startDateTime);
      }
    }

    const [rows] = await pool.execute(query, params);

    res
      .status(200)
      .json(
        createApiResponse(
          rows[0],
          "Transaction summary retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Get transaction summary error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Create a new transaction
export const createTransaction = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      type,
      productId,
      productName,
      category,
      quantity,
      unitPrice,
      storeId,
      storeName,
      transferToStoreId,
      transferToStoreName,
      userId,
      userName,
      notes,
    } = req.body;

    // Generate reference number
    const referencePrefix = type.toUpperCase().substring(0, 3);
    const timestamp = Date.now();
    const referenceNumber = `${referencePrefix}-2024-${timestamp}`;

    // Calculate total amount
    const totalAmount = quantity * unitPrice;

    // Insert transaction
    const [result] = await connection.execute(
      `
      INSERT INTO inventory_transactions 
      (reference_number, transaction_type, product_id, product_name, category, quantity, unit_price, total_amount, store_id, store_name, transfer_to_store_id, transfer_to_store_name, user_id, user_name, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        referenceNumber,
        type,
        productId,
        productName,
        category,
        quantity,
        unitPrice,
        totalAmount,
        storeId,
        storeName,
        transferToStoreId,
        transferToStoreName,
        userId,
        userName,
        notes,
      ],
    );

    // Update product inventory if product exists
    if (productId) {
      // Check if product exists
      const [productRows] = await connection.execute(
        "SELECT current_stock FROM products WHERE id = ? AND store_id = ?",
        [productId, storeId],
      );

      if (productRows.length > 0) {
        let stockChange = 0;

        switch (type) {
          case "Sale":
          case "Adjustment":
            stockChange = -Math.abs(quantity); // Negative for outbound
            break;
          case "Restock":
            stockChange = Math.abs(quantity); // Positive for inbound
            break;
          case "Transfer":
            // Reduce from source store, increase in destination store
            stockChange = -Math.abs(quantity);
            break;
        }

        // Update source store stock
        await connection.execute(
          "UPDATE products SET current_stock = current_stock + ? WHERE id = ? AND store_id = ?",
          [stockChange, productId, storeId],
        );

        // If transfer, update destination store stock
        if (type === "Transfer" && transferToStoreId) {
          await connection.execute(
            "UPDATE products SET current_stock = current_stock + ? WHERE id = ? AND store_id = ?",
            [Math.abs(quantity), productId, transferToStoreId],
          );
        }
      }
    }

    await connection.commit();

    // Get the created transaction
    const [newTransaction] = await connection.execute(
      `
      SELECT 
        id,
        reference_number,
        transaction_type as type,
        product_id,
        product_name,
        category,
        quantity,
        unit_price,
        total_amount,
        store_id,
        store_name,
        transfer_to_store_id,
        transfer_to_store_name,
        user_id,
        user_name,
        notes,
        created_at as timestamp
      FROM inventory_transactions 
      WHERE id = ?
    `,
      [result.insertId],
    );

    res
      .status(201)
      .json(
        createApiResponse(
          newTransaction[0],
          "Transaction created successfully",
        ),
      );
  } catch (error) {
    await connection.rollback();
    console.error("Create transaction error:", error);
    res.status(500).json(createApiError(error));
  } finally {
    connection.release();
  }
};

// Get stores (for dropdown)
export const getStores = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name, location FROM stores ORDER BY name",
    );

    res
      .status(200)
      .json(createApiResponse(rows, "Stores retrieved successfully"));
  } catch (error) {
    console.error("Get stores error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get products (for dropdown)
export const getProducts = async (req, res) => {
  try {
    const { storeId } = req.query;

    let query =
      "SELECT id, name, category, unit_price, current_stock FROM products";
    const params = [];

    if (storeId && storeId !== "all") {
      query += " WHERE store_id = ?";
      params.push(storeId);
    }

    query += " ORDER BY name";

    const [rows] = await pool.execute(query, params);

    res
      .status(200)
      .json(createApiResponse(rows, "Products retrieved successfully"));
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json(createApiError(error));
  }
};
