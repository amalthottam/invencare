import { createApiResponse, createApiError } from "../../shared/api.js";

// Get top selling categories for dashboard
export const getTopSellingCategories = async (req, res) => {
  try {
    const { storeId, limit = 5 } = req.query;

    let sql = `
      SELECT 
        category,
        SUM(quantity) as total_sold,
        SUM(total_amount) as total_revenue,
        COUNT(*) as transaction_count
      FROM inventory_transactions 
      WHERE transaction_type = 'Sale'
    `;

    const params = [];

    // Filter by store if specified
    if (storeId && storeId !== "all") {
      sql += " AND store_id = ?";
      params.push(storeId);
    }

    sql += `
      GROUP BY category
      ORDER BY total_revenue DESC
      LIMIT ?
    `;

    params.push(parseInt(limit));

    const [rows] = await query(sql, params);

    // Format the response
    const categories = rows.map((row) => ({
      name: row.category,
      sales: parseInt(row.total_revenue || 0),
      unitsSold: row.total_sold || 0,
      transactions: row.transaction_count || 0,
    }));

    res
      .status(200)
      .json(
        createApiResponse(
          { categories },
          "Top selling categories retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Get top selling categories error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get comprehensive dashboard analytics
export const getDashboardAnalytics = async (req, res) => {
  try {
    const { storeId } = req.query;

    // Get basic inventory data
    let inventorySql = `
      SELECT 
        COUNT(*) as total_products,
        SUM(quantity) as total_stock,
        SUM(price * quantity) as total_value,
        COUNT(CASE WHEN quantity <= minimum_stock THEN 1 END) as low_stock_items
      FROM products 
      WHERE status = 'active'
    `;

    const inventoryParams = [];
    if (storeId && storeId !== "all") {
      inventorySql += " AND store_id = ?";
      inventoryParams.push(storeId);
    }

    const [inventoryData] = await query(inventorySql, inventoryParams);

    // Get top selling categories
    let categorySql = `
      SELECT 
        category,
        SUM(total_amount) as total_revenue,
        SUM(quantity) as total_sold
      FROM inventory_transactions 
      WHERE transaction_type = 'Sale'
    `;

    const categoryParams = [];
    if (storeId && storeId !== "all") {
      categorySql += " AND store_id = ?";
      categoryParams.push(storeId);
    }

    categorySql += `
      GROUP BY category
      ORDER BY total_revenue DESC
      LIMIT 5
    `;

    const [categoryData] = await query(categorySql, categoryParams);

    // Get monthly revenue
    let revenueSql = `
      SELECT 
        SUM(total_amount) as monthly_revenue
      FROM inventory_transactions 
      WHERE transaction_type = 'Sale'
        AND datetime(created_at) >= datetime(date('now', 'start of month'))
    `;

    const revenueParams = [];
    if (storeId && storeId !== "all") {
      revenueSql += " AND store_id = ?";
      revenueParams.push(storeId);
    }

    const [revenueData] = await query(revenueSql, revenueParams);

    // Calculate inventory turnover (simplified)
    let turnoverSql = `
      SELECT 
        SUM(quantity) as total_sold
      FROM inventory_transactions 
      WHERE transaction_type = 'Sale'
        AND datetime(created_at) >= datetime(date('now', '-30 days'))
    `;

    const turnoverParams = [];
    if (storeId && storeId !== "all") {
      turnoverSql += " AND store_id = ?";
      turnoverParams.push(storeId);
    }

    const [turnoverData] = await query(turnoverSql, turnoverParams);

    const inventory = inventoryData[0] || {};
    const totalStock = inventory.total_stock || 1;
    const totalSold = turnoverData[0]?.total_sold || 0;
    const inventoryTurnover = totalSold / totalStock;

    // Format response
    const dashboardData = {
      totalProducts: inventory.total_products || 0,
      lowStockItems: inventory.low_stock_items || 0,
      revenueThisMonth: parseFloat(revenueData[0]?.monthly_revenue || 0),
      inventoryTurnover: Math.round(inventoryTurnover * 100) / 100,
      topSellingCategories: categoryData.map((cat) => ({
        name: cat.category,
        sales: parseInt(cat.total_revenue || 0),
        unitsSold: cat.total_sold || 0,
      })),
      totalValue: parseFloat(inventory.total_value || 0),
    };

    res
      .status(200)
      .json(
        createApiResponse(
          dashboardData,
          "Dashboard analytics retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Get dashboard analytics error:", error);
    res.status(500).json(createApiError(error));
  }
};
