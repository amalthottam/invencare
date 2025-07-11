import { query } from "../db/sqlite.js";
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

    let sql = `
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
      sql += " AND store_id = ?";
      params.push(storeId);
    }

    // Filter by transaction type
    if (type && type !== "all") {
      sql += " AND transaction_type = ?";
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
        sql += " AND datetime(created_at) >= datetime(?)";
        params.push(startDateTime.toISOString());
      }
    }

    // Custom date range
    if (startDate) {
      sql += " AND datetime(created_at) >= datetime(?)";
      params.push(new Date(startDate).toISOString());
    }

    if (endDate) {
      sql += " AND datetime(created_at) <= datetime(?)";
      params.push(new Date(endDate).toISOString());
    }

    // Search functionality
    if (search) {
      sql += ` AND (
        product_name LIKE ? OR 
        product_id LIKE ? OR 
        reference_number LIKE ? OR 
        user_name LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Order and pagination
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await query(sql, params);

    // Get total count for pagination - simplified count query
    let countSql = `SELECT COUNT(*) as total FROM inventory_transactions WHERE 1=1`;
    const countParams = [];

    if (storeId && storeId !== "all") {
      countSql += " AND store_id = ?";
      countParams.push(storeId);
    }
    if (type && type !== "all") {
      countSql += " AND transaction_type = ?";
      countParams.push(type);
    }
    if (search) {
      countSql += ` AND (
        product_name LIKE ? OR 
        product_id LIKE ? OR 
        reference_number LIKE ? OR 
        user_name LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
      );
    }

    const [countRows] = await query(countSql, countParams);
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

    let sql = `
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
      sql += " AND store_id = ?";
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
        sql += " AND datetime(created_at) >= datetime(?)";
        params.push(startDateTime.toISOString());
      }
    }

    const [rows] = await query(sql, params);

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
  try {
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
    const [result] = await query(
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
      const [productRows] = await query(
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
        await query(
          "UPDATE products SET current_stock = current_stock + ? WHERE id = ? AND store_id = ?",
          [stockChange, productId, storeId],
        );

        // If transfer, update destination store stock
        if (type === "Transfer" && transferToStoreId) {
          await query(
            "UPDATE products SET current_stock = current_stock + ? WHERE id = ? AND store_id = ?",
            [Math.abs(quantity), productId, transferToStoreId],
          );
        }
      }
    }

    // Get the created transaction
    const [newTransaction] = await query(
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
    console.error("Create transaction error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get stores (for dropdown)
export const getStores = async (req, res) => {
  try {
    const [rows] = await query(
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

    let sql =
      "SELECT id, name, category, unit_price, current_stock FROM products";
    const params = [];

    if (storeId && storeId !== "all") {
      sql += " WHERE store_id = ?";
      params.push(storeId);
    }

    sql += " ORDER BY name";

    const [rows] = await query(sql, params);

    res
      .status(200)
      .json(createApiResponse(rows, "Products retrieved successfully"));
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json(createApiError(error));
  }
};
