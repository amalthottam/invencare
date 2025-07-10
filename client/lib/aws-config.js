import { Amplify } from "aws-amplify";

// AWS Amplify Configuration
export const awsConfig = {
  Auth: {
    Cognito: {
      region: import.meta.env.VITE_AWS_REGION || "us-east-1",
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN,
          scopes: ["phone", "email", "profile", "openid"],
          redirectSignIn: ["http://localhost:8080/auth/callback"],
          redirectSignOut: ["http://localhost:8080/auth/logout"],
          responseType: "code",
        },
        username: true,
        email: true,
      },
    },
  },
  API: {
    REST: {
      "fusion-api": {
        endpoint:
          import.meta.env.VITE_API_ENDPOINT || "http://localhost:8080/api",
        region: import.meta.env.VITE_AWS_REGION || "us-east-1",
      },
    },
  },
};

// AWS SDK Configuration for direct service calls
export const awsSDKConfig = {
  region: import.meta.env.VITE_AWS_REGION || "us-east-1",
  credentials: undefined, // Will be set by Cognito
};

// Lambda function names
export const lambdaFunctions = {
  userProfile:
    import.meta.env.VITE_LAMBDA_USER_PROFILE || "fusion-user-profile",
  mlPredict: import.meta.env.VITE_LAMBDA_ML_PREDICT || "fusion-ml-predict",
  dataProcessor:
    import.meta.env.VITE_LAMBDA_DATA_PROCESSOR || "fusion-data-processor",
};

// SageMaker endpoints
export const sagemakerEndpoints = {
  forecastModel:
    import.meta.env.VITE_SAGEMAKER_FORECAST_ENDPOINT ||
    "fusion-forecast-endpoint",
  recommendationModel:
    import.meta.env.VITE_SAGEMAKER_RECOMMENDATION_ENDPOINT ||
    "fusion-recommendation-endpoint",
};

// Initialize Amplify
Amplify.configure(awsConfig);

export default awsConfig;
