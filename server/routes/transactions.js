import { createApiResponse, createApiError } from "../../shared/api.js";

// Get all transactions with filtering
export const getTransactions = async (req, res) => {
  try {
    const { storeId, type, search, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT 
        it.id,
        it.reference_number,
        it.transaction_type as type,
        it.product_id,
        it.product_name,
        it.category,
        it.quantity,
        it.unit_price,
        it.total_amount,
        it.store_id,
        s.name as store_name,
        it.transfer_to_store_id,
        ts.name as transfer_to_store_name,
        it.user_id,
        it.user_name,
        it.notes,
        it.created_at as timestamp
      FROM inventory_transactions it
      LEFT JOIN stores s ON it.store_id = s.id
      LEFT JOIN stores ts ON it.transfer_to_store_id = ts.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by store
    if (storeId && storeId !== "all") {
      sql += " AND it.store_id = ?";
      params.push(storeId);
    }

    // Filter by transaction type
    if (type && type !== "all") {
      sql += " AND it.transaction_type = ?";
      params.push(type);
    }

    // Search functionality
    if (search) {
      sql += ` AND (
        it.product_name LIKE ? OR 
        it.product_id LIKE ? OR 
        it.reference_number LIKE ? OR 
        it.user_name LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Order and pagination
    sql += " ORDER BY it.created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await req.db.execute(sql, params);

    // Get total count for pagination - simplified count query
    let countSql = `SELECT COUNT(*) as total FROM inventory_transactions it WHERE 1=1`;
    const countParams = [];

    if (storeId && storeId !== "all") {
      countSql += " AND it.store_id = ?";
      countParams.push(storeId);
    }
    if (type && type !== "all") {
      countSql += " AND it.transaction_type = ?";
      countParams.push(type);
    }

    if (search) {
      countSql += ` AND (
        it.product_name LIKE ? OR 
        it.product_id LIKE ? OR 
        it.reference_number LIKE ? OR 
        it.user_name LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      countParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
      );
    }

    const [countRows] = await req.db.execute(countSql, countParams);
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
    const { storeId } = req.query;

    let sql = `
      SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN transaction_type = 'sale' THEN total_amount ELSE 0 END) as total_sales,
        COUNT(CASE WHEN transaction_type = 'restock' THEN 1 END) as total_restocks,
        COUNT(CASE WHEN transaction_type = 'transfer' THEN 1 END) as total_transfers,
        COUNT(CASE WHEN transaction_type = 'adjustment' THEN 1 END) as total_adjustments
      FROM inventory_transactions 
      WHERE 1=1
    `;

    const params = [];

    // Filter by store
    if (storeId && storeId !== "all") {
      sql += " AND store_id = ?";
      params.push(storeId);
    }

    const [rows] = await req.db.execute(sql, params);

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

    // Insert transaction - using MySQL schema without store_name/transfer_to_store_name columns
    const [result] = await req.db.execute(
      `
      INSERT INTO inventory_transactions 
      (reference_number, transaction_type, product_id, product_name, category, quantity, unit_price, total_amount, store_id, transfer_to_store_id, user_id, user_name, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        transferToStoreId,
        userId,
        userName,
        notes,
      ],
    );

    // Update product inventory if product exists
    if (productId) {
      // Check if product exists
      const [productRows] = await req.db.execute(
        "SELECT quantity FROM products WHERE id = ? AND store_id = ?",
        [productId, storeId],
      );

      if (productRows.length > 0) {
        let stockChange = 0;

        switch (type) {
          case "sale":
          case "adjustment":
            stockChange = -Math.abs(quantity); // Negative for outbound
            break;
          case "restock":
            stockChange = Math.abs(quantity); // Positive for inbound
            break;
          case "transfer":
            // Reduce from source store, increase in destination store
            stockChange = -Math.abs(quantity);
            break;
        }

        // Update source store stock
        await req.db.execute(
          "UPDATE products SET quantity = quantity + ? WHERE id = ? AND store_id = ?",
          [stockChange, productId, storeId],
        );

        // If transfer, update destination store stock
        if (type === "transfer" && transferToStoreId) {
          await req.db.execute(
            "UPDATE products SET quantity = quantity + ? WHERE id = ? AND store_id = ?",
            [Math.abs(quantity), productId, transferToStoreId],
          );
        }
      }
    }

    // Get the created transaction with store names
    const [newTransaction] = await req.db.execute(
      `
      SELECT 
        it.id,
        it.reference_number,
        it.transaction_type as type,
        it.product_id,
        it.product_name,
        it.category,
        it.quantity,
        it.unit_price,
        it.total_amount,
        it.store_id,
        s.name as store_name,
        it.transfer_to_store_id,
        ts.name as transfer_to_store_name,
        it.user_id,
        it.user_name,
        it.notes,
        it.created_at as timestamp
      FROM inventory_transactions it
      LEFT JOIN stores s ON it.store_id = s.id
      LEFT JOIN stores ts ON it.transfer_to_store_id = ts.id
      WHERE it.id = ?
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
    const [rows] = await req.db.execute(
      "SELECT id, name, address FROM stores ORDER BY name",
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
      "SELECT id, name, category, price as unit_price, quantity as current_stock FROM products";
    const params = [];

    if (storeId && storeId !== "all") {
      sql += " WHERE store_id = ?";
      params.push(storeId);
    }

    sql += " ORDER BY name";

    const [rows] = await req.db.execute(sql, params);

    res
      .status(200)
      .json(createApiResponse(rows, "Products retrieved successfully"));
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json(createApiError(error));
  }
};
