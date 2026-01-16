# Advanced ML Analytics Deployment Guide

This guide will walk you through deploying the LSTM and ARIMA demand forecasting models to AWS SageMaker, integrating them with Lambda functions, and exposing them through API Gateway.

## Prerequisites

1. AWS CLI configured with appropriate permissions
2. Python 3.8+ environment
3. Docker installed (for SageMaker containers)
4. AWS Account with permissions for:
   - SageMaker (model training, endpoints)
   - Lambda (function creation, execution)
   - API Gateway (REST API creation)
   - IAM (role creation)
   - S3 (model artifacts storage)
   - RDS (database access)

## Part 1: Prepare Training Data

### 1.1 Export Training Data from RDS

```sql
-- Export sales data for model training
SELECT
    trend_date as date,
    units_sold,
    revenue,
    average_price,
    ending_inventory,
    unique_customers,
    transaction_count
FROM product_sales_trends
WHERE product_id = 'your_product_id'
    AND store_id = 'your_store_id'
    AND trend_date >= DATE_SUB(CURRENT_DATE, INTERVAL 365 DAY)
ORDER BY trend_date ASC;
```

Save this data as `train.csv` with columns: date, units_sold, revenue, average_price, ending_inventory

### 1.2 Upload Training Data to S3

```bash
# Create S3 bucket for ML artifacts
aws s3 mb s3://your-ml-bucket-name

# Upload training data
aws s3 cp train.csv s3://your-ml-bucket-name/training-data/train.csv
```

## Part 2: Deploy LSTM Model to SageMaker

### 2.1 Create Requirements File

Create `ml-models/requirements.txt`:

```
tensorflow==2.13.0
pandas==1.5.3
numpy==1.24.3
scikit-learn==1.3.0
boto3==1.28.17
```

### 2.2 Create SageMaker Training Job

```python
# lstm_training_job.py
import boto3
import sagemaker
from sagemaker.tensorflow import TensorFlow

# Initialize SageMaker session
sagemaker_session = sagemaker.Session()
role = 'arn:aws:iam::YOUR_ACCOUNT:role/SageMakerExecutionRole'  # Replace with your role ARN

# Define training job
lstm_estimator = TensorFlow(
    entry_point='lstm_demand_forecast.py',
    source_dir='ml-models',
    role=role,
    instance_count=1,
    instance_type='ml.m5.large',
    framework_version='2.13',
    py_version='py39',
    hyperparameters={
        'epochs': 100,
        'batch-size': 32,
        'sequence-length': 30,
        'forecast-horizon': 14
    }
)

# Start training
lstm_estimator.fit({'train': 's3://your-ml-bucket-name/training-data/'})

# Deploy model
lstm_predictor = lstm_estimator.deploy(
    initial_instance_count=1,
    instance_type='ml.m5.large',
    endpoint_name='lstm-demand-forecast'
)

print(f"LSTM Model deployed to endpoint: {lstm_predictor.endpoint_name}")
```

### 2.3 Run LSTM Training

```bash
cd ml-models
python lstm_training_job.py
```

## Part 3: Deploy ARIMA Model to SageMaker

### 3.1 Create ARIMA Requirements

Add to `ml-models/requirements.txt`:

```
statsmodels==0.14.0
```

### 3.2 Create ARIMA Training Job

```python
# arima_training_job.py
import boto3
import sagemaker
from sagemaker.sklearn import SKLearn

sagemaker_session = sagemaker.Session()
role = 'arn:aws:iam::YOUR_ACCOUNT:role/SageMakerExecutionRole'

# Define ARIMA training job
arima_estimator = SKLearn(
    entry_point='arima_demand_forecast.py',
    source_dir='ml-models',
    role=role,
    instance_count=1,
    instance_type='ml.m5.large',
    framework_version='1.0-1',
    py_version='py3',
    hyperparameters={
        'seasonal-periods': 7,
        'auto-arima': True
    }
)

# Start training
arima_estimator.fit({'train': 's3://your-ml-bucket-name/training-data/'})

# Deploy model
arima_predictor = arima_estimator.deploy(
    initial_instance_count=1,
    instance_type='ml.m5.large',
    endpoint_name='arima-demand-forecast'
)

print(f"ARIMA Model deployed to endpoint: {arima_predictor.endpoint_name}")
```

