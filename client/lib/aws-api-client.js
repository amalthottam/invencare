import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} from "@aws-sdk/client-sagemaker-runtime";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  awsSDKConfig,
  lambdaFunctions,
  sagemakerEndpoints,
} from "./aws-config";

class AWSAPIClient {
  constructor() {
    this.lambdaClient = null;
    this.sagemakerClient = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Get Cognito credentials
      const session = await fetchAuthSession();
      const credentials = session.credentials;

      if (!credentials) {
        throw new Error("No AWS credentials available");
      }

      // Initialize AWS SDK clients with Cognito credentials
      this.lambdaClient = new LambdaClient({
        region: awsSDKConfig.region,
        credentials: credentials,
      });

      this.sagemakerClient = new SageMakerRuntimeClient({
        region: awsSDKConfig.region,
        credentials: credentials,
      });

      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize AWS API client:", error);
      throw error;
    }
  }

  async invokeLambda(functionName, payload) {
    await this.initialize();

    try {
      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify(payload),
        InvocationType: "RequestResponse",
      });

      const response = await this.lambdaClient.send(command);
      const responsePayload = JSON.parse(
        new TextDecoder().decode(response.Payload),
      );

      return {
        success: true,
        data: responsePayload,
        statusCode: response.StatusCode,
      };
    } catch (error) {
      console.error(`Lambda invocation failed for ${functionName}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async invokeSageMaker(endpointName, inputData) {
    await this.initialize();

    try {
      const command = new InvokeEndpointCommand({
        EndpointName: endpointName,
        ContentType: "application/json",
        Body: JSON.stringify(inputData),
      });

      const response = await this.sagemakerClient.send(command);
      const prediction = JSON.parse(new TextDecoder().decode(response.Body));

      return {
        success: true,
        prediction,
        contentType: response.ContentType,
      };
    } catch (error) {
      console.error(`SageMaker invocation failed for ${endpointName}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Authentication-related Lambda functions
  async getUserProfile() {
    return await this.invokeLambda(lambdaFunctions.userProfile, {
      action: "getUserProfile",
    });
  }

  async updateUserProfile(profileData) {
    return await this.invokeLambda(lambdaFunctions.userProfile, {
      action: "updateUserProfile",
      data: profileData,
    });
  }

  async updateUserPreferences(preferences) {
    return await this.invokeLambda(lambdaFunctions.userProfile, {
      action: "updateUserPreferences",
      data: preferences,
    });
  }

  // Machine Learning functions
  async generateForecast(forecastData) {
    return await this.invokeLambda(lambdaFunctions.mlPredict, {
      action: "generateForecast",
      data: forecastData,
    });
  }

  async generateRecommendations(recommendationData) {
    return await this.invokeLambda(lambdaFunctions.mlPredict, {
      action: "generateRecommendations",
      data: recommendationData,
    });
  }

  async batchPredict(batchData) {
    return await this.invokeLambda(lambdaFunctions.mlPredict, {
      action: "batchPredict",
      data: batchData,
    });
  }

  // Direct SageMaker endpoints
  async forecastInventory(inventoryData) {
    return await this.invokeSageMaker(sagemakerEndpoints.forecastModel, {
      features: inventoryData.features,
      timeframe: inventoryData.timeframe || 30,
      metadata: {
        inventory_type: inventoryData.type,
        ...inventoryData.metadata,
      },
    });
  }

  async getProductRecommendations(userPreferences, contextData) {
    return await this.invokeSageMaker(sagemakerEndpoints.recommendationModel, {
      user_preferences: userPreferences,
      context: contextData,
      num_recommendations: 10,
    });
  }

  // Data processing functions
  async processInventoryData(inventoryData) {
    return await this.invokeLambda(lambdaFunctions.dataProcessor, {
      action: "processInventoryData",
      data: inventoryData,
    });
  }

  async analyzeTransactions(transactionData) {
    return await this.invokeLambda(lambdaFunctions.dataProcessor, {
      action: "analyzeTransactions",
      data: transactionData,
    });
  }

  // Health check for all services
  async healthCheck() {
    const results = await Promise.allSettled([
      this.invokeLambda(lambdaFunctions.mlPredict, {
        action: "healthCheck",
      }),
      this.invokeLambda(lambdaFunctions.userProfile, {
        action: "healthCheck",
      }),
    ]);

    return {
      lambda: {
        mlPredict:
          results[0].status === "fulfilled"
            ? results[0].value
            : { success: false, error: results[0].reason },
        userProfile:
          results[1].status === "fulfilled"
            ? results[1].value
            : { success: false, error: results[1].reason },
      },
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const awsApiClient = new AWSAPIClient();
export default awsApiClient;
