import { createApiResponse, createApiError } from "../../shared/api.js";

// Get all transactions with filtering (simplified version)
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
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    console.log("SQL:", sql);
    console.log("Params:", params);

    const [rows] = await req.db.execute(sql, params);

    res.status(200).json(
      createApiResponse(
        {
          transactions: rows,
          pagination: {
            total: rows.length,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: false,
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
