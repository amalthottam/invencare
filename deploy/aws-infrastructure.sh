#!/bin/bash

# InvenCare AWS Infrastructure Deployment Script
# This script sets up the complete AWS infrastructure for InvenCare

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
APP_NAME="InvenCare"
STACK_NAME="invencare-infrastructure"
USER_POOL_NAME="InvenCare-Users"
IDENTITY_POOL_NAME="InvenCare_Identity_Pool"

echo -e "${GREEN}🚀 Starting InvenCare AWS Infrastructure Deployment${NC}"

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

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

# Check if AWS is configured
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

print_success "AWS CLI configured and ready"

# Create S3 bucket for deployment artifacts
print_status "Creating S3 bucket for deployment artifacts..."
BUCKET_NAME="invencare-deployment-artifacts-$(date +%s)"
aws s3 mb s3://$BUCKET_NAME --region $AWS_REGION
print_success "Created S3 bucket: $BUCKET_NAME"

# Create Cognito User Pool
print_status "Creating Cognito User Pool..."
USER_POOL_OUTPUT=$(aws cognito-idp create-user-pool \
  --pool-name "$USER_POOL_NAME" \
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
  --account-recovery-setting '{
    "RecoveryMechanisms": [
      {
        "Name": "verified_email",
        "Priority": 1
      }
    ]
  }' \
  --user-attribute-update-settings '{
    "AttributesRequireVerificationBeforeUpdate": ["email"]
  }' \
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
    },
    {
      "Name": "role",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "department",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "company",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    }
  ]' \
  --region $AWS_REGION)

USER_POOL_ID=$(echo $USER_POOL_OUTPUT | jq -r '.UserPool.Id')
print_success "Created User Pool: $USER_POOL_ID"

# Create User Pool Client
print_status "Creating User Pool Client..."
CLIENT_OUTPUT=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name "InvenCare-Web-Client" \
  --generate-secret false \
  --supported-identity-providers COGNITO \
  --callback-urls "http://localhost:8080/auth/callback,https://invencare.yourdomain.com/auth/callback" \
  --logout-urls "http://localhost:8080/auth/logout,https://invencare.yourdomain.com/auth/logout" \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client true \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_PASSWORD_AUTH \
  --prevent-user-existence-errors ENABLED \
  --region $AWS_REGION)

CLIENT_ID=$(echo $CLIENT_OUTPUT | jq -r '.UserPoolClient.ClientId')
print_success "Created User Pool Client: $CLIENT_ID"

# Create Identity Pool
print_status "Creating Identity Pool..."
IDENTITY_POOL_OUTPUT=$(aws cognito-identity create-identity-pool \
  --identity-pool-name "$IDENTITY_POOL_NAME" \
  --allow-unauthenticated-identities false \
  --cognito-identity-providers ProviderName=cognito-idp.$AWS_REGION.amazonaws.com/$USER_POOL_ID,ClientId=$CLIENT_ID,ServerSideTokenCheck=false \
  --region $AWS_REGION)

IDENTITY_POOL_ID=$(echo $IDENTITY_POOL_OUTPUT | jq -r '.IdentityPoolId')
print_success "Created Identity Pool: $IDENTITY_POOL_ID"

# Create IAM roles for Cognito
print_status "Creating IAM roles..."

# Authenticated role trust policy
cat > /tmp/cognito-authenticated-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "$IDENTITY_POOL_ID"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "authenticated"
        }
      }
    }
  ]
}
EOF

# Create authenticated role
aws iam create-role \
  --role-name InvenCare-Cognito-Authenticated-Role \
  --assume-role-policy-document file:///tmp/cognito-authenticated-trust-policy.json \
  --region $AWS_REGION

