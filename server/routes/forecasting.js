import { createApiResponse, createApiError } from "../../shared/api.js";

// Get demand predictions
export const getDemandPredictions = async (req, res) => {
  console.log("🔍 getDemandPredictions called with query:", req.query);
  try {
    const { product_id, store_id, days = 30 } = req.query;

    // For demo purposes, create mock prediction data since we don't have ML models set up
    const mockPredictions = [
      {
        prediction_date: "2024-01-16",
        predicted_demand: 45,
        confidence_interval_lower: 35,
        confidence_interval_upper: 55,
        factors: JSON.stringify({ seasonality: "high", weather: "favorable" }),
        product_name: "Organic Bananas",
        product_id: "FV-BAN-001",
        store_name: "Downtown Store",
        model_name: "LSTM_Demand_Forecaster_v2",
        model_accuracy: 0.89,
      },
      {
        prediction_date: "2024-01-16",
        predicted_demand: 28,
        confidence_interval_lower: 22,
        confidence_interval_upper: 34,
        factors: JSON.stringify({
          seasonality: "moderate",
          promotions: "active",
        }),
        product_name: "Ground Coffee",
        product_id: "BV-COF-009",
        store_name: "Mall Location",
        model_name: "ARIMA_Seasonal_v1",
        model_accuracy: 0.82,
      },
      {
        prediction_date: "2024-01-17",
        predicted_demand: 42,
        confidence_interval_lower: 38,
        confidence_interval_upper: 48,
        factors: JSON.stringify({ seasonality: "high", weather: "favorable" }),
        product_name: "Organic Bananas",
        product_id: "FV-BAN-001",
        store_name: "Downtown Store",
        model_name: "LSTM_Demand_Forecaster_v2",
        model_accuracy: 0.89,
      },
      {
        prediction_date: "2024-01-17",
        predicted_demand: 31,
        confidence_interval_lower: 25,
        confidence_interval_upper: 37,
        factors: JSON.stringify({
          seasonality: "moderate",
          promotions: "none",
        }),
        product_name: "Ground Coffee",
        product_id: "BV-COF-009",
        store_name: "Mall Location",
        model_name: "ARIMA_Seasonal_v1",
        model_accuracy: 0.82,
      },
      {
        prediction_date: "2024-01-16",
        predicted_demand: 18,
        confidence_interval_lower: 14,
        confidence_interval_upper: 22,
        factors: JSON.stringify({ seasonality: "low", weather: "neutral" }),
        product_name: "Chicken Breast",
        product_id: "MP-CHI-008",
        store_name: "Mall Location",
        model_name: "Prophet_Trend_v1",
        model_accuracy: 0.75,
      },
    ];

    // Filter by store_id if provided
    let filteredPredictions = mockPredictions;
    if (store_id && store_id !== "all") {
      filteredPredictions = mockPredictions.filter((p) => {
        const storeMapping = {
          store_001: "Downtown Store",
          store_002: "Mall Location",
          store_003: "Uptown Branch",
          store_004: "Westside Market",
        };
        return p.store_name === storeMapping[store_id];
      });
    }

    // Filter by product_id if provided
    if (product_id) {
      filteredPredictions = filteredPredictions.filter(
        (p) => p.product_id === product_id,
      );
    }

    res.json(
      createApiResponse(
        { predictions: filteredPredictions },
        "Demand predictions retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("Demand predictions fetch error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get forecasting dashboard summary
export const getForecastingDashboard = async (req, res) => {
  try {
    // Create mock dashboard data for demo purposes
    const dashboardData = {
      summary: {
        totalModels: 3,
        avgAccuracy: 0.8533,
        totalPredictions: 15,
        highPriorityRecommendations: 4,
      },
      recentPredictions: [
        {
          product_name: "Organic Bananas",
          product_id: "FV-BAN-001",
          total_predicted_demand: 287,
          avg_daily_demand: 41,
          store_name: "Downtown Store",
        },
        {
          product_name: "Ground Coffee",
          product_id: "BV-COF-009",
          total_predicted_demand: 203,
          avg_daily_demand: 29,
          store_name: "Mall Location",
        },
        {
          product_name: "Chicken Breast",
          product_id: "MP-CHI-008",
          total_predicted_demand: 126,
          avg_daily_demand: 18,
          store_name: "Mall Location",
        },
        {
          product_name: "Energy Drinks",
          product_id: "BV-ENE-015",
          total_predicted_demand: 154,
          avg_daily_demand: 22,
          store_name: "Westside Market",
        },
      ],
      modelPerformance: [
        {
          model_name: "LSTM_Demand_Forecaster_v2",
          model_type: "lstm",
          model_accuracy: 0.89,
          predictions_count: 45,
        },
        {
          model_name: "ARIMA_Seasonal_v1",
          model_type: "arima",
          model_accuracy: 0.82,
          predictions_count: 38,
        },
        {
          model_name: "Prophet_Trend_v1",
          model_type: "prophet",
          model_accuracy: 0.75,
          predictions_count: 22,
        },
      ],
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
