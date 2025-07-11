#!/bin/bash

# InvenCare Lambda Functions Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
LAMBDA_RUNTIME="nodejs18.x"
DEPLOYMENT_BUCKET=${DEPLOYMENT_BUCKET:-}

# Function names
AUTH_FUNCTION_NAME="invencare-auth-handler"
ML_FUNCTION_NAME="invencare-ml-predict"
DATA_PROCESSOR_FUNCTION_NAME="invencare-data-processor"

echo -e "${GREEN}🚀 Starting InvenCare Lambda Functions Deployment${NC}"

# Function to print status
print_status() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if deployment bucket is set
if [ -z "$DEPLOYMENT_BUCKET" ]; then
    print_error "DEPLOYMENT_BUCKET environment variable not set"
    exit 1
fi

# Check if Lambda execution role ARN is set
if [ -z "$LAMBDA_EXECUTION_ROLE_ARN" ]; then
    print_error "LAMBDA_EXECUTION_ROLE_ARN environment variable not set"
    exit 1
fi

# Build Lambda functions
print_status "Building Lambda functions..."

cd lambda

# Install dependencies
npm install

# Create build directory
mkdir -p dist

# Build each function
print_status "Building auth handler..."
npx esbuild src/handlers/auth.js --bundle --platform=node --target=node18 --outfile=dist/auth.js --external:aws-sdk

print_status "Building ML predict handler..."
npx esbuild src/handlers/ml-predict.js --bundle --platform=node --target=node18 --outfile=dist/ml-predict.js --external:aws-sdk

# Create deployment packages
print_status "Creating deployment packages..."

# Auth function package
cd dist
zip -r auth-function.zip auth.js ../src/utils/ ../node_modules/
aws s3 cp auth-function.zip s3://$DEPLOYMENT_BUCKET/lambda/auth-function.zip

# ML function package
zip -r ml-function.zip ml-predict.js ../src/utils/ ../node_modules/
aws s3 cp ml-function.zip s3://$DEPLOYMENT_BUCKET/lambda/ml-function.zip

cd ..

print_success "Built and uploaded Lambda packages"

# Deploy Auth Lambda Function
print_status "Deploying Auth Lambda function..."

aws lambda create-function \
  --function-name $AUTH_FUNCTION_NAME \
  --runtime $LAMBDA_RUNTIME \
  --role $LAMBDA_EXECUTION_ROLE_ARN \
  --handler auth.getUserProfile \
  --code S3Bucket=$DEPLOYMENT_BUCKET,S3Key=lambda/auth-function.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables="{
    COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID,
    COGNITO_REGION=$AWS_REGION,
    DYNAMODB_USER_PROFILES_TABLE=$DYNAMODB_USER_PROFILES_TABLE
  }" \
  --region $AWS_REGION || \
aws lambda update-function-code \
  --function-name $AUTH_FUNCTION_NAME \
  --s3-bucket $DEPLOYMENT_BUCKET \
  --s3-key lambda/auth-function.zip \
  --region $AWS_REGION

# Update environment variables
aws lambda update-function-configuration \
  --function-name $AUTH_FUNCTION_NAME \
  --environment Variables="{
    COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID,
    COGNITO_REGION=$AWS_REGION,
    DYNAMODB_USER_PROFILES_TABLE=$DYNAMODB_USER_PROFILES_TABLE
  }" \
  --region $AWS_REGION

print_success "Deployed Auth Lambda function"

# Deploy ML Lambda Function
print_status "Deploying ML Lambda function..."

aws lambda create-function \
  --function-name $ML_FUNCTION_NAME \
  --runtime $LAMBDA_RUNTIME \
  --role $LAMBDA_EXECUTION_ROLE_ARN \
  --handler ml-predict.generateForecast \
  --code S3Bucket=$DEPLOYMENT_BUCKET,S3Key=lambda/ml-function.zip \
  --timeout 60 \
  --memory-size 512 \
  --environment Variables="{
    COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID,
    COGNITO_REGION=$AWS_REGION,
    SAGEMAKER_FORECAST_ENDPOINT=invencare-forecast-endpoint,
    SAGEMAKER_RECOMMENDATION_ENDPOINT=invencare-recommendation-endpoint
  }" \
  --region $AWS_REGION || \
aws lambda update-function-code \
  --function-name $ML_FUNCTION_NAME \
  --s3-bucket $DEPLOYMENT_BUCKET \
  --s3-key lambda/ml-function.zip \
  --region $AWS_REGION

