import { sagemakerUtils, ENDPOINTS } from "../utils/sagemaker.js";
import { cognitoUtils } from "../utils/cognito.js";
import {
  successResponse,
  errorResponse,
  corsResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../utils/response.js";
import { z } from "zod";

// Validation schemas
const forecastRequestSchema = z.object({
  features: z.array(z.number()).min(1),
  timeframe: z.number().min(1).max(365),
  model_type: z.enum(["linear", "arima", "lstm"]).optional(),
  confidence_level: z.number().min(0.5).max(0.99).optional(),
  metadata: z.record(z.any()).optional(),
});

const recommendationRequestSchema = z.object({
  userId: z.string().min(1),
  itemFeatures: z.array(z.number()).min(1),
  numRecommendations: z.number().min(1).max(50).optional(),
  context: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

const batchPredictionSchema = z.object({
  requests: z
    .array(z.union([forecastRequestSchema, recommendationRequestSchema]))
    .min(1)
    .max(100),
  prediction_type: z.enum(["forecast", "recommendation"]),
});

/**
 * Generate forecasting predictions using SageMaker
 */
export const generateForecast = async (event) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return corsResponse();
    }

    // Verify authentication
    const authResult = await cognitoUtils.verifyToken(event);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error);
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      return errorResponse("Invalid JSON in request body");
    }

    const validation = forecastRequestSchema.safeParse(requestBody);
    if (!validation.success) {
      return validationErrorResponse(validation.error.errors);
    }

    const forecastData = validation.data;
    const { username } = authResult;

    // Prepare input data for SageMaker
    const sagemakerInput = sagemakerUtils.prepareForecastInput({
      ...forecastData,
      metadata: {
        ...forecastData.metadata,
        user_id: username,
        request_timestamp: new Date().toISOString(),
      },
    });

    // Invoke SageMaker endpoint
    const predictionResult = await sagemakerUtils.invokeEndpoint(
      ENDPOINTS.FORECAST,
      sagemakerInput,
    );

    if (!predictionResult.success) {
      return errorResponse(`Prediction failed: ${predictionResult.error}`, 500);
    }

    // Parse and format the prediction results
    let formattedPrediction;
    try {
      formattedPrediction = sagemakerUtils.parseForecastPrediction(
        predictionResult.prediction,
      );
    } catch (parseError) {
      console.error("Prediction parsing error:", parseError);
      return errorResponse("Failed to parse prediction results", 500);
    }

    // Log the prediction for analytics (you might want to store in DynamoDB)
    console.log("Forecast prediction generated:", {
      user_id: username,
      timeframe: forecastData.timeframe,
      num_predictions: formattedPrediction.forecasts.length,
      timestamp: new Date().toISOString(),
    });

    return successResponse(
      {
        ...formattedPrediction,
        user_id: username,
        request_data: {
          timeframe: forecastData.timeframe,
          model_type: forecastData.model_type || "default",
        },
      },
      "Forecast generated successfully",
    );
  } catch (error) {
    console.error("Generate forecast error:", error);
    return errorResponse(error.message, 500);
  }
};

/**
 * Generate recommendations using SageMaker
 */
export const generateRecommendations = async (event) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return corsResponse();
    }

    // Verify authentication
    const authResult = await cognitoUtils.verifyToken(event);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error);
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      return errorResponse("Invalid JSON in request body");
    }

    const validation = recommendationRequestSchema.safeParse(requestBody);
    if (!validation.success) {
      return validationErrorResponse(validation.error.errors);
    }

    const recommendationData = validation.data;
    const { username } = authResult;

    // Ensure the user can only get recommendations for themselves
    if (recommendationData.userId !== username) {
      return unauthorizedResponse(
        "Cannot generate recommendations for other users",
      );
    }

    // Prepare input data for SageMaker
    const sagemakerInput = sagemakerUtils.prepareRecommendationInput({
      ...recommendationData,
      metadata: {
        ...recommendationData.metadata,
        request_timestamp: new Date().toISOString(),
      },
    });

    // Invoke SageMaker endpoint
    const predictionResult = await sagemakerUtils.invokeEndpoint(
      ENDPOINTS.RECOMMENDATION,
      sagemakerInput,
    );

    if (!predictionResult.success) {
      return errorResponse(
        `Recommendation failed: ${predictionResult.error}`,
        500,
      );
    }

    // Parse and format the recommendation results
    let formattedRecommendations;
    try {
      formattedRecommendations = sagemakerUtils.parseRecommendationPrediction(
        predictionResult.prediction,
      );
    } catch (parseError) {
      console.error("Recommendation parsing error:", parseError);
      return errorResponse("Failed to parse recommendation results", 500);
    }

    // Log the recommendation for analytics
    console.log("Recommendations generated:", {
      user_id: username,
      num_recommendations: formattedRecommendations.recommendations.length,
      timestamp: new Date().toISOString(),
    });

    return successResponse(
      {
        ...formattedRecommendations,
        request_data: {
          num_requested: recommendationData.numRecommendations || 10,
        },
      },
      "Recommendations generated successfully",
    );
  } catch (error) {
    console.error("Generate recommendations error:", error);
    return errorResponse(error.message, 500);
  }
};

