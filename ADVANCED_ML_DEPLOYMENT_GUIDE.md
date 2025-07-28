# Advanced ML Analytics Deployment Guide

This guide provides step-by-step instructions for deploying the advanced ML forecasting system with LSTM, ARIMA, and Ensemble models on AWS SageMaker, Lambda, and API Gateway.

## Overview

The system consists of:

1. **ML Models**: LSTM, ARIMA, and Ensemble models for demand forecasting
2. **SageMaker Endpoints**: Real-time inference endpoints for each model
3. **Lambda Functions**: Bridge between your application and SageMaker
4. **API Gateway**: REST API for invoking ML predictions
5. **Frontend**: Advanced analytics dashboard with real-time visualizations

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured with your credentials
- Docker installed (for model containerization)
- Python 3.8+ with pip
- Node.js 16+ with npm

## Part 1: Prepare ML Models for SageMaker

### 1.1 Create Model Dependencies

Create a `requirements.txt` file for the ML models:

```text
# requirements.txt
tensorflow==2.13.0
scikit-learn==1.3.0
pandas==2.0.0
numpy==1.24.0
boto3==1.28.0
joblib==1.3.0
statsmodels==0.14.0
pmdarima==2.0.3
prophet==1.1.4
xgboost==1.7.0
```

### 1.2 Create Model Training Script

Create `train_model.py`:

```python
#!/usr/bin/env python3
"""
Training script for SageMaker Training Jobs
"""
import os
import sys
import json
import argparse

# Add model files to path
sys.path.append('/opt/ml/code')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-type', type=str, required=True,
                       choices=['lstm', 'arima', 'ensemble'])
    parser.add_argument('--model-dir', type=str, default=os.environ.get('SM_MODEL_DIR'))
    parser.add_argument('--train', type=str, default=os.environ.get('SM_CHANNEL_TRAINING'))
    
    args = parser.parse_args()
    
    if args.model_type == 'lstm':
        from lstm_demand_forecast import LSTMDemandForecaster
        model = LSTMDemandForecaster()
    elif args.model_type == 'arima':
        from arima_demand_forecast import ARIMADemandForecaster
        model = ARIMADemandForecaster()
    else:
        from ensemble_demand_forecast import EnsembleDemandForecaster
        model = EnsembleDemandForecaster()
    
    # Load and train
    import pandas as pd
    train_data = pd.read_csv(os.path.join(args.train, 'train.csv'))
    metrics = model.fit(train_data, args.model_dir)
    
    print(f"Training completed: {metrics}")

if __name__ == '__main__':
    main()
```

### 1.3 Create Dockerfile for SageMaker

Create `Dockerfile`:

```dockerfile
FROM python:3.8-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /opt/ml/code

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model code
COPY ml_models/ .
COPY train_model.py .

# Set environment variables
ENV PYTHONUNBUFFERED=TRUE
ENV PYTHONDONTWRITEBYTECODE=TRUE
ENV PYTHONPATH="/opt/ml/code"

# SageMaker training entry point
ENTRYPOINT ["python", "train_model.py"]
```

## Part 2: Deploy to SageMaker

### 2.1 Build and Push Docker Image

```bash
# Create ECR repository
aws ecr create-repository --repository-name ml-demand-forecasting --region us-east-1

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t ml-demand-forecasting .

# Tag and push
docker tag ml-demand-forecasting:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/ml-demand-forecasting:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/ml-demand-forecasting:latest
```

### 2.2 Create SageMaker Model Training Jobs

Create `sagemaker_training.py`:

