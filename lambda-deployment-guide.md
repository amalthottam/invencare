# Lambda Function Deployment Guide

## Prerequisites

1. AWS CLI configured with appropriate permissions
2. Python 3.9 installed locally
3. Your database credentials

## Step 1: Set Environment Variables

Create a `.env` file with your credentials:

```bash
# Database Configuration
DB_HOST=your-rds-endpoint.amazonaws.com
DB_USER=admin
DB_PASSWORD=your-password
DB_NAME=inventory_management
DB_PORT=3306

# SageMaker Endpoints (will be set after training models)
LSTM_ENDPOINT_NAME=lstm-demand-forecasting-endpoint
ARIMA_ENDPOINT_NAME=arima-seasonal-forecasting-endpoint
PROPHET_ENDPOINT_NAME=prophet-forecasting-endpoint
CLASSIFICATION_ENDPOINT_NAME=product-abc-classification-endpoint

# AWS Configuration
AWS_REGION=us-east-1
```

## Step 2: Create IAM Role for Lambda

```bash
# Create trust policy
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
    --role-name lambda-ml-analytics-role \
    --assume-role-policy-document file://trust-policy.json

# Attach basic Lambda execution policy
aws iam attach-role-policy \
    --role-name lambda-ml-analytics-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create custom policy for SageMaker and RDS
cat > lambda-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "sagemaker:InvokeEndpoint",
                "sagemaker:DescribeEndpoint",
                "sagemaker:ListEndpoints"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "rds:DescribeDBInstances",
                "rds:DescribeDBClusters"
            ],
            "Resource": "*"
        }
    ]
}
EOF

# Create and attach the custom policy
aws iam create-policy \
    --policy-name lambda-ml-analytics-policy \
    --policy-document file://lambda-policy.json

aws iam attach-role-policy \
    --role-name lambda-ml-analytics-role \
    --policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/lambda-ml-analytics-policy
```

## Step 3: Deploy Lambda Function

### Manual Method:

1. **Create deployment package:**

```bash
# Create directory
mkdir lambda-package
cd lambda-package

# Copy Python file
cp ../lambda-ml-analytics-function.py .

# Install dependencies
pip install pymysql pandas numpy boto3 -t .

# Create ZIP
zip -r ../ml-analytics-lambda.zip .
cd ..
```

2. **Deploy function:**

```bash
# Get the role ARN
ROLE_ARN=$(aws iam get-role --role-name lambda-ml-analytics-role --query 'Role.Arn' --output text)

# Create function
aws lambda create-function \
    --function-name invencare-ml-analytics \
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
    }"
```

### Using the deployment script:

```bash
# Make script executable
chmod +x deploy-lambda-ml-analytics.sh

# Set environment variables and run
source .env
./deploy-lambda-ml-analytics.sh
```

## Step 4: Test Lambda Function

```bash
# Test health check
aws lambda invoke \
    --function-name invencare-ml-analytics \
    --payload '{"action": "health_check"}' \
    test-output.json

# View result
cat test-output.json
```

## Step 5: Update Express Server Environment

Add to your Express server environment variables:

```bash
LAMBDA_ML_ANALYTICS_FUNCTION=invencare-ml-analytics
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## Step 6: Verify API Endpoints

Once deployed, test these endpoints:

- `GET /api/ml/health` - Health check
- `POST /api/ml/analytics` - Main ML operations
- `GET /api/ml/dashboard` - Dashboard data

The refresh button in your forecasting page will now call these endpoints!