/**
 * Batch prediction endpoint for multiple requests
 */
export const batchPredict = async (event) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return corsResponse();
    }

    // Verify authentication
    const authResult = await cognitoUtils.verifyToken(event);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error);
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      return errorResponse("Invalid JSON in request body");
    }

    const validation = batchPredictionSchema.safeParse(requestBody);
    if (!validation.success) {
      return validationErrorResponse(validation.error.errors);
    }

    const batchData = validation.data;
    const { username } = authResult;

    // Determine which endpoint to use
    const endpoint =
      batchData.prediction_type === "forecast"
        ? ENDPOINTS.FORECAST
        : ENDPOINTS.RECOMMENDATION;

    // Prepare input data for batch prediction
    const sagemakerInputs = batchData.requests.map((request) => {
      if (batchData.prediction_type === "forecast") {
        return sagemakerUtils.prepareForecastInput({
          ...request,
          metadata: {
            ...request.metadata,
            user_id: username,
            batch_request: true,
            request_timestamp: new Date().toISOString(),
          },
        });
      } else {
        // Ensure user can only get recommendations for themselves
        if (request.userId !== username) {
          throw new Error("Cannot generate recommendations for other users");
        }

        return sagemakerUtils.prepareRecommendationInput({
          ...request,
          metadata: {
            ...request.metadata,
            batch_request: true,
            request_timestamp: new Date().toISOString(),
          },
        });
      }
    });

    // Invoke batch prediction
    const batchResult = await sagemakerUtils.batchInvokeEndpoint(
      endpoint,
      sagemakerInputs,
    );

    if (!batchResult.success) {
      return errorResponse(
        `Batch prediction failed: ${batchResult.error}`,
        500,
      );
    }

    // Parse and format results based on prediction type
    const formattedResults = batchResult.results.successful.map(
      (prediction) => {
        try {
          if (batchData.prediction_type === "forecast") {
            return sagemakerUtils.parseForecastPrediction(prediction);
          } else {
            return sagemakerUtils.parseRecommendationPrediction(prediction);
          }
        } catch (parseError) {
          return { error: "Failed to parse prediction result" };
        }
      },
    );

    // Log batch prediction for analytics
    console.log("Batch prediction completed:", {
      user_id: username,
      prediction_type: batchData.prediction_type,
      total_requests: batchData.requests.length,
      successful: batchResult.results.successCount,
      failed: batchResult.results.failureCount,
      timestamp: new Date().toISOString(),
    });

    return successResponse(
      {
        results: formattedResults,
        summary: {
          total_requests: batchResult.results.totalCount,
          successful: batchResult.results.successCount,
          failed: batchResult.results.failureCount,
          prediction_type: batchData.prediction_type,
        },
        failed_requests: batchResult.results.failed,
      },
      "Batch prediction completed",
    );
  } catch (error) {
    console.error("Batch predict error:", error);
    return errorResponse(error.message, 500);
  }
};

/**
 * Health check for ML endpoints
 */
export const healthCheck = async (event) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return corsResponse();
    }

    // Verify authentication (optional for health check)
    const authResult = await cognitoUtils.verifyToken(event);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error);
    }

    // Check health of all endpoints
    const healthChecks = await Promise.all([
      sagemakerUtils.healthCheck(ENDPOINTS.FORECAST, {
        features: [1, 2, 3],
        timeframe: 30,
      }),
      sagemakerUtils.healthCheck(ENDPOINTS.RECOMMENDATION, {
        userId: "test",
        itemFeatures: [1, 2, 3],
      }),
    ]);

    const forecastHealth = healthChecks[0];
    const recommendationHealth = healthChecks[1];

    const overallStatus =
      forecastHealth.status === "healthy" &&
      recommendationHealth.status === "healthy"
        ? "healthy"
        : "degraded";

    return successResponse(
      {
        overall_status: overallStatus,
        endpoints: {
          forecast: {
            status: forecastHealth.status,
            response_time: forecastHealth.responseTime,
            error: forecastHealth.error,
          },
          recommendation: {
            status: recommendationHealth.status,
            response_time: recommendationHealth.responseTime,
            error: recommendationHealth.error,
          },
        },
        timestamp: new Date().toISOString(),
      },
      "Health check completed",
    );
  } catch (error) {
    console.error("Health check error:", error);
    return errorResponse(error.message, 500);
  }
};