# Create policy for authenticated users
cat > /tmp/invencare-user-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::invencare-user-data/\${cognito-identity.amazonaws.com:sub}/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:$AWS_REGION:*:function:invencare-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "sagemaker:InvokeEndpoint"
      ],
      "Resource": [
        "arn:aws:sagemaker:$AWS_REGION:*:endpoint/invencare-*"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name InvenCare-Cognito-Authenticated-Role \
  --policy-name InvenCareUserPolicy \
  --policy-document file:///tmp/invencare-user-policy.json

# Set Identity Pool roles
AUTH_ROLE_ARN=$(aws iam get-role --role-name InvenCare-Cognito-Authenticated-Role --query 'Role.Arn' --output text)

aws cognito-identity set-identity-pool-roles \
  --identity-pool-id $IDENTITY_POOL_ID \
  --roles authenticated=$AUTH_ROLE_ARN \
  --region $AWS_REGION

print_success "Created IAM roles and policies"

# Create Lambda execution role
print_status "Creating Lambda execution role..."

cat > /tmp/lambda-trust-policy.json << EOF
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

aws iam create-role \
  --role-name InvenCare-Lambda-Execution-Role \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name InvenCare-Lambda-Execution-Role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Attach additional policies
aws iam attach-role-policy \
  --role-name InvenCare-Lambda-Execution-Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonCognitoPowerUser

aws iam attach-role-policy \
  --role-name InvenCare-Lambda-Execution-Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSageMakerReadOnly

print_success "Created Lambda execution role"

# Create DynamoDB tables for InvenCare data
print_status "Creating DynamoDB tables..."

# User profiles table
aws dynamodb create-table \
  --table-name InvenCare-UserProfiles \
  --attribute-definitions \
    AttributeName=user_id,AttributeType=S \
  --key-schema \
    AttributeName=user_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $AWS_REGION

# Products table
aws dynamodb create-table \
  --table-name InvenCare-Products \
  --attribute-definitions \
    AttributeName=product_id,AttributeType=S \
    AttributeName=user_id,AttributeType=S \
  --key-schema \
    AttributeName=product_id,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=UserIdIndex,KeySchema=[{AttributeName=user_id,KeyType=HASH}],Projection={ProjectionType=ALL} \
  --billing-mode PAY_PER_REQUEST \
  --region $AWS_REGION

# Transactions table
aws dynamodb create-table \
  --table-name InvenCare-Transactions \
  --attribute-definitions \
    AttributeName=transaction_id,AttributeType=S \
    AttributeName=user_id,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=transaction_id,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=UserIdTimestampIndex,KeySchema=[{AttributeName=user_id,KeyType=HASH},{AttributeName=timestamp,KeyType=RANGE}],Projection={ProjectionType=ALL} \
  --billing-mode PAY_PER_REQUEST \
  --region $AWS_REGION

print_success "Created DynamoDB tables"

# Create S3 bucket for user data
print_status "Creating S3 bucket for user data..."
USER_DATA_BUCKET="invencare-user-data-$(aws sts get-caller-identity --query Account --output text)"
aws s3 mb s3://$USER_DATA_BUCKET --region $AWS_REGION

# Set CORS for S3 bucket
cat > /tmp/cors-config.json << EOF
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["http://localhost:8080", "https://invencare.yourdomain.com"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}
EOF

aws s3api put-bucket-cors --bucket $USER_DATA_BUCKET --cors-configuration file:///tmp/cors-config.json

print_success "Created S3 bucket for user data: $USER_DATA_BUCKET"

# Generate environment configuration
print_status "Generating environment configuration..."

cat > deployment-config.env << EOF
# AWS Configuration
AWS_REGION=$AWS_REGION
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Cognito Configuration
VITE_AWS_REGION=$AWS_REGION
VITE_COGNITO_USER_POOL_ID=$USER_POOL_ID
VITE_COGNITO_USER_POOL_CLIENT_ID=$CLIENT_ID
VITE_COGNITO_IDENTITY_POOL_ID=$IDENTITY_POOL_ID

# Backend Configuration
COGNITO_USER_POOL_ID=$USER_POOL_ID
COGNITO_USER_POOL_CLIENT_ID=$CLIENT_ID
COGNITO_REGION=$AWS_REGION

# S3 Configuration
USER_DATA_BUCKET=$USER_DATA_BUCKET
DEPLOYMENT_BUCKET=$BUCKET_NAME

# DynamoDB Tables
DYNAMODB_USER_PROFILES_TABLE=InvenCare-UserProfiles
DYNAMODB_PRODUCTS_TABLE=InvenCare-Products
DYNAMODB_TRANSACTIONS_TABLE=InvenCare-Transactions

# Lambda Configuration
LAMBDA_EXECUTION_ROLE_ARN=$AUTH_ROLE_ARN

# Application Configuration
VITE_APP_NAME=$APP_NAME
VITE_API_ENDPOINT=https://api.invencare.yourdomain.com
EOF

print_success "Generated deployment-config.env"

# Clean up temporary files
rm -f /tmp/cognito-authenticated-trust-policy.json
rm -f /tmp/invencare-user-policy.json
rm -f /tmp/lambda-trust-policy.json
rm -f /tmp/cors-config.json

echo
print_success "🎉 AWS Infrastructure deployment completed successfully!"
echo
echo -e "${YELLOW}📋 Configuration Summary:${NC}"
echo "  User Pool ID: $USER_POOL_ID"
echo "  User Pool Client ID: $CLIENT_ID"
echo "  Identity Pool ID: $IDENTITY_POOL_ID"
echo "  User Data Bucket: $USER_DATA_BUCKET"
echo "  Deployment Bucket: $BUCKET_NAME"
echo
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "  1. Copy the values from deployment-config.env to your .env file"
echo "  2. Update your application configuration"
echo "  3. Deploy your Lambda functions using the provided scripts"
echo "  4. Test the authentication flow"
echo
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "  - Update callback URLs in production"
echo "  - Configure proper CORS for your domain"
echo "  - Set up monitoring and logging"
echo "  - Review and adjust IAM policies for production use"
