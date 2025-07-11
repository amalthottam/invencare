# AWS Lambda Setup Guide for Inventory Management System

This document provides comprehensive instructions for setting up AWS Lambda functions for the inventory management system's AI analytics and transaction processing.

## Prerequisites

- AWS CLI installed and configured
- AWS account with appropriate permissions
- Node.js 18.x or later
- ZIP command line utility

## Lambda Functions Overview

The system uses 4 main Lambda functions:

1. **invencare-inventory-analytics** - Inventory analytics and reporting
2. **invencare-transaction-analytics** - Transaction analysis and metrics
3. **invencare-auto-reorder** - Automated reorder recommendations
4. **invencare-transaction-processor** - Real-time transaction processing

## Setup Instructions

### 1. Create IAM Role for Lambda Functions

First, create an IAM role that allows Lambda functions to access RDS and other AWS services:

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

# Create the IAM role
aws iam create-role \
  --role-name InvenCareLambdaRole \
  --assume-role-policy-document file://lambda-trust-policy.json

# Attach basic Lambda execution policy
aws iam attach-role-policy \
  --role-name InvenCareLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create and attach RDS access policy
cat > lambda-rds-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds:DescribeDBInstances",
        "rds:Connect"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "rds-db:connect"
      ],
      "Resource": "arn:aws:rds-db:*:*:dbuser:*/lambda-user"
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name InvenCareLambdaRDSPolicy \
  --policy-document file://lambda-rds-policy.json

aws iam attach-role-policy \
  --role-name InvenCareLambdaRole \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/InvenCareLambdaRDSPolicy
```

### 2. Set Up RDS Database

Create an RDS MySQL instance for the inventory system:

```bash
# Create RDS subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name invencare-subnet-group \
  --db-subnet-group-description "Subnet group for InvenCare database" \
  --subnet-ids subnet-12345678 subnet-87654321

# Create RDS security group
aws ec2 create-security-group \
  --group-name invencare-rds-sg \
  --description "Security group for InvenCare RDS database"

# Add MySQL port rule
aws ec2 authorize-security-group-ingress \
  --group-name invencare-rds-sg \
  --protocol tcp \
  --port 3306 \
  --cidr 10.0.0.0/16

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier invencare-db \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --master-username admin \
  --master-user-password 'InvenCare123!' \
  --allocated-storage 20 \
  --db-name invencare \
  --vpc-security-group-ids sg-12345678 \
  --db-subnet-group-name invencare-subnet-group \
  --backup-retention-period 7 \
  --storage-encrypted
```

### 3. Lambda Function Code

Create the Lambda function files:

#### `lambda-inventory-analytics.js`

```javascript
import mysql from "mysql2/promise";

const dbConfig = {
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DB_NAME,
  port: process.env.RDS_PORT || 3306,
  ssl: { rejectUnauthorized: false },
};

