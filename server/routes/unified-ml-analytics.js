import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { createApiResponse, createApiError } from "../../shared/api.js";

// Initialize Lambda client
const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Helper function to invoke Lambda
const invokeLambda = async (functionName, payload) => {
  try {
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(payload),
    });

    const response = await lambdaClient.send(command);
    const responsePayload = JSON.parse(
      new TextDecoder().decode(response.Payload),
    );

    if (responsePayload.statusCode !== 200) {
      throw new Error(
        JSON.parse(responsePayload.body).message || "Lambda function error",
      );
    }

    return JSON.parse(responsePayload.body);
  } catch (error) {
    console.error(`Lambda invocation error (${functionName}):`, error);
    throw error;
  }
};

// Unified ML Analytics Handler - Single Lambda function for all ML operations
export const handleUnifiedMLAnalytics = async (req, res) => {
  try {
    const {
      action, // 'forecast', 'classify', 'batch_predict', 'training_data', 'model_health'
      product_id,
      store_id,
      forecast_days = 30,
      model_type = "lstm",
      days_back = 90,
      include_confidence = true,
      batch_size = 10,
    } = req.method === "GET" ? req.query : req.body;

    const userRole = req.headers["x-user-role"] || "employee";
    const userStoreAccess = req.headers["x-user-store-access"]
      ? req.headers["x-user-store-access"].split(",")
      : [];

    const payload = {
      action,
      product_id,
      store_id,
      forecast_days: parseInt(forecast_days),
      model_type,
      days_back: parseInt(days_back),
      include_confidence: include_confidence === "true",
      batch_size: parseInt(batch_size),
      userRole,
      userStoreAccess,
      timestamp: new Date().toISOString(),
      request_id: `ml-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Add additional parameters based on action
    if (action === "batch_predict") {
      payload.store_ids = req.body.store_ids || [store_id];
      payload.product_ids = req.body.product_ids || [];
    }

    if (action === "training_data") {
      payload.export_format = req.body.export_format || "json";
      payload.include_features = req.body.include_features || true;
    }

    const result = await invokeLambda(
      process.env.LAMBDA_ML_ANALYTICS_FUNCTION || "invencare-ml-analytics",
      payload,
    );

    // Add action-specific response formatting
    let responseMessage = "ML analytics processed successfully";
    switch (action) {
      case "forecast":
        responseMessage = `Demand forecast generated for ${product_id}`;
        break;
      case "classify":
        responseMessage = `Product classification completed for ${product_id}`;
        break;
      case "batch_predict":
        responseMessage = `Batch predictions completed for ${result.total_products || 0} products`;
        break;
      case "training_data":
        responseMessage = `Training data extracted: ${result.records_count || 0} records`;
        break;
      case "model_health":
        responseMessage = "Model health check completed";
        break;
    }

    res.status(200).json(createApiResponse(result, responseMessage));
  } catch (error) {
    console.error("Unified ML Analytics error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get Latest ML Predictions (from database via Lambda)
export const handleGetMLPredictions = async (req, res) => {
  try {
    const { product_id, store_id } = req.params;
    const {
      prediction_type = "all", // 'forecast', 'classification', 'all'
      limit = 5,
      days_back = 30,
    } = req.query;

    const payload = {
      action: "get_predictions",
      product_id,
      store_id,
      prediction_type,
      limit: parseInt(limit),
      days_back: parseInt(days_back),
      timestamp: new Date().toISOString(),
    };

    const result = await invokeLambda(
      process.env.LAMBDA_ML_ANALYTICS_FUNCTION || "invencare-ml-analytics",
      payload,
    );

    res
      .status(200)
      .json(createApiResponse(result, "ML predictions retrieved successfully"));
  } catch (error) {
    console.error("Get ML Predictions error:", error);
    res.status(500).json(createApiError(error));
  }
};

// ML Analytics Dashboard Data
export const handleMLDashboard = async (req, res) => {
  try {
    const {
      store_id,
      time_period = "30days",
      include_trends = true,
      include_accuracy = true,
    } = req.query;

    const userRole = req.headers["x-user-role"] || "employee";
    const userStoreAccess = req.headers["x-user-store-access"]
      ? req.headers["x-user-store-access"].split(",")
      : [];

    const payload = {
      action: "dashboard",
      store_id,
      time_period,
      include_trends: include_trends === "true",
      include_accuracy: include_accuracy === "true",
      userRole,
      userStoreAccess,
      timestamp: new Date().toISOString(),
    };

    const result = await invokeLambda(
      process.env.LAMBDA_ML_ANALYTICS_FUNCTION || "invencare-ml-analytics",
      payload,
    );

    res
      .status(200)
      .json(
        createApiResponse(result, "ML dashboard data retrieved successfully"),
      );
  } catch (error) {
    console.error("ML Dashboard error:", error);
    res.status(500).json(createApiError(error));
  }
};

// SageMaker Model Management via Lambda
export const handleModelManagement = async (req, res) => {
  try {
    const {
      action, // 'deploy', 'update', 'delete', 'status', 'retrain'
      model_type,
      endpoint_name,
      training_config,
    } = req.body;

    const userRole = req.headers["x-user-role"] || "employee";

    // Only allow admin/manager roles for model management
    if (!["admin", "manager"].includes(userRole)) {
      return res
        .status(403)
        .json(
          createApiError(
            new Error("Insufficient permissions for model management"),
          ),
        );
    }

    const payload = {
      action: "model_management",
      management_action: action,
      model_type,
      endpoint_name,
      training_config,
      userRole,
      timestamp: new Date().toISOString(),
    };

    const result = await invokeLambda(
      process.env.LAMBDA_ML_ANALYTICS_FUNCTION || "invencare-ml-analytics",
      payload,
    );

    res
      .status(200)
      .json(
        createApiResponse(result, `Model ${action} completed successfully`),
      );
  } catch (error) {
    console.error("Model Management error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Health Check for ML Services
export const handleMLHealthCheck = async (req, res) => {
  try {
    const payload = {
      action: "health_check",
      check_endpoints: true,
      check_database: true,
      check_models: true,
      timestamp: new Date().toISOString(),
    };

    const result = await invokeLambda(
      process.env.LAMBDA_ML_ANALYTICS_FUNCTION || "invencare-ml-analytics",
      payload,
    );

    const healthStatus = {
      overall: result.overall_status || "unknown",
      services: result.services || {},
      endpoints: result.endpoints || {},
      models: result.models || {},
      database: result.database || {},
      timestamp: new Date().toISOString(),
    };

    res
      .status(200)
      .json(createApiResponse(healthStatus, "ML health check completed"));
  } catch (error) {
    console.error("ML Health check error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Real-time Prediction (for immediate use)
export const handleRealTimePrediction = async (req, res) => {
  try {
    const {
      product_id,
      store_id,
      model_type = "lstm",
      forecast_days = 7,
      priority = "high", // high, normal, low
    } = req.body;

    if (!product_id || !store_id) {
      return res
        .status(400)
        .json(
          createApiError(new Error("product_id and store_id are required")),
        );
    }

    const payload = {
      action: "realtime_predict",
      product_id,
      store_id,
      model_type,
      forecast_days: parseInt(forecast_days),
      priority,
      timestamp: new Date().toISOString(),
      request_id: `rt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    const result = await invokeLambda(
      process.env.LAMBDA_ML_ANALYTICS_FUNCTION || "invencare-ml-analytics",
      payload,
    );

    res
      .status(200)
      .json(createApiResponse(result, "Real-time prediction completed"));
  } catch (error) {
    console.error("Real-time Prediction error:", error);
    res.status(500).json(createApiError(error));
  }
};
