import { createApiResponse, createApiError } from "../../shared/api.js";

// Get demand predictions from real database
export const getDemandPredictions = async (req, res) => {
  try {
    const { product_id, store_id, days = 30 } = req.query;

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1); // Start from yesterday
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(days));

    let query = `
      SELECT
        dp.id,
        dp.product_id,
        dp.store_id,
        dp.prediction_date,
        dp.predicted_demand,
        dp.confidence_interval_lower,
        dp.confidence_interval_upper,
        dp.actual_demand,
        dp.prediction_accuracy,
        dp.factors,
        dp.lambda_execution_id,
        dp.created_at,
        p.name as product_name,
        p.category,
        s.name as store_name,
        dfm.model_name,
        dfm.model_accuracy
      FROM demand_predictions dp
      JOIN products p ON dp.product_id = p.id
      JOIN stores s ON dp.store_id = s.id
      JOIN demand_forecasting_models dfm ON dp.model_id = dfm.id
      WHERE dp.prediction_date >= ? AND dp.prediction_date <= ?
    `;

    const params = [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]];

    // Add filters
    if (store_id && store_id !== "all") {
      query += " AND dp.store_id = ?";
      params.push(store_id);
    }

    if (product_id) {
      query += " AND dp.product_id = ?";
      params.push(product_id);
    }

    query += " ORDER BY dp.prediction_date ASC, dp.predicted_demand DESC";
    query += " LIMIT 100"; // Limit for performance

    const [rows] = await req.db.execute(query, params);

    // Parse JSON factors field
    const predictions = rows.map(row => ({
      ...row,
      factors: typeof row.factors === 'string' ? JSON.parse(row.factors) : row.factors
    }));

    res.json(
      createApiResponse(
        { predictions },
        "Demand predictions retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("Demand predictions fetch error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get category-wise prediction insights
export const getCategoryInsights = async (req, res) => {
  try {
    const [categoryData] = await pool.execute(`
      SELECT
        p.category,
        COUNT(DISTINCT dp.product_id) as product_count,
        AVG(dp.predicted_demand) as avg_predicted_demand,
        SUM(dp.predicted_demand) as total_predicted_demand,
        AVG(dp.prediction_accuracy) as avg_accuracy,
        AVG(dp.confidence_interval_upper - dp.confidence_interval_lower) as avg_uncertainty
      FROM demand_predictions dp
      JOIN products p ON dp.product_id = p.id
      WHERE dp.prediction_date >= CURDATE()
      AND dp.prediction_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      GROUP BY p.category
      ORDER BY total_predicted_demand DESC
    `);

    res.json(
      createApiResponse(
        { categories: categoryData },
        "Category insights retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("Category insights fetch error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get forecasting dashboard summary from real database
export const getForecastingDashboard = async (req, res) => {
  try {
    const [summaryResult] = await req.db.execute(`
      SELECT
        COUNT(DISTINCT dfm.id) as totalModels,
        AVG(dfm.model_accuracy) as avgAccuracy,
        COUNT(dp.id) as totalPredictions
      FROM demand_forecasting_models dfm
      LEFT JOIN demand_predictions dp ON dfm.id = dp.model_id
      WHERE dfm.training_status = 'deployed'
    `);

    const summary = summaryResult[0] || {
      totalModels: 1,
      avgAccuracy: 0.65,
      totalPredictions: 0
    };

    // Get high priority recommendations (predictions with high demand variance)
    const [highPriorityResult] = await req.db.execute(`
      SELECT COUNT(*) as count
      FROM demand_predictions dp
      WHERE dp.prediction_date >= CURDATE()
      AND (dp.confidence_interval_upper - dp.confidence_interval_lower) > dp.predicted_demand * 0.5
    `);

    const highPriorityRecommendations = highPriorityResult[0]?.count || 0;

    // Get top predicted products for next 7 days
    const [recentPredictions] = await req.db.execute(`
      SELECT
        p.name as product_name,
        dp.product_id,
        s.name as store_name,
        SUM(dp.predicted_demand) as total_predicted_demand,
        AVG(dp.predicted_demand) as avg_daily_demand
      FROM demand_predictions dp
      JOIN products p ON dp.product_id = p.id
      JOIN stores s ON dp.store_id = s.id
      WHERE dp.prediction_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      GROUP BY dp.product_id, dp.store_id
      ORDER BY total_predicted_demand DESC
      LIMIT 10
    `);

    // Get model performance data
    const [modelPerformance] = await req.db.execute(`
      SELECT
        dfm.model_name,
        dfm.model_type,
        dfm.model_accuracy,
        COUNT(dp.id) as predictions_count,
        dfm.training_status
      FROM demand_forecasting_models dfm
      LEFT JOIN demand_predictions dp ON dfm.id = dp.model_id
      WHERE dfm.training_status = 'deployed'
      GROUP BY dfm.id
      ORDER BY dfm.model_accuracy DESC
    `);

    // Get accuracy trends and insights
    const [accuracyTrends] = await req.db.execute(`
      SELECT
        DATE(dp.created_at) as date,
        AVG(dp.prediction_accuracy) as avg_accuracy,
        COUNT(*) as prediction_count
      FROM demand_predictions dp
      WHERE dp.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      AND dp.prediction_accuracy IS NOT NULL
      GROUP BY DATE(dp.created_at)
      ORDER BY date DESC
      LIMIT 7
    `);

    const dashboardData = {
      summary: {
        ...summary,
        highPriorityRecommendations
      },
      recentPredictions: recentPredictions || [],
      modelPerformance: modelPerformance || [],
      accuracyTrends: accuracyTrends || []
    };

    res.json(
      createApiResponse(
        dashboardData,
        "Forecasting dashboard retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("Forecasting dashboard fetch error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get stores for filtering
export const getStores = async (req, res) => {
  try {
    const [stores] = await req.db.execute(`
      SELECT id, name, status
      FROM stores
      WHERE status = 'active'
      ORDER BY name
    `);

    res.json(
      createApiResponse(
        { stores },
        "Stores retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("Stores fetch error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get products for filtering
export const getProducts = async (req, res) => {
  try {
    const [products] = await req.db.execute(`
      SELECT DISTINCT p.id, p.name, p.category
      FROM products p
      JOIN demand_predictions dp ON p.id = dp.product_id
      WHERE p.status = 'active'
      ORDER BY p.name
      LIMIT 50
    `);

    res.json(
      createApiResponse(
        { products },
        "Products with predictions retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("Products fetch error:", error);
    res.status(500).json(createApiError(error));
  }
};