### 3.3 Run ARIMA Training

```bash
python arima_training_job.py
```

## Part 4: Create IAM Roles and Policies

### 4.1 Lambda Execution Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": ["sagemaker:InvokeEndpoint"],
      "Resource": [
        "arn:aws:sagemaker:*:*:endpoint/lstm-demand-forecast",
        "arn:aws:sagemaker:*:*:endpoint/arima-demand-forecast"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "rds-data:ExecuteStatement",
        "rds-data:BatchExecuteStatement",
        "rds-data:BeginTransaction",
        "rds-data:CommitTransaction",
        "rds-data:RollbackTransaction"
      ],
      "Resource": "arn:aws:rds:*:*:cluster:your-rds-cluster"
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:*:*:secret:your-rds-secret*"
    }
  ]
}
```

### 4.2 Create the Role

```bash
# Create trust policy
cat > lambda-trust-policy.json << EOF
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

# Create IAM role
aws iam create-role \
    --role-name MLAnalyticsLambdaRole \
    --assume-role-policy-document file://lambda-trust-policy.json

# Attach policies
aws iam attach-role-policy \
    --role-name MLAnalyticsLambdaRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create and attach custom policy (save the JSON above as ml-lambda-policy.json)
aws iam create-policy \
    --policy-name MLAnalyticsLambdaPolicy \
    --policy-document file://ml-lambda-policy.json

aws iam attach-role-policy \
    --role-name MLAnalyticsLambdaRole \
    --policy-arn arn:aws:iam::YOUR_ACCOUNT:policy/MLAnalyticsLambdaPolicy
```

## Part 5: Deploy Lambda Function

### 5.1 Prepare Lambda Package

```bash
# Create deployment package
mkdir lambda-deployment
cd lambda-deployment

# Copy Lambda function
cp ../aws-lambda/ml_integration.py lambda_function.py

# Install dependencies
pip install boto3 pandas numpy -t .

# Create deployment package
zip -r ml-analytics-lambda.zip .
```

### 5.2 Deploy Lambda Function

```bash
# Create Lambda function
aws lambda create-function \
    --function-name ml-analytics-integration \
    --runtime python3.9 \
    --role arn:aws:iam::YOUR_ACCOUNT:role/MLAnalyticsLambdaRole \
    --handler lambda_function.lambda_handler \
    --zip-file fileb://ml-analytics-lambda.zip \
    --timeout 300 \
    --memory-size 512 \
    --environment Variables='{
        "LSTM_SAGEMAKER_ENDPOINT":"lstm-demand-forecast",
        "ARIMA_SAGEMAKER_ENDPOINT":"arima-demand-forecast",
        "RDS_CLUSTER_ARN":"arn:aws:rds:REGION:ACCOUNT:cluster/your-cluster",
        "RDS_SECRET_ARN":"arn:aws:secretsmanager:REGION:ACCOUNT:secret:your-secret",
        "DATABASE_NAME":"your_database"
    }'
```

### 5.3 Test Lambda Function

```bash
# Create test event
cat > test-event.json << EOF
{
    "httpMethod": "POST",
    "path": "/ml/demand-forecast",
    "body": "{\"product_id\":\"prod_001\",\"store_id\":\"store_001\",\"steps_ahead\":14}"
}
EOF

# Test function
aws lambda invoke \
    --function-name ml-analytics-integration \
    --payload file://test-event.json \
    response.json

cat response.json
```

## Part 6: Create API Gateway

### 6.1 Create REST API

```bash
# Create API
API_ID=$(aws apigateway create-rest-api \
    --name ml-analytics-api \
    --description "ML Analytics API for demand forecasting" \
    --query 'id' --output text)

echo "Created API: $API_ID"

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --query 'items[0].id' --output text)

# Create 'ml' resource
ML_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_ID \
    --path-part ml \
    --query 'id' --output text)
```

### 6.2 Create API Resources and Methods

```bash
# Create demand-forecast resource
FORECAST_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ML_RESOURCE_ID \
    --path-part demand-forecast \
    --query 'id' --output text)