```python
import boto3
import sagemaker
from sagemaker.estimator import Estimator

# Initialize SageMaker session
sagemaker_session = sagemaker.Session()
role = sagemaker.get_execution_role()  # Or specify your SageMaker execution role ARN

# ECR image URI
image_uri = '<account-id>.dkr.ecr.us-east-1.amazonaws.com/ml-demand-forecasting:latest'

# Training data location (upload your CSV to S3)
train_data = 's3://your-bucket/training-data/train.csv'

def train_model(model_type):
    """Train a specific model type"""
    
    estimator = Estimator(
        image_uri=image_uri,
        role=role,
        instance_count=1,
        instance_type='ml.m5.large',  # Or ml.m5.xlarge for faster training
        output_path=f's3://your-bucket/models/{model_type}',
        hyperparameters={
            'model-type': model_type
        },
        tags=[
            {'Key': 'Project', 'Value': 'DemandForecasting'},
            {'Key': 'ModelType', 'Value': model_type}
        ]
    )
    
    # Start training
    estimator.fit({'training': train_data})
    
    return estimator

# Train all models
lstm_estimator = train_model('lstm')
arima_estimator = train_model('arima')
ensemble_estimator = train_model('ensemble')

print("All models trained successfully!")
```

### 2.3 Deploy Models to Endpoints

Create `deploy_endpoints.py`:

```python
import boto3
from sagemaker.model import Model
from sagemaker.predictor import Predictor

def deploy_model(estimator, model_name, endpoint_name):
    """Deploy trained model to SageMaker endpoint"""
    
    model = estimator.create_model(
        name=model_name,
        role=role
    )
    
    predictor = model.deploy(
        initial_instance_count=1,
        instance_type='ml.t2.medium',  # Cost-effective for development
        endpoint_name=endpoint_name
    )
    
    return predictor

# Deploy all models
lstm_predictor = deploy_model(lstm_estimator, 'lstm-demand-model', 'lstm-demand-forecast-endpoint')
arima_predictor = deploy_model(arima_estimator, 'arima-demand-model', 'arima-demand-forecast-endpoint')
ensemble_predictor = deploy_model(ensemble_estimator, 'ensemble-demand-model', 'ensemble-demand-forecast-endpoint')

print("All endpoints deployed!")
print(f"LSTM Endpoint: {lstm_predictor.endpoint_name}")
print(f"ARIMA Endpoint: {arima_predictor.endpoint_name}")
print(f"Ensemble Endpoint: {ensemble_predictor.endpoint_name}")
```

## Part 3: Deploy Lambda Function

### 3.1 Package Lambda Function

```bash
# Create deployment package
mkdir lambda-deployment
cd lambda-deployment

# Copy Lambda function
cp ../lambda_functions/ml_forecasting_lambda.py .

# Install dependencies
pip install --target . boto3 pandas numpy

# Create deployment package
zip -r ml-forecasting-lambda.zip .
```

### 3.2 Create IAM Role for Lambda

Create `lambda-execution-role.json`:

```json
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
```

Create IAM role and attach policies:

```bash
# Create role
aws iam create-role \
  --role-name MLForecastingLambdaRole \
  --assume-role-policy-document file://lambda-execution-role.json

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name MLForecastingLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create custom policy for SageMaker and RDS access
cat > lambda-custom-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sagemaker:InvokeEndpoint"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "rds-data:ExecuteStatement",
        "rds-data:BatchExecuteStatement"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket/*"
    }
  ]
}
EOF

# Create and attach custom policy
aws iam create-policy \
  --policy-name MLForecastingLambdaPolicy \
  --policy-document file://lambda-custom-policy.json

aws iam attach-role-policy \
  --role-name MLForecastingLambdaRole \
  --policy-arn arn:aws:iam::<account-id>:policy/MLForecastingLambdaPolicy
```

### 3.3 Deploy Lambda Function

```bash
# Create Lambda function
aws lambda create-function \
  --function-name ml-forecasting-lambda \
  --runtime python3.9 \
  --role arn:aws:iam::<account-id>:role/MLForecastingLambdaRole \
  --handler ml_forecasting_lambda.lambda_handler \
  --zip-file fileb://ml-forecasting-lambda.zip \
  --timeout 300 \
  --memory-size 1024 \
  --environment Variables='{
    "LSTM_ENDPOINT_NAME":"lstm-demand-forecast-endpoint",
    "ARIMA_ENDPOINT_NAME":"arima-demand-forecast-endpoint",
    "ENSEMBLE_ENDPOINT_NAME":"ensemble-demand-forecast-endpoint",
    "RDS_CLUSTER_ARN":"arn:aws:rds:us-east-1:<account-id>:cluster:your-cluster",
    "RDS_SECRET_ARN":"arn:aws:secretsmanager:us-east-1:<account-id>:secret:your-secret",
    "DATABASE_NAME":"invencare",
    "S3_BUCKET_NAME":"your-bucket"
  }'
```

