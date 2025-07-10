import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} from "@aws-sdk/client-sagemaker-runtime";

const sagemakerClient = new SageMakerRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
});

export class SageMakerUtils {
  constructor() {
    this.client = sagemakerClient;
  }

  /**
   * Invoke a SageMaker endpoint for predictions
   */
  async invokeEndpoint(
    endpointName,
    inputData,
    contentType = "application/json",
  ) {
    try {
      let body;

      // Prepare the input data based on content type
      if (contentType === "application/json") {
        body = JSON.stringify(inputData);
      } else {
        body = inputData;
      }

      const command = new InvokeEndpointCommand({
        EndpointName: endpointName,
        ContentType: contentType,
        Body: body,
      });

      const response = await this.client.send(command);

      // Parse the response body
      const responseBody = new TextDecoder().decode(response.Body);

      let prediction;
      try {
        prediction = JSON.parse(responseBody);
      } catch (parseError) {
        // If it's not JSON, return as text
        prediction = responseBody;
      }

      return {
        success: true,
        prediction,
        contentType: response.ContentType,
        invokedProductionVariant: response.InvokedProductionVariant,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: error.name,
      };
    }
  }

  /**
   * Prepare input data for forecasting models
   */
  prepareForecastInput(data) {
    // Validate required fields for forecasting
    const requiredFields = ["features", "timeframe"];

    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return {
      instances: [
        {
          features: data.features,
          timeframe: data.timeframe,
          metadata: {
            timestamp: new Date().toISOString(),
            version: "1.0",
            ...data.metadata,
          },
        },
      ],
    };
  }

  /**
   * Prepare input data for recommendation models
   */
  prepareRecommendationInput(data) {
    // Validate required fields for recommendations
    const requiredFields = ["userId", "itemFeatures"];

    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return {
      instances: [
        {
          user_id: data.userId,
          item_features: data.itemFeatures,
          context: data.context || {},
          num_recommendations: data.numRecommendations || 10,
          metadata: {
            timestamp: new Date().toISOString(),
            version: "1.0",
            ...data.metadata,
          },
        },
      ],
    };
  }

  /**
   * Parse and validate forecasting predictions
   */
  parseForecastPrediction(prediction) {
    try {
      if (prediction.predictions && Array.isArray(prediction.predictions)) {
        return {
          forecasts: prediction.predictions.map((pred) => ({
            timestamp: pred.timestamp,
            value: pred.value,
            confidence: pred.confidence || null,
            upper_bound: pred.upper_bound || null,
            lower_bound: pred.lower_bound || null,
          })),
          metadata: prediction.metadata || {},
        };
      }

      throw new Error("Invalid prediction format");
    } catch (error) {
      throw new Error(`Failed to parse forecast prediction: ${error.message}`);
    }
  }

  /**
   * Parse and validate recommendation predictions
   */
  parseRecommendationPrediction(prediction) {
    try {
      if (
        prediction.recommendations &&
        Array.isArray(prediction.recommendations)
      ) {
        return {
          recommendations: prediction.recommendations.map((rec) => ({
            item_id: rec.item_id,
            score: rec.score,
            rank: rec.rank || null,
            metadata: rec.metadata || {},
          })),
          user_id: prediction.user_id,
          metadata: prediction.metadata || {},
        };
      }

      throw new Error("Invalid recommendation format");
    } catch (error) {
      throw new Error(
        `Failed to parse recommendation prediction: ${error.message}`,
      );
    }
  }

  /**
   * Batch invoke endpoint for multiple predictions
   */
  async batchInvokeEndpoint(
    endpointName,
    inputDataArray,
    contentType = "application/json",
  ) {
    try {
      const predictions = await Promise.all(
        inputDataArray.map((inputData) =>
          this.invokeEndpoint(endpointName, inputData, contentType),
        ),
      );

      const successful = predictions.filter((p) => p.success);
      const failed = predictions.filter((p) => !p.success);

      return {
        success: true,
        results: {
          successful: successful.map((p) => p.prediction),
          failed: failed.map((p) => ({
            error: p.error,
            errorCode: p.errorCode,
          })),
          successCount: successful.length,
          failureCount: failed.length,
          totalCount: predictions.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate endpoint health by making a test prediction
   */
  async healthCheck(endpointName, testData = {}) {
    try {
      const startTime = Date.now();

      const result = await this.invokeEndpoint(endpointName, testData);

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        endpointName,
        status: result.success ? "healthy" : "unhealthy",
        responseTime,
        timestamp: new Date().toISOString(),
        error: result.success ? null : result.error,
      };
    } catch (error) {
      return {
        success: false,
        endpointName,
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export default instance
export const sagemakerUtils = new SageMakerUtils();

// Export endpoint constants
export const ENDPOINTS = {
  FORECAST:
    process.env.SAGEMAKER_FORECAST_ENDPOINT || "fusion-forecast-endpoint",
  RECOMMENDATION:
    process.env.SAGEMAKER_RECOMMENDATION_ENDPOINT ||
    "fusion-recommendation-endpoint",
  ANOMALY_DETECTION:
    process.env.SAGEMAKER_ANOMALY_ENDPOINT || "fusion-anomaly-endpoint",
};