# Create POST method for demand forecast
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $FORECAST_RESOURCE_ID \
    --http-method POST \
    --authorization-type NONE

# Create model-performance resource
PERFORMANCE_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ML_RESOURCE_ID \
    --path-part model-performance \
    --query 'id' --output text)

# Create GET method for model performance
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $PERFORMANCE_RESOURCE_ID \
    --http-method GET \
    --authorization-type NONE

# Create anomaly-detection resource
ANOMALY_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ML_RESOURCE_ID \
    --path-part anomaly-detection \
    --query 'id' --output text)

# Create POST method for anomaly detection
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $ANOMALY_RESOURCE_ID \
    --http-method POST \
    --authorization-type NONE

# Create prescriptive-insights resource
INSIGHTS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ML_RESOURCE_ID \
    --path-part prescriptive-insights \
    --query 'id' --output text)

# Create POST method for prescriptive insights
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $INSIGHTS_RESOURCE_ID \
    --http-method POST \
    --authorization-type NONE
```

### 6.3 Configure Lambda Integration

```bash
# Get Lambda function ARN
LAMBDA_ARN=$(aws lambda get-function \
    --function-name ml-analytics-integration \
    --query 'Configuration.FunctionArn' --output text)

# Configure integration for each method
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $FORECAST_RESOURCE_ID \
    --http-method POST \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations

aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $PERFORMANCE_RESOURCE_ID \
    --http-method GET \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations

aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $ANOMALY_RESOURCE_ID \
    --http-method POST \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations

aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $INSIGHTS_RESOURCE_ID \
    --http-method POST \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations
```

### 6.4 Grant API Gateway Permission to Invoke Lambda

```bash
aws lambda add-permission \
    --function-name ml-analytics-integration \
    --statement-id api-gateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:us-east-1:YOUR_ACCOUNT:$API_ID/*/*"
```

### 6.5 Deploy API

```bash
# Create deployment
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod

echo "API Gateway URL: https://$API_ID.execute-api.us-east-1.amazonaws.com/prod"
```

## Part 7: Configure Environment Variables

### 7.1 Update Your Application Environment

Add to your `.env` file or environment variables:

```bash
ML_LAMBDA_BASE_URL=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod
LSTM_SAGEMAKER_ENDPOINT=lstm-demand-forecast
ARIMA_SAGEMAKER_ENDPOINT=arima-demand-forecast
```

### 7.2 Update Lambda Environment Variables

```bash
aws lambda update-function-configuration \
    --function-name ml-analytics-integration \
    --environment Variables='{
        "LSTM_SAGEMAKER_ENDPOINT":"lstm-demand-forecast",
        "ARIMA_SAGEMAKER_ENDPOINT":"arima-demand-forecast",
        "RDS_CLUSTER_ARN":"arn:aws:rds:REGION:ACCOUNT:cluster/your-cluster",
        "RDS_SECRET_ARN":"arn:aws:secretsmanager:REGION:ACCOUNT:secret:your-secret",
        "DATABASE_NAME":"your_database"
    }'
```

## Part 8: Testing the Complete Pipeline

### 8.1 Test SageMaker Endpoints Directly

```python
import boto3
import json

runtime = boto3.client('sagemaker-runtime')

# Test LSTM endpoint
lstm_payload = {
    "data": [
        {"date": "2024-01-01", "units_sold": 25, "revenue": 500.0},
        {"date": "2024-01-02", "units_sold": 30, "revenue": 600.0}
        # ... more historical data
    ],
    "steps_ahead": 14
}

response = runtime.invoke_endpoint(
    EndpointName='lstm-demand-forecast',
    ContentType='application/json',
    Body=json.dumps(lstm_payload)
)

result = json.loads(response['Body'].read().decode())
print("LSTM Forecast:", result)
```

### 8.2 Test API Gateway Endpoints

```bash
# Test demand forecast
curl -X POST \
  https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/ml/demand-forecast \
  -H 'Content-Type: application/json' \
  -d '{
    "product_id": "prod_001",
    "store_id": "store_001",
    "steps_ahead": 14,
    "model": "ensemble"
  }'

# Test model performance
curl -X GET \
  https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/ml/model-performance

# Test anomaly detection
curl -X POST \
  https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/ml/anomaly-detection \
  -H 'Content-Type: application/json' \
  -d '{
    "store_id": "store_001",
    "period": 30
  }'
```

### 8.3 Test Frontend Integration

Update your React app's API calls to use the new endpoints:

```javascript
// In your AdvancedAnalytics component
const response = await fetch(
  "/api/ml/demand-forecast/prod_001/store_001?model=ensemble&steps_ahead=14",
  {
    method: "POST",
  },
);
const data = await response.json();
```

## Part 9: Monitoring and Maintenance

### 9.1 Set Up CloudWatch Monitoring

```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
    --dashboard-name ML-Analytics-Dashboard \
    --dashboard-body file://dashboard-config.json
```

### 9.2 Configure Alarms

```bash
# SageMaker endpoint errors
aws cloudwatch put-metric-alarm \
    --alarm-name "LSTM-Endpoint-Errors" \
    --alarm-description "Monitor LSTM endpoint errors" \
    --metric-name ModelLatency \
    --namespace AWS/SageMaker \
    --statistic Average \
    --period 300 \
    --threshold 5000 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=EndpointName,Value=lstm-demand-forecast \
    --evaluation-periods 2

# Lambda function errors
aws cloudwatch put-metric-alarm \
    --alarm-name "Lambda-ML-Errors" \
    --alarm-description "Monitor Lambda function errors" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=FunctionName,Value=ml-analytics-integration \
    --evaluation-periods 2
```

## Part 10: Cost Optimization

### 10.1 Auto Scaling for SageMaker Endpoints

```python
# Configure auto scaling for endpoints
client = boto3.client('application-autoscaling')

# Register scalable target
client.register_scalable_target(
    ServiceNamespace='sagemaker',
    ResourceId='endpoint/lstm-demand-forecast/variant/AllTraffic',
    ScalableDimension='sagemaker:variant:DesiredInstanceCount',
    MinCapacity=1,
    MaxCapacity=3
)

# Create scaling policy
client.put_scaling_policy(
    PolicyName='lstm-scaling-policy',
    ServiceNamespace='sagemaker',
    ResourceId='endpoint/lstm-demand-forecast/variant/AllTraffic',
    ScalableDimension='sagemaker:variant:DesiredInstanceCount',
    PolicyType='TargetTrackingScaling',
    TargetTrackingScalingPolicyConfiguration={
        'TargetValue': 70.0,
        'PredefinedMetricSpecification': {
            'PredefinedMetricType': 'SageMakerVariantInvocationsPerInstance'
        }
    }
)
```

### 10.2 Scheduled Scaling for Development

```bash
# Scale down endpoints during off-hours (optional for cost saving)
aws events put-rule \
    --name scale-down-ml-endpoints \
    --schedule-expression "cron(0 18 * * ? *)" \
    --description "Scale down ML endpoints at 6 PM UTC"
```

## Troubleshooting

### Common Issues and Solutions

1. **SageMaker Training Job Fails**

   - Check CloudWatch logs: `/aws/sagemaker/TrainingJobs`
   - Verify training data format and S3 permissions
   - Ensure sufficient instance limits

2. **Lambda Function Timeout**

   - Increase timeout to 5 minutes
   - Optimize model inference code
   - Consider using asynchronous processing

3. **API Gateway 502 Errors**

   - Check Lambda function logs
   - Verify Lambda permissions
   - Ensure proper response format

4. **SageMaker Endpoint Not Responding**
   - Check endpoint status in SageMaker console
   - Verify model artifacts in S3
   - Check CloudWatch metrics

### Cost Estimates

- **SageMaker Training**: ~$2-10 per training job (ml.m5.large)
- **SageMaker Inference**: ~$70/month per endpoint (ml.m5.large, 24/7)
- **Lambda**: ~$0.20 per 1M requests
- **API Gateway**: ~$3.50 per 1M requests
- **Data Transfer**: Varies based on usage

### Next Steps

1. Implement model retraining pipeline
2. Add A/B testing for model variants
3. Set up data drift detection
4. Implement batch prediction for efficiency
5. Add model interpretability features

This completes the deployment of your advanced ML analytics system with SageMaker, Lambda, and API Gateway integration.