### 3.4 Test Lambda Function

Create `test_lambda.py`:

```python
import boto3
import json

lambda_client = boto3.client('lambda')

# Test event
test_event = {
    "operation": "generate_forecast",
    "models": ["ensemble"],
    "forecast_days": 7,
    "product_ids": ["FV-BAN-001", "DA-MLK-005"],
    "store_ids": ["store_001", "store_002"]
}

response = lambda_client.invoke(
    FunctionName='ml-forecasting-lambda',
    InvocationType='RequestResponse',
    Payload=json.dumps(test_event)
)

result = json.loads(response['Payload'].read())
print(json.dumps(result, indent=2))
```

## Part 4: Setup API Gateway

### 4.1 Create API Gateway

```bash
# Create REST API
aws apigateway create-rest-api \
  --name "ML-Forecasting-API" \
  --description "API for ML demand forecasting"

# Get API ID (replace in subsequent commands)
API_ID=$(aws apigateway get-rest-apis --query 'items[?name==`ML-Forecasting-API`].id' --output text)

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?path==`/`].id' --output text)

# Create forecasting resource
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part "forecasting"

# Get forecasting resource ID
FORECAST_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?pathPart==`forecasting`].id' --output text)

# Create POST method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $FORECAST_ID \
  --http-method POST \
  --authorization-type "NONE"

# Setup Lambda integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $FORECAST_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:<account-id>:function:ml-forecasting-lambda/invocations

# Add Lambda permission for API Gateway
aws lambda add-permission \
  --function-name ml-forecasting-lambda \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:<account-id>:$API_ID/*/*"

# Deploy API
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod

echo "API Gateway URL: https://$API_ID.execute-api.us-east-1.amazonaws.com/prod/forecasting"
```

### 4.2 Enable CORS

```bash
# Add CORS for OPTIONS method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $FORECAST_ID \
  --http-method OPTIONS \
  --authorization-type "NONE"

# Setup CORS integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $FORECAST_ID \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json": "{\"statusCode\": 200}"}'

# Add CORS headers
aws apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $FORECAST_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{
    "method.response.header.Access-Control-Allow-Headers": false,
    "method.response.header.Access-Control-Allow-Methods": false,
    "method.response.header.Access-Control-Allow-Origin": false
  }'

aws apigateway put-integration-response \
  --rest-api-id $API_ID \
  --resource-id $FORECAST_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{
    "method.response.header.Access-Control-Allow-Headers": "'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'",
    "method.response.header.Access-Control-Allow-Methods": "'"'"'GET,POST,OPTIONS'"'"'",
    "method.response.header.Access-Control-Allow-Origin": "'"'"'*'"'"'"
  }'

# Redeploy
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod
```

## Part 5: Frontend Integration

### 5.1 Update Environment Variables

Add to your `.env` file:

```bash
# ML Forecasting API
ML_API_GATEWAY_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com/prod
ML_LAMBDA_FUNCTION=ml-forecasting-lambda

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# SageMaker Endpoints
LSTM_ENDPOINT_NAME=lstm-demand-forecast-endpoint
ARIMA_ENDPOINT_NAME=arima-demand-forecast-endpoint
ENSEMBLE_ENDPOINT_NAME=ensemble-demand-forecast-endpoint
```

### 5.2 Test Frontend Integration

Create `test_frontend_integration.js`:

```javascript
// Test the ML forecasting integration
const testMLForecasting = async () => {
  try {
    const response = await fetch('/api/analytics/generate-ml-forecast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'store_001',
        modelType: 'ensemble',
        forecastDays: 7
      })
    });

    const result = await response.json();
    console.log('ML Forecasting Result:', result);
    
    if (result.success) {
      console.log('✅ ML forecasting is working!');
    } else {
      console.log('❌ ML forecasting failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
};

// Run test
testMLForecasting();
```

## Part 6: Monitoring and Maintenance