export const handler = async (event, context) => {
  console.log("Inventory Analytics Event:", JSON.stringify(event, null, 2));

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    const {
      action = "generateInventoryReport",
      storeId,
      storeIds = [],
      dateRange = "30days",
      categoryFilter,
      userRole = "employee",
      userStoreAccess = [],
      includeStoreBreakdown = false,
    } = event;

    let result = {};

    // Store access control
    const storeFilter =
      userRole === "admin"
        ? ""
        : userStoreAccess.length > 0
          ? `AND p.store_id IN (${userStoreAccess.map(() => "?").join(",")})`
          : "AND 1=0";

    const storeParams = userRole === "admin" ? [] : userStoreAccess;

    switch (action) {
      case "generateInventoryReport":
        // Low stock analysis
        const [lowStockItems] = await connection.execute(
          `
          SELECT 
            p.id,
            p.name as productName,
            p.sku as productId,
            p.quantity as currentStock,
            p.minimum_stock as minimumStock,
            p.category,
            s.name as storeName,
            s.id as storeId,
            (p.minimum_stock - p.quantity) as stockShortfall
          FROM products p 
          JOIN stores s ON p.store_id = s.id
          WHERE p.quantity <= p.minimum_stock
          ${storeFilter}
          ORDER BY stockShortfall DESC
        `,
          storeParams,
        );

        // Category-wise inventory value
        const [categoryAnalysis] = await connection.execute(
          `
          SELECT 
            p.category,
            COUNT(*) as productCount,
            SUM(p.quantity) as totalQuantity,
            SUM(p.price * p.quantity) as totalValue,
            AVG(p.quantity) as avgStock
          FROM products p
          JOIN stores s ON p.store_id = s.id
          WHERE p.status = 'active' ${storeFilter}
          GROUP BY p.category
          ORDER BY totalValue DESC
        `,
          storeParams,
        );

        // Store-wise breakdown if requested
        let storeBreakdown = [];
        if (includeStoreBreakdown) {
          const [breakdown] = await connection.execute(
            `
            SELECT 
              s.id as storeId,
              s.name as storeName,
              COUNT(p.id) as totalProducts,
              SUM(p.quantity) as totalStock,
              SUM(p.price * p.quantity) as totalValue,
              COUNT(CASE WHEN p.quantity <= p.minimum_stock THEN 1 END) as lowStockCount
            FROM stores s
            LEFT JOIN products p ON s.id = p.store_id AND p.status = 'active'
            WHERE 1=1 ${storeFilter.replace("p.store_id", "s.id")}
            GROUP BY s.id, s.name
            ORDER BY totalValue DESC
          `,
            storeParams,
          );
          storeBreakdown = breakdown;
        }

        result = {
          lowStockItems,
          categoryAnalysis,
          storeBreakdown,
          summary: {
            totalLowStockItems: lowStockItems.length,
            totalCategories: categoryAnalysis.length,
            totalInventoryValue: categoryAnalysis.reduce(
              (sum, cat) => sum + parseFloat(cat.totalValue),
              0,
            ),
          },
        };
        break;

      case "getProductDetails":
        const productId = event.productId;
        if (!productId) {
          throw new Error("Product ID is required for product details");
        }

        const [productDetails] = await connection.execute(
          `
          SELECT 
            p.*,
            s.name as storeName,
            sup.name as supplierName,
            (SELECT ABS(SUM(it.quantity)) / 30
             FROM inventory_transactions it 
             WHERE it.product_id = p.id 
             AND it.store_id = p.store_id
             AND it.transaction_type = 'sale'
             AND it.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as avgDailySales,
            (SELECT MAX(it.created_at)
             FROM inventory_transactions it 
             WHERE it.product_id = p.id 
             AND it.store_id = p.store_id
             AND it.transaction_type = 'restock') as lastRestockDate
          FROM products p
          JOIN stores s ON p.store_id = s.id
          LEFT JOIN suppliers sup ON p.supplier_id = sup.id
          WHERE p.id = ? ${storeFilter}
        `,
          [productId, ...storeParams],
        );

        if (productDetails.length === 0) {
          throw new Error("Product not found or access denied");
        }

        result = { productDetails: productDetails[0] };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        action,
        data: result,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("Inventory Analytics Error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: "Inventory analytics failed",
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};
```

#### `lambda-transaction-analytics.js`

```javascript
import mysql from "mysql2/promise";

const dbConfig = {
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DB_NAME,
  port: process.env.RDS_PORT || 3306,
  ssl: { rejectUnauthorized: false },
};

export const handler = async (event, context) => {
  console.log("Transaction Analytics Event:", JSON.stringify(event, null, 2));

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    const {
      action = "generateTransactionReport",
      storeId,
      storeIds = [],
      transactionTypes = ["sale", "restock", "adjustment", "transfer"],
      dateRange = "month",
      startDate,
      endDate,
      categoryFilter,
      aggregationLevel = "daily",
      includeAuditTrail = false,
      includeStoreBreakdown = false,
      userRole = "employee",
      userStoreAccess = [],
    } = event;

    let result = {};

    // Store access control
    const storeFilter =
      userRole === "admin"
        ? ""
        : userStoreAccess.length > 0
          ? `AND it.store_id IN (${userStoreAccess.map(() => "?").join(",")})`
          : "AND 1=0";

    // Date range calculation
    let dateFilter = "";
    let dateParams = [];

    if (dateRange !== "all") {
      switch (dateRange) {
        case "today":
          dateFilter = "AND DATE(it.created_at) = CURDATE()";
          break;
        case "week":
          dateFilter = "AND it.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)";
          break;
        case "month":
          dateFilter = "AND it.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
          break;
        case "quarter":
          dateFilter = "AND it.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)";
          break;
      }
    }

    if (startDate && endDate) {
      dateFilter = "AND DATE(it.created_at) BETWEEN ? AND ?";
      dateParams = [startDate, endDate];
    }

    // Transaction type filter
    const typeFilter = `AND it.transaction_type IN (${transactionTypes.map(() => "?").join(",")})`;

    // Category filter
    let categoryFilterSql = "";
    let categoryParams = [];
    if (categoryFilter) {
      categoryFilterSql = "AND it.category = ?";
      categoryParams = [categoryFilter];
    }

    const params = [
      ...dateParams,
      ...transactionTypes,
      ...categoryParams,
      ...(userRole === "admin" ? [] : userStoreAccess),
    ];

    switch (action) {
      case "generateTransactionReport":
        const [transactionData] = await connection.execute(
          `
          SELECT 
            it.transaction_type,
            ${includeStoreBreakdown ? "it.store_id, s.name as store_name," : ""}
            COUNT(*) as transaction_count,
            SUM(it.total_amount) as total_value,
            AVG(it.total_amount) as avg_transaction_value,
            SUM(CASE WHEN it.transaction_type = 'sale' THEN it.total_amount ELSE 0 END) as total_sales,
            COUNT(CASE WHEN it.transaction_type = 'transfer' THEN 1 END) as transfer_count,
            MIN(it.created_at) as earliest_transaction,
            MAX(it.created_at) as latest_transaction
          FROM inventory_transactions it
          JOIN stores s ON it.store_id = s.id
          WHERE 1=1 ${storeFilter} ${dateFilter} ${typeFilter} ${categoryFilterSql}
          GROUP BY it.transaction_type${includeStoreBreakdown ? ", it.store_id" : ""}
          ORDER BY total_value DESC
        `,
          params,
        );

        result.transactionAnalytics = transactionData;
        break;

      case "salesAnalysis":
        const period =
          aggregationLevel === "daily"
            ? "DATE(it.created_at)"
            : aggregationLevel === "weekly"
              ? "YEARWEEK(it.created_at)"
              : 'DATE_FORMAT(it.created_at, "%Y-%m")';

        const [salesData] = await connection.execute(
          `
          SELECT 
            ${period} as period,
            ${includeStoreBreakdown ? "it.store_id, s.name as store_name," : ""}
            COUNT(*) as sale_count,
            SUM(it.total_amount) as total_revenue,
            AVG(it.total_amount) as avg_sale_value,
            SUM(it.quantity) as total_quantity_sold
          FROM inventory_transactions it
          JOIN stores s ON it.store_id = s.id
          WHERE it.transaction_type = 'sale' ${storeFilter} ${dateFilter} ${categoryFilterSql}
          GROUP BY period${includeStoreBreakdown ? ", it.store_id" : ""}
          ORDER BY period DESC
        `,
          [
            ...dateParams,
            ...categoryParams,
            ...(userRole === "admin" ? [] : userStoreAccess),
          ],
        );

        result.salesAnalysis = salesData;
        break;

      case "transferAnalysis":
        const [transferData] = await connection.execute(
          `
          SELECT 
            it.store_id as from_store_id,
            sf.name as from_store_name,
            it.transfer_to_store_id as to_store_id,
            st.name as to_store_name,
            COUNT(*) as transfer_count,
            SUM(it.total_amount) as total_transfer_value,
            SUM(it.quantity) as total_quantity_transferred
          FROM inventory_transactions it
          JOIN stores sf ON it.store_id = sf.id
          JOIN stores st ON it.transfer_to_store_id = st.id
          WHERE it.transaction_type = 'transfer' ${dateFilter} ${categoryFilterSql}
          ${
            userRole !== "admin" && userStoreAccess.length > 0
              ? `AND (it.store_id IN (${userStoreAccess.map(() => "?").join(",")}) OR it.transfer_to_store_id IN (${userStoreAccess.map(() => "?").join(",")}))`
              : ""
          }
          GROUP BY it.store_id, it.transfer_to_store_id
          ORDER BY transfer_count DESC
        `,
          [
            ...dateParams,
            ...categoryParams,
            ...(userRole === "admin"
              ? []
              : [...userStoreAccess, ...userStoreAccess]),
          ],
        );

        result.transferAnalysis = transferData;
        break;

      case "auditTrail":
        if (includeAuditTrail) {
          const [auditData] = await connection.execute(
            `
            SELECT 
              tal.id as audit_id,
              tal.transaction_id,
              tal.action,
              tal.performed_by,
              tal.old_values,
              tal.new_values,
              tal.created_at as audit_timestamp,
              it.transaction_type,
              it.store_id,
              s.name as store_name,
              it.total_amount,
              it.product_name,
              it.reference_number
            FROM transaction_audit_log tal
            JOIN inventory_transactions it ON tal.transaction_id = it.id
            JOIN stores s ON it.store_id = s.id
            WHERE 1=1 ${storeFilter.replace("it.store_id", "tal.transaction_id IN (SELECT id FROM inventory_transactions WHERE store_id")}
            ${dateFilter.replace("it.created_at", "tal.created_at")}
            ORDER BY tal.created_at DESC
            LIMIT 100
          `,
            [...dateParams, ...(userRole === "admin" ? [] : userStoreAccess)],
          );

          result.auditTrail = auditData;
        }
        break;

      case "realTimeMetrics":
        const [realtimeData] = await connection.execute(
          `
          SELECT 
            COUNT(CASE WHEN it.transaction_type = 'sale' AND it.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as sales_last_hour,
            COUNT(CASE WHEN it.transaction_type = 'sale' AND DATE(it.created_at) = CURDATE() THEN 1 END) as sales_today,
            COALESCE(SUM(CASE WHEN it.transaction_type = 'sale' AND DATE(it.created_at) = CURDATE() THEN it.total_amount END), 0) as revenue_today,
            COUNT(CASE WHEN it.transaction_type = 'transfer' AND it.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as transfers_24h,
            COUNT(CASE WHEN it.transaction_type = 'adjustment' AND it.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as adjustments_24h
          FROM inventory_transactions it
          WHERE 1=1 ${storeFilter}
        `,
          userRole === "admin" ? [] : userStoreAccess,
        );

        result.realTimeMetrics = realtimeData[0];
        break;
    }

    // Add summary metrics if requested
    if (action === "generateTransactionReport") {
      const [summaryMetrics] = await connection.execute(
        `
        SELECT 
          COUNT(*) as total_transactions,
          COALESCE(SUM(CASE WHEN it.transaction_type = 'sale' THEN it.total_amount END), 0) as total_sales_value,
          COUNT(CASE WHEN it.transaction_type = 'restock' THEN 1 END) as total_restocks,
          COUNT(CASE WHEN it.transaction_type = 'transfer' THEN 1 END) as total_transfers,
          COUNT(CASE WHEN it.transaction_type = 'adjustment' THEN 1 END) as total_adjustments,
          COALESCE(AVG(CASE WHEN it.transaction_type = 'sale' THEN it.total_amount END), 0) as avg_transaction_value
        FROM inventory_transactions it
        WHERE 1=1 ${storeFilter} ${dateFilter} ${typeFilter} ${categoryFilterSql}
      `,
        params,
      );

      result.summaryMetrics = summaryMetrics[0];
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        action,
        data: result,
        filters: {
          storeId,
          storeIds,
          dateRange,
          transactionTypes,
          aggregationLevel,
          includeStoreBreakdown,
        },
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("Transaction Analytics Error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: "Transaction analytics failed",
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};
```

### 4. Package and Deploy Lambda Functions

Create deployment packages for each function:

```bash
# Create deployment directory
mkdir lambda-deployments
cd lambda-deployments

# Package inventory analytics
mkdir inventory-analytics
cp ../lambda-inventory-analytics.js inventory-analytics/index.js
cd inventory-analytics
npm init -y
npm install mysql2
zip -r ../inventory-analytics.zip .
cd ..

# Package transaction analytics
mkdir transaction-analytics
cp ../lambda-transaction-analytics.js transaction-analytics/index.js
cd transaction-analytics
npm init -y
npm install mysql2
zip -r ../transaction-analytics.zip .
cd ..

# Deploy functions
aws lambda create-function \
  --function-name invencare-inventory-analytics \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/InvenCareLambdaRole \
  --handler index.handler \
  --zip-file fileb://inventory-analytics.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables='{
    "RDS_HOSTNAME":"your-rds-endpoint.amazonaws.com",
    "RDS_USERNAME":"admin",
    "RDS_PASSWORD":"InvenCare123!",
    "RDS_DB_NAME":"invencare",
    "RDS_PORT":"3306"
  }'

aws lambda create-function \
  --function-name invencare-transaction-analytics \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/InvenCareLambdaRole \
  --handler index.handler \
  --zip-file fileb://transaction-analytics.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables='{
    "RDS_HOSTNAME":"your-rds-endpoint.amazonaws.com",
    "RDS_USERNAME":"admin",
    "RDS_PASSWORD":"InvenCare123!",
    "RDS_DB_NAME":"invencare",
    "RDS_PORT":"3306"
  }'
```

### 5. Test Lambda Functions

Test the deployed functions:

```bash
# Test inventory analytics
aws lambda invoke \
  --function-name invencare-inventory-analytics \
  --payload '{"action":"generateInventoryReport","dateRange":"month"}' \
  response.json

cat response.json

# Test transaction analytics
aws lambda invoke \
  --function-name invencare-transaction-analytics \
  --payload '{"action":"generateTransactionReport","dateRange":"month"}' \
  response.json

cat response.json
```

### 6. Set Environment Variables in Your Application

Update your Express server with the Lambda function names:

```javascript
// In your server/index.js
process.env.LAMBDA_INVENTORY_ANALYTICS_FUNCTION =
  "invencare-inventory-analytics";
process.env.LAMBDA_TRANSACTION_ANALYTICS_FUNCTION =
  "invencare-transaction-analytics";
process.env.LAMBDA_AUTO_REORDER_FUNCTION = "invencare-auto-reorder";
process.env.LAMBDA_TRANSACTION_PROCESSOR_FUNCTION =
  "invencare-transaction-processor";
```

## Monitoring and Logging

### CloudWatch Integration

Lambda functions automatically send logs to CloudWatch. Monitor your functions:

```bash
# View function logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/invencare

# Get recent log events
aws logs get-log-events \
  --log-group-name /aws/lambda/invencare-inventory-analytics \
  --log-stream-name $(aws logs describe-log-streams \
    --log-group-name /aws/lambda/invencare-inventory-analytics \
    --order-by LastEventTime \
    --descending \
    --limit 1 \
    --query 'logStreams[0].logStreamName' \
    --output text)
```

### Error Handling and Alerts

Set up CloudWatch alarms for Lambda errors:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "InvenCare-Lambda-Errors" \
  --alarm-description "Alert on Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=FunctionName,Value=invencare-inventory-analytics \
  --evaluation-periods 1
```

## Security Best Practices

1. **Use IAM roles with minimal permissions**
2. **Enable VPC for Lambda functions** if accessing RDS in private subnet
3. **Use AWS Secrets Manager** for database credentials
4. **Enable CloudTrail** for API call logging
5. **Regularly rotate database passwords**
6. **Use environment variables** for configuration

## Troubleshooting

### Common Issues

1. **Timeout errors**: Increase Lambda timeout and optimize queries
2. **Connection pool exhaustion**: Implement connection pooling properly
3. **Memory issues**: Increase Lambda memory allocation
4. **Permission errors**: Check IAM role permissions

### Debug Commands

```bash
# Check function configuration
aws lambda get-function-configuration \
  --function-name invencare-inventory-analytics

# Update function environment variables
aws lambda update-function-configuration \
  --function-name invencare-inventory-analytics \
  --environment Variables='{
    "RDS_HOSTNAME":"new-endpoint.amazonaws.com",
    "DEBUG":"true"
  }'

# Get function logs
aws logs tail /aws/lambda/invencare-inventory-analytics --follow
```

This completes the AWS Lambda setup for your inventory management system. The functions provide scalable, serverless analytics and processing capabilities for your application.
