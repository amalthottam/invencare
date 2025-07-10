# AWS Integration Setup

This document contains the steps to integrate your InvenCare application with AWS services: Cognito, Lambda, and RDS.

## Prerequisites

1. AWS Account with appropriate permissions
2. AWS CLI configured
3. Node.js 18+ installed

## AWS Dependencies Installation

Run the following command to install AWS SDK dependencies:

```bash
npm install --save aws-amplify @aws-sdk/client-cognito-identity-provider @aws-sdk/client-lambda @aws-sdk/client-rds mysql2 @aws-sdk/client-ses
```

For development and Lambda deployment:

```bash
npm install --save-dev serverless serverless-webpack webpack
```

## 1. AWS Cognito Setup

### Create User Pool

```bash
aws cognito-idp create-user-pool \
  --pool-name "invencare-user-pool" \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
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
      "Name": "given_name",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "family_name",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "role",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "store_id",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    }
  ]'
```

### Create User Pool Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id "your-user-pool-id" \
  --client-name "invencare-web-client" \
  --generate-secret false \
  --explicit-auth-flows USER_PASSWORD_AUTH USER_SRP_AUTH \
  --supported-identity-providers COGNITO \
  --callback-urls "http://localhost:8080/dashboard" \
  --logout-urls "http://localhost:8080/login" \
  --allowed-o-auth-flows code implicit \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client true
```

### Environment Variables for Cognito

Add these to your environment:

```bash
export COGNITO_USER_POOL_ID="us-east-1_XXXXXXXXX"
export COGNITO_USER_POOL_CLIENT_ID="xxxxxxxxxxxxxxxxxxxxxxxxxx"
export AWS_REGION="us-east-1"
```

## 2. AWS RDS Setup

### Create RDS MySQL Instance

```bash
aws rds create-db-instance \
  --db-instance-identifier invencare-db \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --engine-version 8.0.35 \
  --master-username admin \
  --master-user-password YourSecurePassword123! \
  --allocated-storage 20 \
  --storage-type gp2 \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name default \
  --backup-retention-period 7 \
  --storage-encrypted \
  --multi-az false \
  --publicly-accessible true \
  --auto-minor-version-upgrade true \
  --deletion-protection false
```

### Create Database and Tables

Connect to your RDS instance and run:

```sql
-- Create database
CREATE DATABASE invencare;
USE invencare;

-- Create products table
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  category VARCHAR(100),
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100),
  minimum_stock INT DEFAULT 5,
  maximum_stock INT DEFAULT 100,
  supplier_id INT,
  location VARCHAR(100),
  status ENUM('active', 'inactive', 'discontinued') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_sku (sku),
  INDEX idx_status (status)
);

-- Create suppliers table
CREATE TABLE suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create inventory transactions table
CREATE TABLE inventory_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  transaction_type ENUM('in', 'out', 'adjustment') NOT NULL,
  quantity INT NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  user_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_id (product_id),
  INDEX idx_transaction_type (transaction_type),
  INDEX idx_created_at (created_at)
);

-- Create reorder requests table
CREATE TABLE reorder_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  requested_quantity INT NOT NULL,
  estimated_cost DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'approved', 'ordered', 'received', 'cancelled') DEFAULT 'pending',
  supplier_id INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_id (product_id),
  INDEX idx_status (status)
);

-- Insert sample data
INSERT INTO suppliers (name, contact_person, email, phone) VALUES
('Fresh Foods Wholesale', 'John Smith', 'john@freshfoods.com', '+1-555-0101'),
('Beverage Distributors Inc', 'Sarah Johnson', 'sarah@beveragedist.com', '+1-555-0102'),
('Snack Supply Co', 'Mike Wilson', 'mike@snacksupply.com', '+1-555-0103');

INSERT INTO products (name, description, price, quantity, category, sku, minimum_stock, supplier_id) VALUES
('Organic Bananas', 'Fresh organic bananas per lb', 1.99, 50, 'Produce', 'PR-ORG-BAN1', 10, 1),
('Coca Cola 12pk', 'Coca Cola 12 pack cans', 6.99, 25, 'Beverages', 'BV-COC-12PK', 5, 2),
('Lay\'s Potato Chips', 'Classic potato chips family size', 4.99, 30, 'Snacks', 'SN-LAY-CHIP', 8, 3),
('Whole Milk Gallon', 'Fresh whole milk 1 gallon', 3.79, 15, 'Dairy', 'DA-MIL-GAL1', 5, 1),
('Wonder Bread', 'White sandwich bread loaf', 2.49, 20, 'Bakery', 'BK-WON-BRED', 10, 1);
```

### Environment Variables for RDS

```bash
export RDS_HOSTNAME="invencare-db.xxxxxxxxx.us-east-1.rds.amazonaws.com"
export RDS_USERNAME="admin"
export RDS_PASSWORD="YourSecurePassword123!"
export RDS_DB_NAME="invencare"
export RDS_PORT="3306"
```

## 3. AWS Lambda Functions Setup

### Create Lambda Execution Role

```bash
aws iam create-role \
  --role-name lambda-execution-role \
  --assume-role-policy-document '{
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
  }'