### 6.1 Setup CloudWatch Monitoring

Create CloudWatch dashboards and alarms:

```bash
# Create custom metrics for model performance
aws logs create-log-group --log-group-name /aws/lambda/ml-forecasting-lambda
aws logs create-log-group --log-group-name /aws/sagemaker/Endpoints/lstm-demand-forecast-endpoint
aws logs create-log-group --log-group-name /aws/sagemaker/Endpoints/arima-demand-forecast-endpoint
aws logs create-log-group --log-group-name /aws/sagemaker/Endpoints/ensemble-demand-forecast-endpoint
```

### 6.2 Model Retraining Pipeline

Create `model_retraining.py`:

```python
import boto3
import schedule
import time
from datetime import datetime, timedelta

def retrain_models():
    """Scheduled model retraining"""
    print(f"Starting model retraining at {datetime.now()}")
    
    # Check model performance metrics
    # If accuracy drops below threshold, trigger retraining
    
    # Example: Retrain if accuracy < 85%
    current_accuracy = get_model_accuracy()  # Implement this function
    
    if current_accuracy < 0.85:
        print("Model accuracy below threshold, triggering retraining...")
        
        # Trigger SageMaker training job
        sagemaker = boto3.client('sagemaker')
        
        training_job_name = f"demand-forecast-retrain-{int(time.time())}"
        
        response = sagemaker.create_training_job(
            TrainingJobName=training_job_name,
            RoleArn='arn:aws:iam::<account-id>:role/SageMakerRole',
            InputDataConfig=[
                {
                    'ChannelName': 'training',
                    'DataSource': {
                        'S3DataSource': {
                            'S3DataType': 'S3Prefix',
                            'S3Uri': 's3://your-bucket/latest-training-data/',
                            'S3DataDistributionType': 'FullyReplicated'
                        }
                    }
                }
            ],
            OutputDataConfig={
                'S3OutputPath': 's3://your-bucket/models/retrained/'
            },
            ResourceConfig={
                'InstanceType': 'ml.m5.large',
                'InstanceCount': 1,
                'VolumeSizeInGB': 30
            },
            StoppingCondition={
                'MaxRuntimeInSeconds': 3600
            }
        )
        
        print(f"Retraining job started: {training_job_name}")

def get_model_accuracy():
    """Get current model accuracy from CloudWatch metrics"""
    # Implement CloudWatch metrics retrieval
    return 0.92  # Mock value

# Schedule retraining weekly
schedule.every().sunday.at("02:00").do(retrain_models)

# Keep the scheduler running
while True:
    schedule.run_pending()
    time.sleep(3600)  # Check every hour
```

## Part 7: Cost Optimization

### 7.1 Implement Auto-scaling

```python
# Auto-scaling for SageMaker endpoints
import boto3

autoscaling = boto3.client('application-autoscaling')

# Register scalable target
autoscaling.register_scalable_target(
    ServiceNamespace='sagemaker',
    ResourceId='endpoint/ensemble-demand-forecast-endpoint/variant/AllTraffic',
    ScalableDimension='sagemaker:variant:DesiredInstanceCount',
    MinCapacity=1,
    MaxCapacity=3
)

# Create scaling policy
autoscaling.put_scaling_policy(
    PolicyName='EnsembleEndpointScalingPolicy',
    ServiceNamespace='sagemaker',
    ResourceId='endpoint/ensemble-demand-forecast-endpoint/variant/AllTraffic',
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

### 7.2 Scheduled Endpoint Management

```python
# Schedule to stop endpoints during low-traffic hours
import boto3
from datetime import datetime

def manage_endpoints():
    """Start/stop endpoints based on schedule"""
    sagemaker = boto3.client('sagemaker')
    current_hour = datetime.now().hour
    
    # Stop endpoints from 11 PM to 6 AM (low traffic)
    if 23 <= current_hour or current_hour <= 6:
        # Update endpoints to zero instances
        endpoints = ['lstm-demand-forecast-endpoint', 'arima-demand-forecast-endpoint']
        
        for endpoint in endpoints:
            sagemaker.update_endpoint(
                EndpointName=endpoint,
                EndpointConfigName=f'{endpoint}-config-minimal'
            )
    else:
        # Ensure endpoints are running during business hours
        for endpoint in endpoints:
            sagemaker.update_endpoint(
                EndpointName=endpoint,
                EndpointConfigName=f'{endpoint}-config-standard'
            )
