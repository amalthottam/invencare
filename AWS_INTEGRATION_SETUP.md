# AWS Integration Setup Guide

This guide provides comprehensive instructions for integrating AWS Lambda, SageMaker, and Cognito with your React/Express application.

## Prerequisites

- AWS CLI installed and configured
- Node.js 18+ installed
- AWS account with appropriate permissions
- Terraform installed (optional, for Infrastructure as Code)

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   AWS Cognito   │    │   AWS Lambda    │
│                 │───▶│  Authentication │    │   Functions     │
│  - Auth UI      │    │                 │    │                 │
│  - API calls    │    │  - User Pool    │    │  - Business     │
│  - Protected    │    │  - Identity     │    │    Logic        │
│    Routes       │    │    Pool         │    │  - SageMaker    │
└─────────────────┘    └─────────────────┘    │    Integration │
                                               └─────────────────┘
                                                        │
                                               ┌─────────────────┐
                                               │  Amazon         │
                                               │  SageMaker      │
                                               │                 │
                                               │  - ML Models    │
                                               │  - Endpoints    │
                                               │  - Training     │
                                               └─────────────────┘
```

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Amazon Cognito Setup](#amazon-cognito-setup)
3. [AWS Lambda Setup](#aws-lambda-setup)
4. [Amazon SageMaker Setup](#amazon-sagemaker-setup)
5. [Frontend Integration](#frontend-integration)
6. [Backend Integration](#backend-integration)
7. [Deployment](#deployment)
8. [Security Considerations](#security-considerations)

## Environment Setup

### 1. Install Required Dependencies

```bash
npm install @aws-sdk/client-cognito-identity-provider @aws-sdk/client-lambda @aws-sdk/client-sagemaker-runtime aws-amplify amazon-cognito-identity-js
npm install --save-dev @types/aws-lambda
```

### 2. Environment Variables

Create `.env` file in your project root:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Cognito Configuration
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Lambda Configuration
LAMBDA_FUNCTION_PREFIX=fusion-app
LAMBDA_EXECUTION_ROLE_ARN=arn:aws:iam::123456789012:role/lambda-execution-role

# SageMaker Configuration
SAGEMAKER_ENDPOINT_NAME=fusion-ml-endpoint
SAGEMAKER_MODEL_NAME=fusion-ml-model
```

### 3. AWS CLI Configuration

```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, Default region, and output format
```

## Amazon Cognito Setup

### 1. Create User Pool

```bash
# Create User Pool
aws cognito-idp create-user-pool \
  --pool-name "fusion-app-users" \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false
    }
  }' \
  --auto-verified-attributes email \
  --username-attributes email \
  --schema '[
    {
      "Name": "email",
      "AttributeDataType": "String",
      "Required": true,
      "Mutable": true
    },
    {
      "Name": "name",
      "AttributeDataType": "String",
      "Required": true,
      "Mutable": true
    }
  ]'
```

### 2. Create User Pool Client

```bash
# Create User Pool Client
aws cognito-idp create-user-pool-client \
  --user-pool-id us-east-1_xxxxxxxxx \
  --client-name "fusion-app-client" \
  --generate-secret false \
  --supported-identity-providers COGNITO \
  --callback-urls "http://localhost:8080/auth/callback" \
  --logout-urls "http://localhost:8080/auth/logout" \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client true
```

### 3. Create Identity Pool

```bash
# Create Identity Pool
aws cognito-identity create-identity-pool \
  --identity-pool-name "fusion_app_identity_pool" \
  --allow-unauthenticated-identities false \
  --cognito-identity-providers ProviderName=cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxxxxxx,ClientId=xxxxxxxxxxxxxxxxxxxxxxxxxx,ServerSideTokenCheck=false
```

## AWS Lambda Setup

### 1. Create IAM Role for Lambda

```bash
# Create trust policy for Lambda
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
  --role-name fusion-lambda-execution-role \
  --assume-role-policy-document file://lambda-trust-policy.json

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name fusion-lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Attach SageMaker access policy
aws iam attach-role-policy \
  --role-name fusion-lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSageMakerReadOnly
```

### 2. Lambda Function Directory Structure

```
lambda/
├── src/
│   ├── handlers/
│   │   ├── auth.js
│   │   ├── ml-predict.js
│   │   └── user-management.js
│   ├── utils/
│   │   ├── cognito.js
│   │   ├── sagemaker.js
│   │   └── response.js
│   └── shared/
│       └── types.js
├── package.json
├── serverless.yml
└── deploy.sh
```

## Amazon SageMaker Setup

### 1. Create SageMaker Execution Role

```bash
# Create trust policy for SageMaker
cat > sagemaker-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "sagemaker.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create IAM role
aws iam create-role \
  --role-name fusion-sagemaker-execution-role \
  --assume-role-policy-document file://sagemaker-trust-policy.json

# Attach SageMaker execution policy
aws iam attach-role-policy \
  --role-name fusion-sagemaker-execution-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSageMakerFullAccess
```

### 2. Model Deployment Steps

1. **Prepare Model Artifacts**: Upload your trained model to S3
2. **Create Model**: Define the model in SageMaker
3. **Create Endpoint Configuration**: Specify instance types and scaling
4. **Deploy Endpoint**: Create the inference endpoint

## Security Considerations

### 1. IAM Policies

- Use least privilege principle
- Create specific policies for each service
- Regularly audit permissions
- Use temporary credentials when possible

### 2. API Security

- Implement proper CORS configuration
- Use API Gateway for rate limiting
- Validate all inputs
- Implement proper error handling

### 3. Environment Variables

- Never commit secrets to version control
- Use AWS Secrets Manager for sensitive data
- Rotate credentials regularly
- Use different credentials for different environments

## Next Steps

1. Follow the detailed setup instructions for each service
2. Implement the frontend authentication flow
3. Create Lambda functions for your business logic
4. Deploy and configure SageMaker endpoints
5. Test the complete integration
6. Set up monitoring and logging

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure proper CORS configuration in API Gateway
2. **Authentication Failures**: Verify Cognito configuration and tokens
3. **Lambda Timeouts**: Increase timeout settings and optimize code
4. **SageMaker Endpoint Errors**: Check model artifacts and endpoint status

### Useful Commands

```bash
# Check Cognito User Pool
aws cognito-idp describe-user-pool --user-pool-id us-east-1_xxxxxxxxx

# List Lambda functions
aws lambda list-functions

# Check SageMaker endpoints
aws sagemaker list-endpoints
```
