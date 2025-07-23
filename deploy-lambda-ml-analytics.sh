#!/bin/bash

# Deployment script for Unified ML Analytics Lambda Function
# Make sure you have AWS CLI configured with appropriate permissions

FUNCTION_NAME="invencare-ml-analytics"
REGION="us-east-1"
ROLE_ARN="arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role"

echo "🚀 Deploying Unified ML Analytics Lambda Function..."

# Create deployment package
echo "📦 Creating deployment package..."
mkdir -p lambda-deployment
cp lambda-ml-analytics-function.py lambda-deployment/
cd lambda-deployment

# Install dependencies
echo "📥 Installing dependencies..."
pip install pymysql pandas numpy boto3 -t .

# Create ZIP package
echo "🗜️ Creating ZIP package..."
zip -r ../ml-analytics-lambda.zip .
cd ..

# Check if function exists
FUNCTION_EXISTS=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "🔄 Updating existing function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://ml-analytics-lambda.zip \
        --region $REGION
    
    echo "⚙️ Updating function configuration..."
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --timeout 900 \
        --memory-size 512 \
        --environment Variables="{
            DB_HOST=$DB_HOST,
            DB_USER=$DB_USER,
            DB_PASSWORD=$DB_PASSWORD,
            DB_NAME=$DB_NAME,
            DB_PORT=$DB_PORT,
            LSTM_ENDPOINT_NAME=$LSTM_ENDPOINT_NAME,
            ARIMA_ENDPOINT_NAME=$ARIMA_ENDPOINT_NAME,
            PROPHET_ENDPOINT_NAME=$PROPHET_ENDPOINT_NAME,
            CLASSIFICATION_ENDPOINT_NAME=$CLASSIFICATION_ENDPOINT_NAME
        }" \
        --region $REGION
else
    echo "🆕 Creating new function..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime python3.9 \
        --role $ROLE_ARN \
        --handler lambda-ml-analytics-function.lambda_handler \
        --zip-file fileb://ml-analytics-lambda.zip \
        --timeout 900 \
        --memory-size 512 \
        --environment Variables="{
            DB_HOST=$DB_HOST,
            DB_USER=$DB_USER,
            DB_PASSWORD=$DB_PASSWORD,
            DB_NAME=$DB_NAME,
            DB_PORT=$DB_PORT,
            LSTM_ENDPOINT_NAME=$LSTM_ENDPOINT_NAME,
            ARIMA_ENDPOINT_NAME=$ARIMA_ENDPOINT_NAME,
            PROPHET_ENDPOINT_NAME=$PROPHET_ENDPOINT_NAME,
            CLASSIFICATION_ENDPOINT_NAME=$CLASSIFICATION_ENDPOINT_NAME
        }" \
        --region $REGION
fi

# Test the function
echo "🧪 Testing function..."
aws lambda invoke \
    --function-name $FUNCTION_NAME \
    --payload '{"action": "health_check"}' \
    --region $REGION \
    test-output.json

echo "📋 Test result:"
cat test-output.json

# Cleanup
echo "🧹 Cleaning up..."
rm -rf lambda-deployment
rm ml-analytics-lambda.zip
rm test-output.json

echo "✅ Deployment complete!"
echo ""
echo "Environment Variables to set in your Express server:"
echo "LAMBDA_ML_ANALYTICS_FUNCTION=$FUNCTION_NAME"
echo "AWS_REGION=$REGION"
echo ""
echo "API Endpoints now available:"
echo "POST /api/ml/analytics - Unified ML operations"
echo "GET  /api/ml/predictions/:product_id/:store_id - Get stored predictions"
echo "GET  /api/ml/dashboard - ML dashboard data"
echo "POST /api/ml/predict - Real-time predictions"
echo "GET  /api/ml/health - Health check"