```

## Part 8: Security Best Practices

### 8.1 API Authentication

Add API key authentication to API Gateway:

```bash
# Create API key
aws apigateway create-api-key \
  --name "ML-Forecasting-API-Key" \
  --description "API key for ML forecasting service" \
  --enabled

# Create usage plan
aws apigateway create-usage-plan \
  --name "ML-Forecasting-Usage-Plan" \
  --description "Usage plan for ML forecasting API" \
  --throttle burstLimit=100,rateLimit=50 \
  --quota limit=10000,period=DAY

# Associate API key with usage plan
aws apigateway create-usage-plan-key \
  --usage-plan-id <usage-plan-id> \
  --key-id <api-key-id> \
  --key-type API_KEY
```

### 8.2 VPC Configuration

For production, deploy SageMaker endpoints in VPC:

```python
# VPC configuration for SageMaker
vpc_config = {
    'SecurityGroupIds': ['sg-xxxxxxxxx'],
    'Subnets': ['subnet-xxxxxxxxx', 'subnet-yyyyyyyyy']
}

# Update model configuration
model = Model(
    image_uri=image_uri,
    model_data=model_artifacts,
    role=role,
    vpc_config=vpc_config
)
```

## Part 9: Troubleshooting

### 9.1 Common Issues

**SageMaker Endpoint Issues:**
```bash
# Check endpoint status
aws sagemaker describe-endpoint --endpoint-name lstm-demand-forecast-endpoint

# Check endpoint logs
aws logs filter-log-events \
  --log-group-name /aws/sagemaker/Endpoints/lstm-demand-forecast-endpoint \
  --start-time 1640995200000
```

**Lambda Function Issues:**
```bash
# Check Lambda logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/ml-forecasting-lambda \
  --start-time 1640995200000

# Test Lambda function
aws lambda invoke \
  --function-name ml-forecasting-lambda \
  --payload '{"operation": "health_check"}' \
  response.json
```

### 9.2 Performance Optimization

**Model Optimization:**
- Use SageMaker Model Monitor for data drift detection
- Implement A/B testing for model comparison
- Use SageMaker Batch Transform for large-scale inference

**Cost Optimization:**
- Use Spot instances for training jobs
- Implement endpoint auto-scaling
- Schedule endpoint shutdown during low-traffic hours

## Part 10: Production Checklist

Before going to production:

- [ ] Models trained and validated with production data
- [ ] All endpoints deployed and tested
- [ ] Lambda function deployed with proper error handling
- [ ] API Gateway configured with authentication
- [ ] CloudWatch monitoring and alarms setup
- [ ] VPC security configured
- [ ] Auto-scaling policies implemented
- [ ] Cost monitoring and budgets configured
- [ ] Backup and disaster recovery plan
- [ ] Model retraining pipeline tested
- [ ] Performance benchmarks established
- [ ] Security audit completed

## Support and Maintenance

For ongoing support:

1. **Monitor CloudWatch dashboards** for system health
2. **Review model performance** weekly
3. **Update training data** monthly
4. **Retrain models** when accuracy drops below 85%
5. **Update dependencies** quarterly
6. **Review AWS costs** monthly
7. **Backup model artifacts** regularly

## Cost Estimation

Estimated monthly costs for moderate usage:

- **SageMaker Endpoints**: $150-300/month (ml.t2.medium instances)
- **Lambda Functions**: $10-20/month (1M invocations)
- **API Gateway**: $5-10/month (1M requests)
- **S3 Storage**: $5-15/month (model artifacts and data)
- **CloudWatch**: $10-20/month (logs and metrics)

**Total**: ~$180-365/month

For production workloads, costs may be higher depending on traffic and instance types used.

---

This completes the comprehensive deployment guide for the Advanced ML Analytics system. The system provides production-ready demand forecasting with multiple ML models, real-time inference, and a sophisticated frontend dashboard.