aws iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonRDSDataFullAccess
```

### Deploy Lambda Functions

Create `serverless.yml` for Serverless Framework deployment:

```yaml
service: invencare-lambda

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    RDS_HOSTNAME: ${env:RDS_HOSTNAME}
    RDS_USERNAME: ${env:RDS_USERNAME}
    RDS_PASSWORD: ${env:RDS_PASSWORD}
    RDS_DB_NAME: ${env:RDS_DB_NAME}
    RDS_PORT: ${env:RDS_PORT}

functions:
  inventoryAnalytics:
    handler: lambda/inventoryAnalytics.handler
    timeout: 30
    events:
      - schedule: rate(1 hour)

  autoReorder:
    handler: lambda/autoReorder.handler
    timeout: 60
    events:
      - schedule: rate(1 day)

  priceOptimization:
    handler: lambda/priceOptimization.handler
    timeout: 120
    events:
      - schedule: rate(7 days)
```

### Environment Variables for Lambda

```bash
export LAMBDA_ANALYTICS_FUNCTION="invencare-lambda-dev-inventoryAnalytics"
export LAMBDA_REORDER_FUNCTION="invencare-lambda-dev-autoReorder"
export LAMBDA_PRICE_OPTIMIZATION_FUNCTION="invencare-lambda-dev-priceOptimization"
```

## 4. Application Configuration

### Update your application environment

Create `.env` file in your project root:

```bash
# AWS Configuration
AWS_REGION=us-east-1

# Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# RDS Configuration
RDS_HOSTNAME=invencare-db.xxxxxxxxx.us-east-1.rds.amazonaws.com
RDS_USERNAME=admin
RDS_PASSWORD=YourSecurePassword123!
RDS_DB_NAME=invencare
RDS_PORT=3306

# Lambda Functions
LAMBDA_ANALYTICS_FUNCTION=invencare-lambda-dev-inventoryAnalytics
LAMBDA_REORDER_FUNCTION=invencare-lambda-dev-autoReorder
LAMBDA_PRICE_OPTIMIZATION_FUNCTION=invencare-lambda-dev-priceOptimization

# Application
NODE_ENV=development
```

## 5. Enable AWS Features

### Uncomment AWS Integration Code

1. In `client/App.jsx`: Uncomment Amplify configuration
2. In `client/pages/Login.jsx`: Uncomment Cognito authentication functions
3. In `server/index.js`: Uncomment RDS connection and endpoints
4. In `server/routes/demo.js`: Uncomment Lambda invocation
5. In `shared/api.js`: Uncomment type definitions and interfaces

### Install and Configure

```bash
# Install AWS dependencies
npm install --save aws-amplify @aws-sdk/client-cognito-identity-provider @aws-sdk/client-lambda @aws-sdk/client-rds mysql2

# Start the application
npm run dev
```

## 6. Testing

### Test Cognito Authentication

1. Navigate to `/login`
2. Sign up with a new account
3. Check email for confirmation code
4. Confirm account and sign in

### Test RDS Connection

1. Check `/api/health` endpoint for database status
2. Use `/api/products` to view/manage inventory

### Test Lambda Functions

1. Visit `/api/demo` to trigger Lambda analytics
2. Check CloudWatch logs for function execution

## 7. Production Deployment

### Environment Setup

- Use AWS Parameter Store or Secrets Manager for sensitive values
- Configure VPC and security groups properly
- Enable RDS encryption and backups
- Set up CloudWatch monitoring and alarms
- Configure Lambda function reserved concurrency

### Security Best Practices

- Use IAM roles with minimal required permissions
- Enable WAF for API protection
- Use VPC endpoints for internal communication
- Implement request throttling and rate limiting
- Enable AWS CloudTrail for audit logging

## Troubleshooting

### Common Issues

1. **Cognito Authentication Errors**

   - Verify user pool configuration
   - Check client app settings
   - Ensure correct region configuration

2. **RDS Connection Issues**

   - Verify security group allows connections
   - Check VPC and subnet configuration
   - Ensure credentials are correct

3. **Lambda Function Errors**
   - Check CloudWatch logs
   - Verify IAM permissions
   - Ensure VPC configuration if needed

### Support Resources

- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [AWS RDS User Guide](https://docs.aws.amazon.com/rds/)
- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [AWS Cognito Developer Guide](https://docs.aws.amazon.com/cognito/)