# Update environment variables
aws lambda update-function-configuration \
  --function-name $ML_FUNCTION_NAME \
  --environment Variables="{
    COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID,
    COGNITO_REGION=$AWS_REGION,
    SAGEMAKER_FORECAST_ENDPOINT=invencare-forecast-endpoint,
    SAGEMAKER_RECOMMENDATION_ENDPOINT=invencare-recommendation-endpoint
  }" \
  --region $AWS_REGION

print_success "Deployed ML Lambda function"

# Create API Gateway (optional - for HTTP endpoints)
print_status "Creating API Gateway..."

API_ID=$(aws apigatewayv2 create-api \
  --name "InvenCare-API" \
  --protocol-type HTTP \
  --cors-configuration AllowOrigins="*",AllowMethods="*",AllowHeaders="*" \
  --region $AWS_REGION \
  --query 'ApiId' \
  --output text)

print_success "Created API Gateway: $API_ID"

# Create Lambda integrations
print_status "Creating Lambda integrations..."

# Auth integration
AUTH_INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id $API_ID \
  --integration-type AWS_PROXY \
  --integration-uri arn:aws:lambda:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):function:$AUTH_FUNCTION_NAME \
  --payload-format-version "2.0" \
  --region $AWS_REGION \
  --query 'IntegrationId' \
  --output text)

# ML integration
ML_INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id $API_ID \
  --integration-type AWS_PROXY \
  --integration-uri arn:aws:lambda:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):function:$ML_FUNCTION_NAME \
  --payload-format-version "2.0" \
  --region $AWS_REGION \
  --query 'IntegrationId' \
  --output text)

# Create routes
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "GET /auth/profile" \
  --target integrations/$AUTH_INTEGRATION_ID \
  --region $AWS_REGION

aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "POST /auth/profile" \
  --target integrations/$AUTH_INTEGRATION_ID \
  --region $AWS_REGION

aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "POST /ml/forecast" \
  --target integrations/$ML_INTEGRATION_ID \
  --region $AWS_REGION

aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "POST /ml/recommendations" \
  --target integrations/$ML_INTEGRATION_ID \
  --region $AWS_REGION

# Create deployment
DEPLOYMENT_ID=$(aws apigatewayv2 create-deployment \
  --api-id $API_ID \
  --region $AWS_REGION \
  --query 'DeploymentId' \
  --output text)

# Create stage
aws apigatewayv2 create-stage \
  --api-id $API_ID \
  --stage-name "prod" \
  --deployment-id $DEPLOYMENT_ID \
  --region $AWS_REGION

# Add Lambda permissions for API Gateway
aws lambda add-permission \
  --function-name $AUTH_FUNCTION_NAME \
  --statement-id "apigateway-invoke-auth" \
  --action "lambda:InvokeFunction" \
  --principal "apigateway.amazonaws.com" \
  --source-arn "arn:aws:execute-api:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/*" \
  --region $AWS_REGION

aws lambda add-permission \
  --function-name $ML_FUNCTION_NAME \
  --statement-id "apigateway-invoke-ml" \
  --action "lambda:InvokeFunction" \
  --principal "apigateway.amazonaws.com" \
  --source-arn "arn:aws:execute-api:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/*" \
  --region $AWS_REGION

print_success "Created API Gateway integrations and routes"

# Get API endpoint
API_ENDPOINT=$(aws apigatewayv2 get-api --api-id $API_ID --query 'ApiEndpoint' --output text --region $AWS_REGION)

cd ..

echo
print_success "🎉 Lambda functions deployment completed successfully!"
echo
echo -e "${YELLOW}📋 Deployment Summary:${NC}"
echo "  Auth Function: $AUTH_FUNCTION_NAME"
echo "  ML Function: $ML_FUNCTION_NAME"
echo "  API Gateway ID: $API_ID"
echo "  API Endpoint: $API_ENDPOINT/prod"
echo
echo -e "${YELLOW}📝 API Endpoints:${NC}"
echo "  GET  $API_ENDPOINT/prod/auth/profile"
echo "  POST $API_ENDPOINT/prod/auth/profile"
echo "  POST $API_ENDPOINT/prod/ml/forecast"
echo "  POST $API_ENDPOINT/prod/ml/recommendations"
echo
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "  1. Test the API endpoints"
echo "  2. Update your frontend API configuration"
echo "  3. Set up SageMaker endpoints for ML functionality"
echo "  4. Configure monitoring and logging"

# Update the deployment config with API endpoint
echo "API_GATEWAY_ENDPOINT=$API_ENDPOINT/prod" >> deployment-config.env

print_success "Updated deployment-config.env with API endpoint"
