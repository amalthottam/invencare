import { createApiResponse, createApiError } from "../../shared/api.js";

// Get all transactions with filtering
export const getTransactions = async (req, res) => {
  try {
    const { storeId, type, search, limit = 100, offset = 0 } = req.query;

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

    // Search functionality
    if (search) {
      sql += ` AND (
        product_name LIKE ? OR 
        reference_number LIKE ? OR 
        user_name LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Order and pagination
    sql += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

    const [rows] = await req.db.execute(sql, params);

    // Get total count for pagination
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
        reference_number LIKE ? OR 
        user_name LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
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
