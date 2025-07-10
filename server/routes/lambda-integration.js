import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { createApiResponse, createApiError } from "@shared/api.js";

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

// Inventory Analytics Handler
export const handleInventoryAnalytics = async (req, res) => {
  try {
    const {
      action = "generateInventoryReport",
      storeId,
      storeIds,
      dateRange = "30days",
      categoryFilter,
      includeStoreBreakdown = false,
    } = req.query;

    const userRole = req.headers["x-user-role"] || "employee";
    const userStoreAccess = req.headers["x-user-store-access"]
      ? req.headers["x-user-store-access"].split(",")
      : [];

    const payload = {
      action,
      storeId,
      storeIds: storeIds ? storeIds.split(",") : [],
      dateRange,
      categoryFilter,
      userRole,
      userStoreAccess,
      includeStoreBreakdown: includeStoreBreakdown === "true",
    };

    const result = await invokeLambda(
      process.env.LAMBDA_INVENTORY_ANALYTICS_FUNCTION ||
        "invencare-inventory-analytics",
      payload,
    );

    res
      .status(200)
      .json(
        createApiResponse(result, "Inventory analytics processed successfully"),
      );
  } catch (error) {
    console.error("Inventory analytics error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Transaction Analytics Handler
export const handleTransactionAnalytics = async (req, res) => {
  try {
    const {
      action = "generateTransactionReport",
      storeId,
      storeIds,
      transactionTypes = "sale,restock,adjustment,transfer",
      dateRange = "month",
      startDate,
      endDate,
      categoryFilter,
      aggregationLevel = "daily",
      includeAuditTrail = false,
      includeStoreBreakdown = false,
    } = req.query;

    const userRole = req.headers["x-user-role"] || "employee";
    const userStoreAccess = req.headers["x-user-store-access"]
      ? req.headers["x-user-store-access"].split(",")
      : [];

    const payload = {
      action,
      storeId,
      storeIds: storeIds ? storeIds.split(",") : [],
      transactionTypes: transactionTypes.split(","),
      dateRange,
      startDate,
      endDate,
      categoryFilter,
      userRole,
      userStoreAccess,
      aggregationLevel,
      includeAuditTrail: includeAuditTrail === "true",
      includeStoreBreakdown: includeStoreBreakdown === "true",
    };

    const result = await invokeLambda(
      process.env.LAMBDA_TRANSACTION_ANALYTICS_FUNCTION ||
        "invencare-transaction-analytics",
      payload,
    );

    res
      .status(200)
      .json(
        createApiResponse(
          result,
          "Transaction analytics processed successfully",
        ),
      );
  } catch (error) {
    console.error("Transaction analytics error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Auto Reorder Handler
export const handleAutoReorder = async (req, res) => {
  try {
    const {
      storeId,
      forceReorder = false,
      productIds,
      supplierId,
      minimumStockMultiplier = 1.0,
      maxReorderValue = 10000,
    } = req.body;

    const payload = {
      storeId,
      forceReorder,
      productIds: productIds || [],
      supplierId,
      minimumStockMultiplier: parseFloat(minimumStockMultiplier),
      maxReorderValue: parseFloat(maxReorderValue),
    };

    const result = await invokeLambda(
      process.env.LAMBDA_AUTO_REORDER_FUNCTION || "invencare-auto-reorder",
      payload,
    );

    res
      .status(200)
      .json(createApiResponse(result, "Auto reorder analysis completed"));
  } catch (error) {
    console.error("Auto reorder error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Transaction Processor Handler
export const handleTransactionProcessor = async (req, res) => {
  try {
    const transaction = req.body.transaction;
    const userId = req.headers["x-user-id"] || req.body.userId;
    const userRole = req.headers["x-user-role"] || req.body.userRole;
    const userName = req.headers["x-user-name"] || req.body.userName;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const sessionId = req.headers["x-session-id"] || req.body.sessionId;

    if (!transaction || !userId) {
      return res
        .status(400)
        .json(
          createApiError(
            new Error("Transaction data and user ID are required"),
          ),
        );
    }

    const payload = {
      transaction,
      userId,
      userRole,
      userName,
      ipAddress,
      sessionId,
      userAgent: req.headers["user-agent"],
    };

    const result = await invokeLambda(
      process.env.LAMBDA_TRANSACTION_PROCESSOR_FUNCTION ||
        "invencare-transaction-processor",
      payload,
    );

    res
      .status(200)
      .json(createApiResponse(result, "Transaction processed successfully"));
  } catch (error) {
    console.error("Transaction processor error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Health Check for Lambda Functions
export const handleLambdaHealthCheck = async (req, res) => {
  try {
    const functions = [
      "invencare-inventory-analytics",
      "invencare-transaction-analytics",
      "invencare-auto-reorder",
      "invencare-transaction-processor",
    ];

    const healthChecks = await Promise.allSettled(
      functions.map(async (functionName) => {
        try {
          const result = await invokeLambda(functionName, {
            action: "healthcheck",
          });
          return { functionName, status: "healthy", result };
        } catch (error) {
          return { functionName, status: "unhealthy", error: error.message };
        }
      }),
    );

    const healthStatus = {
      overall: healthChecks.every((check) => check.value?.status === "healthy")
        ? "healthy"
        : "degraded",
      functions: healthChecks.map((check) => check.value),
      timestamp: new Date().toISOString(),
    };

    res
      .status(200)
      .json(createApiResponse(healthStatus, "Lambda health check completed"));
  } catch (error) {
    console.error("Lambda health check error:", error);
    res.status(500).json(createApiError(error));
  }
};
