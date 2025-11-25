import { createApiResponse, createApiError } from "../../shared/api.js";
import AWS from "aws-sdk";

// Configure AWS SDK
const lambda = new AWS.Lambda({
  region: process.env.AWS_REGION || "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Lambda function name for ML forecasting
const ML_LAMBDA_FUNCTION =
  process.env.ML_LAMBDA_FUNCTION || "ml-forecasting-lambda";

// Get ML models information
export const getMLModels = async (req, res) => {
  try {
    const { storeId } = req.query;

    // Mock ML models data - in production, this would come from SageMaker or model registry
    const models = [
      {
        id: "lstm_v2.1",
        name: "LSTM Neural Network v2.1",
        type: "lstm",
        accuracy: 0.924,
        status: "active",
        lastTrained: "2024-01-15T10:30:00Z",
        endpoint: "lstm-demand-forecast-endpoint",
        parameters: {
          epochs: 100,
          learning_rate: 0.001,
          hidden_layers: [64, 32],
          sequence_length: 30,
        },
        metrics: {
          mae: 12.3,
          rmse: 15.8,
          mape: 7.6,
        },
      },
      {
        id: "arima_seasonal",
        name: "ARIMA Seasonal Model",
        type: "arima",
        accuracy: 0.887,
        status: "active",
        lastTrained: "2024-01-14T15:45:00Z",
        endpoint: "arima-demand-forecast-endpoint",
        parameters: {
          p: 2,
          d: 1,
          q: 2,
          seasonal: true,
          seasonal_period: 7,
        },
        metrics: {
          mae: 18.7,
          rmse: 24.1,
          mape: 11.3,
        },
      },
      {
        id: "ensemble_v3",
        name: "Ensemble Model v3.0",
        type: "ensemble",
        accuracy: 0.951,
        status: "active",
        lastTrained: "2024-01-15T14:20:00Z",
        endpoint: "ensemble-demand-forecast-endpoint",
        parameters: {
          weights: [0.4, 0.35, 0.25],
          models: ["lstm", "arima", "prophet"],
          meta_learner: "ridge",
        },
        metrics: {
          mae: 9.8,
          rmse: 12.4,
          mape: 4.9,
        },
      },
      {
        id: "prophet_trend",
        name: "Prophet Trend Analysis",
        type: "prophet",
        accuracy: 0.863,
        status: "training",
        lastTrained: "2024-01-13T09:15:00Z",
        endpoint: "prophet-demand-forecast-endpoint",
        parameters: {
          growth: "linear",
          seasonality: "multiplicative",
          yearly_seasonality: true,
          weekly_seasonality: true,
        },
        metrics: {
          mae: 21.2,
          rmse: 27.3,
          mape: 13.7,
        },
      },
    ];

    // Filter by store if specified
    let filteredModels = models;
    if (storeId && storeId !== "all") {
      // In production, filter models by store
      filteredModels = models;
    }

    res
      .status(200)
      .json(
        createApiResponse(
          { models: filteredModels },
          "ML models retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Get ML models error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get predictions from ML models
export const getPredictions = async (req, res) => {
  try {
    const { storeId, model, days } = req.query;

    // Mock predictions data
    const predictions = [
      {
        product_id: "FV-BAN-001",
        product_name: "Organic Bananas",
        category: "Fruits & Vegetables",
        store_id: storeId || "store_001",
        predicted: 245,
        confidence: 0.92,
        model: model || "ensemble",
        date: "2024-01-20",
        variance: 12.3,
        trend: "increasing",
        confidence_lower: 220,
        confidence_upper: 270,
      },
      {
        product_id: "DA-MLK-005",
        product_name: "Whole Milk",
        category: "Dairy",
        store_id: storeId || "store_001",
        predicted: 180,
        confidence: 0.89,
        model: model || "lstm",
        date: "2024-01-20",
        variance: 8.7,
        trend: "stable",
        confidence_lower: 165,
        confidence_upper: 195,
      },
      {
        product_id: "MP-CHI-011",
        product_name: "Chicken Breast",
        category: "Meat & Poultry",
        store_id: storeId || "store_001",
        predicted: 95,
        confidence: 0.94,
        model: model || "ensemble",
        date: "2024-01-20",
        variance: 15.2,
        trend: "increasing",
        confidence_lower: 82,
        confidence_upper: 108,
      },
      {
        product_id: "BV-ENE-015",
        product_name: "Energy Drinks",
        category: "Beverages",
        store_id: storeId || "store_001",
        predicted: 320,
        confidence: 0.87,
        model: model || "arima",
        date: "2024-01-20",
        variance: 22.1,
        trend: "decreasing",
        confidence_lower: 285,
        confidence_upper: 355,
      },
    ];

    res
      .status(200)
      .json(
        createApiResponse(
          { predictions },
          "Predictions retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Get predictions error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get model performance metrics
export const getModelPerformance = async (req, res) => {
  try {
    const { storeId, days } = req.query;

    // Mock model performance data
    const performance = {
      accuracy: {
        lstm: [92.4, 91.8, 93.1, 92.7, 93.5, 92.9, 93.2],
        arima: [88.7, 89.2, 87.9, 88.5, 89.0, 88.3, 89.1],
        ensemble: [95.1, 94.8, 95.3, 95.0, 95.4, 95.2, 95.1],
        prophet: [86.3, 87.1, 85.9, 86.7, 87.2, 86.5, 86.8],
      },
      metrics: {
        mae: {
          lstm: 12.3,
          arima: 18.7,
          ensemble: 9.8,
          prophet: 21.2,
        },
        rmse: {
          lstm: 15.8,
          arima: 24.1,
          ensemble: 12.4,
          prophet: 27.3,
        },
        mape: {
          lstm: 7.6,
          arima: 11.3,
          ensemble: 4.9,
          prophet: 13.7,
        },
      },
      training_time: {
        lstm: 45.2,
        arima: 8.3,
        ensemble: 67.8,
        prophet: 12.7,
      },
      prediction_latency: {
        lstm: 0.12,
        arima: 0.03,
        ensemble: 0.15,
        prophet: 0.08,
      },
      data_quality: {
        completeness: 0.95,
        accuracy: 0.92,
        consistency: 0.89,
        timeliness: 0.97,
      },
    };

    res
      .status(200)
      .json(
        createApiResponse(
          { performance },
          "Model performance retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Get model performance error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get anomaly detection results
export const getAnomalies = async (req, res) => {
  try {
    const { storeId, days } = req.query;

    // Mock anomalies data
    const anomalies = [
      {
        id: "anom_001",
        product_id: "MP-SAL-013",
        product_name: "Atlantic Salmon",
        store_id: storeId || "store_001",
        anomaly_type: "demand_spike",
        severity: "high",
        detected_at: "2024-01-19T14:30:00Z",
        value: 450,
        expected: 180,
        deviation: 2.7,
        confidence: 0.96,
        description: "Unusual demand spike detected - 150% above normal",
        potential_causes: [
          "Weekend promotion",
          "Supply shortage elsewhere",
          "Seasonal event",
        ],
        recommended_actions: [
          "Increase stock levels",
          "Check promotional calendar",
          "Monitor competitor pricing",
        ],
      },
      {
        id: "anom_002",
        product_id: "SN-CHI-018",
        product_name: "Kettle Chips",
        store_id: storeId || "store_001",
        anomaly_type: "demand_drop",
        severity: "medium",
        detected_at: "2024-01-19T11:15:00Z",
        value: 12,
        expected: 45,
        deviation: -2.1,
        confidence: 0.87,
        description: "Significant demand drop detected",
        potential_causes: [
          "New competitor product",
          "Price increase",
          "Seasonal preference shift",
        ],
        recommended_actions: [
          "Review pricing strategy",
          "Check product placement",
          "Monitor customer feedback",
        ],
      },
      {
        id: "anom_003",
        product_id: "DA-YOG-007",
        product_name: "Greek Yogurt",
        store_id: storeId || "store_001",
        anomaly_type: "price_anomaly",
        severity: "low",
        detected_at: "2024-01-19T09:45:00Z",
        value: 7.99,
        expected: 4.99,
        deviation: 1.5,
        confidence: 0.73,
        description: "Price anomaly detected - higher than expected",
        potential_causes: [
          "Supplier price increase",
          "Premium product mix",
          "Data entry error",
        ],
        recommended_actions: [
          "Verify pricing accuracy",
          "Check supplier contracts",
          "Review product mix",
        ],
      },
    ];

    res
      .status(200)
      .json(
        createApiResponse({ anomalies }, "Anomalies retrieved successfully"),
      );
  } catch (error) {
    console.error("Get anomalies error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get advanced forecasts
export const getAdvancedForecasts = async (req, res) => {
  try {
    const { storeId, model, days } = req.query;

    // Mock forecast data showing multiple models
    const forecasts = [
      {
        date: "Jan 16",
        lstm: 245,
        arima: 238,
        ensemble: 242,
        prophet: 240,
        actual: 241,
      },
      {
        date: "Jan 17",
        lstm: 252,
        arima: 245,
        ensemble: 249,
        prophet: 247,
        actual: 248,
      },
      {
        date: "Jan 18",
        lstm: 248,
        arima: 241,
        ensemble: 245,
        prophet: 243,
        actual: 244,
      },
      {
        date: "Jan 19",
        lstm: 255,
        arima: 249,
        ensemble: 252,
        prophet: 250,
        actual: 253,
      },
      {
        date: "Jan 20",
        lstm: 260,
        arima: 253,
        ensemble: 257,
        prophet: 255,
        actual: null,
      },
      {
        date: "Jan 21",
        lstm: 262,
        arima: 255,
        ensemble: 259,
        prophet: 257,
        actual: null,
      },
      {
        date: "Jan 22",
        lstm: 265,
        arima: 258,
        ensemble: 262,
        prophet: 260,
        actual: null,
      },
      {
        date: "Jan 23",
        lstm: 268,
        arima: 261,
        ensemble: 265,
        prophet: 263,
        actual: null,
      },
      {
        date: "Jan 24",
        lstm: 270,
        arima: 264,
        ensemble: 267,
        prophet: 265,
        actual: null,
      },
      {
        date: "Jan 25",
        lstm: 272,
        arima: 266,
        ensemble: 269,
        prophet: 267,
        actual: null,
      },
    ];

    res
      .status(200)
      .json(
        createApiResponse(
          { forecasts },
          "Advanced forecasts retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Get advanced forecasts error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get AI-generated insights
export const getAIInsights = async (req, res) => {
  try {
    const { storeId, days } = req.query;

    // Mock AI insights
    const insights = [
      {
        id: "insight_001",
        type: "trend",
        title: "Seasonal Demand Surge Detected",
        description:
          "Fruits & Vegetables category showing 18% increase vs last month",
        confidence: 0.94,
        impact: "high",
        category: "Fruits & Vegetables",
        affected_products: ["FV-BAN-001", "FV-APP-002", "FV-CAR-003"],
        trend_direction: "increasing",
        magnitude: 0.18,
        timeframe: "next 14 days",
        recommendation:
          "Increase inventory by 20% for next week to capitalize on demand surge",
        action_priority: "immediate",
        estimated_revenue_impact: 2500,
        generated_at: "2024-01-19T16:45:00Z",
      },
      {
        id: "insight_002",
        type: "optimization",
        title: "Inventory Efficiency Opportunity",
        description:
          "LSTM model suggests reducing dairy safety stock by 15% without stockout risk",
        confidence: 0.87,
        impact: "medium",
        category: "Dairy",
        affected_products: ["DA-MLK-005", "DA-CHE-006", "DA-YOG-007"],
        optimization_type: "inventory_reduction",
        current_efficiency: 0.72,
        potential_efficiency: 0.83,
        recommendation:
          "Implement dynamic safety stock adjustment based on LSTM predictions",
        action_priority: "medium",
        estimated_cost_savings: 1800,
        generated_at: "2024-01-19T15:30:00Z",
      },
      {
        id: "insight_003",
        type: "alert",
        title: "Model Drift Detected",
        description:
          "ARIMA model accuracy dropped 3% over last 7 days, retraining recommended",
        confidence: 0.91,
        impact: "medium",
        model_name: "ARIMA Seasonal Model",
        accuracy_drop: 0.03,
        current_accuracy: 0.857,
        previous_accuracy: 0.887,
        drift_severity: "moderate",
        recommendation:
          "Schedule model retraining within 48 hours to maintain prediction quality",
        action_priority: "high",
        estimated_improvement: 0.025,
        generated_at: "2024-01-19T14:15:00Z",
      },
      {
        id: "insight_004",
        type: "pattern",
        title: "Weekly Demand Pattern Shift",
        description:
          "Consumer behavior shows new weekend shopping pattern emerging",
        confidence: 0.82,
        impact: "medium",
        pattern_type: "temporal",
        old_pattern: "Peak on Friday-Saturday",
        new_pattern: "Peak on Saturday-Sunday",
        shift_magnitude: 0.12,
        affected_categories: ["Snacks", "Beverages", "Frozen Foods"],
        recommendation:
          "Adjust weekend staffing and stock allocation to match new pattern",
        action_priority: "medium",
        estimated_impact: "15% improvement in weekend sales",
        generated_at: "2024-01-19T13:00:00Z",
      },
    ];

    res
      .status(200)
      .json(
        createApiResponse({ insights }, "AI insights retrieved successfully"),
      );
  } catch (error) {
    console.error("Get AI insights error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get real-time metrics
export const getRealTimeMetrics = async (req, res) => {
  try {
    const { storeId } = req.query;

    // Mock real-time metrics
    const metrics = {
      prediction_latency: 0.124,
      model_confidence: 0.923,
      data_freshness: 0.98,
      system_load: 0.67,
      active_predictions: 1247,
      accuracy_trend: "increasing",
      last_updated: new Date().toISOString(),

      // Model status
      model_status: {
        lstm: "healthy",
        arima: "healthy",
        ensemble: "healthy",
        prophet: "training",
      },

      // Data pipeline status
      pipeline_status: {
        data_ingestion: "healthy",
        feature_engineering: "healthy",
        model_inference: "healthy",
        result_storage: "healthy",
      },

      // Performance indicators
      performance_indicators: {
        throughput: 145.7, // predictions per minute
        error_rate: 0.002,
        cache_hit_rate: 0.87,
        data_quality_score: 0.94,
      },

      // Resource utilization
      resource_utilization: {
        cpu_usage: 0.45,
        memory_usage: 0.62,
        storage_usage: 0.38,
        network_io: 0.23,
      },
    };

    res
      .status(200)
      .json(
        createApiResponse(
          { metrics },
          "Real-time metrics retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Get real-time metrics error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Generate ML forecast using Lambda
export const generateMLForecast = async (req, res) => {
  try {
    const { storeId, modelType, forecastDays } = req.body;

    console.log(
      `Generating ML forecast for store ${storeId} using ${modelType} model`,
    );

    // Prepare Lambda payload
    const lambdaPayload = {
      operation: "generate_forecast",
      models: [modelType || "ensemble"],
      store_ids: storeId && storeId !== "all" ? [storeId] : undefined,
      forecast_days: forecastDays || 7,
    };

    // Invoke Lambda function
    const lambdaParams = {
      FunctionName: ML_LAMBDA_FUNCTION,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(lambdaPayload),
    };

    const lambdaResponse = await lambda.invoke(lambdaParams).promise();

    if (lambdaResponse.StatusCode !== 200) {
      throw new Error(
        `Lambda invocation failed with status ${lambdaResponse.StatusCode}`,
      );
    }

    const responsePayload = JSON.parse(lambdaResponse.Payload);

    if (responsePayload.statusCode !== 200) {
      throw new Error(
        `Lambda function returned error: ${responsePayload.body}`,
      );
    }

    const result = JSON.parse(responsePayload.body);

    // Store results in database if successful
    if (result.forecasts && !result.error) {
      // In production, store forecast results in demand_predictions table
      console.log("Forecast generated successfully, storing results...");

      // Mock storage confirmation
      result.stored_in_database = true;
      result.storage_timestamp = new Date().toISOString();
    }

    res
      .status(200)
      .json(createApiResponse(result, "ML forecast generated successfully"));
  } catch (error) {
    console.error("Generate ML forecast error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get model comparison data
export const getModelComparison = async (req, res) => {
  try {
    const { storeId, days } = req.query;

    // Mock model comparison data
    const comparison = {
      models: ["LSTM", "ARIMA", "Ensemble", "Prophet"],
      metrics: {
        accuracy: [92.4, 88.7, 95.1, 86.3],
        mae: [12.3, 18.7, 9.8, 21.2],
        rmse: [15.8, 24.1, 12.4, 27.3],
        mape: [7.6, 11.3, 4.9, 13.7],
      },
      training_time: [45.2, 8.3, 67.8, 12.7],
      prediction_speed: [0.12, 0.03, 0.15, 0.08],
      memory_usage: [2.4, 0.8, 3.2, 1.5],

      // Model strengths and weaknesses
      analysis: {
        LSTM: {
          strengths: [
            "Handles complex patterns",
            "Good for non-linear trends",
            "Robust to noise",
          ],
          weaknesses: [
            "Requires more data",
            "Longer training time",
            "Higher resource usage",
          ],
          best_for: [
            "Complex seasonal patterns",
            "Non-linear demand",
            "Large datasets",
          ],
        },
        ARIMA: {
          strengths: [
            "Fast training",
            "Low resource usage",
            "Good interpretability",
          ],
          weaknesses: [
            "Assumes linear relationships",
            "Sensitive to outliers",
            "Requires stationary data",
          ],
          best_for: ["Linear trends", "Simple seasonality", "Quick forecasts"],
        },
        Ensemble: {
          strengths: [
            "Best overall accuracy",
            "Robust predictions",
            "Combines model strengths",
          ],
          weaknesses: [
            "Complex to maintain",
            "Longer inference time",
            "Higher computational cost",
          ],
          best_for: [
            "Production systems",
            "Critical forecasts",
            "Maximum accuracy",
          ],
        },
        Prophet: {
          strengths: [
            "Handles holidays",
            "Good with missing data",
            "Easy to interpret",
          ],
          weaknesses: [
            "Limited flexibility",
            "Can overfit",
            "Slower on large datasets",
          ],
          best_for: [
            "Business forecasting",
            "Holiday effects",
            "Interpretable results",
          ],
        },
      },
    };

    res
      .status(200)
      .json(
        createApiResponse(
          comparison,
          "Model comparison retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Get model comparison error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get feature importance analysis
export const getFeatureImportance = async (req, res) => {
  try {
    const { modelType } = req.query;

    // Mock feature importance data
    const featureImportance = {
      model_type: modelType || "ensemble",
      timestamp: new Date().toISOString(),
      features: [
        {
          name: "demand_lag_1",
          importance: 0.285,
          description: "Previous day demand",
          category: "temporal",
        },
        {
          name: "demand_rolling_mean_7",
          importance: 0.142,
          description: "7-day rolling average demand",
          category: "statistical",
        },
        {
          name: "dayofweek",
          importance: 0.098,
          description: "Day of week (0=Monday)",
          category: "temporal",
        },
        {
          name: "month",
          importance: 0.087,
          description: "Month of year",
          category: "seasonal",
        },
        {
          name: "price_change_pct",
          importance: 0.076,
          description: "Percentage price change",
          category: "economic",
        },
        {
          name: "stock_level",
          importance: 0.065,
          description: "Current inventory level",
          category: "inventory",
        },
        {
          name: "demand_rolling_std_7",
          importance: 0.054,
          description: "7-day demand volatility",
          category: "statistical",
        },
        {
          name: "is_weekend",
          importance: 0.043,
          description: "Weekend indicator",
          category: "temporal",
        },
        {
          name: "seasonal_index",
          importance: 0.039,
          description: "Seasonal adjustment factor",
          category: "seasonal",
        },
        {
          name: "competitor_price_ratio",
          importance: 0.032,
          description: "Price vs competitor average",
          category: "economic",
        },
      ],

      // Category-wise importance
      category_importance: {
        temporal: 0.426,
        statistical: 0.196,
        seasonal: 0.126,
        economic: 0.108,
        inventory: 0.065,
        external: 0.079,
      },

      // Model-specific insights
      insights: [
        "Temporal features are the strongest predictors (42.6% combined importance)",
        "Previous day demand is the single most important feature",
        "Price changes have moderate but consistent impact",
        "Inventory levels show threshold effects - important when low",
        "External factors (weather, events) contribute moderately",
      ],
    };

    res
      .status(200)
      .json(
        createApiResponse(
          featureImportance,
          "Feature importance retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Get feature importance error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get data quality assessment
export const getDataQuality = async (req, res) => {
  try {
    const { storeId, days } = req.query;

    // Mock data quality assessment
    const dataQuality = {
      overall_score: 0.892,
      assessment_date: new Date().toISOString(),

      dimensions: {
        completeness: {
          score: 0.95,
          issues: 2,
          description: "Percentage of non-null values",
          details: {
            missing_demand_data: 0.02,
            missing_price_data: 0.01,
            missing_stock_data: 0.02,
          },
        },
        accuracy: {
          score: 0.87,
          issues: 5,
          description: "Correctness of data values",
          details: {
            negative_demand_records: 12,
            unrealistic_prices: 3,
            impossible_stock_levels: 1,
          },
        },
        consistency: {
          score: 0.91,
          issues: 3,
          description: "Uniformity across data sources",
          details: {
            format_inconsistencies: 2,
            unit_mismatches: 1,
            duplicate_records: 0,
          },
        },
        timeliness: {
          score: 0.94,
          issues: 1,
          description: "Data freshness and update frequency",
          details: {
            delayed_updates: 0.06,
            stale_data_percentage: 0.03,
          },
        },
        validity: {
          score: 0.89,
          issues: 4,
          description: "Data conformity to business rules",
          details: {
            rule_violations: 4,
            constraint_failures: 2,
            outlier_percentage: 0.08,
          },
        },
      },

      // Issues by severity
      issues_by_severity: {
        critical: 1,
        high: 3,
        medium: 7,
        low: 4,
      },

      // Trend over time
      quality_trend: [
        { date: "2024-01-13", score: 0.876 },
        { date: "2024-01-14", score: 0.882 },
        { date: "2024-01-15", score: 0.885 },
        { date: "2024-01-16", score: 0.889 },
        { date: "2024-01-17", score: 0.891 },
        { date: "2024-01-18", score: 0.89 },
        { date: "2024-01-19", score: 0.892 },
      ],

      // Recommendations
      recommendations: [
        {
          priority: "high",
          issue: "Price data validation",
          action: "Implement automated price range validation",
          estimated_impact: 0.03,
        },
        {
          priority: "medium",
          issue: "Missing demand data",
          action: "Setup automated gap detection and interpolation",
          estimated_impact: 0.02,
        },
        {
          priority: "medium",
          issue: "Data freshness monitoring",
          action: "Create real-time data freshness dashboard",
          estimated_impact: 0.015,
        },
      ],
    };

    res
      .status(200)
      .json(
        createApiResponse(
          dataQuality,
          "Data quality assessment retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Get data quality error:", error);
    res.status(500).json(createApiError(error));
  }
};
