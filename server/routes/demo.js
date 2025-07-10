// AWS Lambda Integration Example
// import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// Initialize Lambda client
// const lambdaClient = new LambdaClient({
//   region: process.env.AWS_REGION || 'us-east-1'
// });

export const handleDemo = async (req, res) => {
  try {
    // AWS Lambda Function Invocation Example with Transaction Analytics
    // const lambdaParams = {
    //   FunctionName: 'invencare-transaction-analytics',
    //   InvocationType: 'RequestResponse',
    //   Payload: JSON.stringify({
    //     action: req.query.action || 'generateTransactionReport', // generateTransactionReport, salesAnalysis, transferAnalysis, auditReport
    //     storeId: req.query.storeId || null, // null for all stores, specific ID for individual store
    //     storeIds: req.query.storeIds ? req.query.storeIds.split(',') : [], // Multiple store IDs for managers
    //     includeStoreBreakdown: req.query.storeId === 'all' || !req.query.storeId, // Include per-store metrics
    //     transactionTypes: req.query.types ? req.query.types.split(',') : ['sale', 'restock', 'adjustment', 'transfer'],
    //     userRole: req.headers['x-user-role'] || 'employee', // User role from Cognito token
    //     userStoreAccess: req.headers['x-user-store-access'] || '', // Comma-separated store IDs user can access
    //     userId: req.headers['x-user-id'] || '', // Cognito user ID for audit trail
    //     dateRange: req.query.dateRange || '30days', // today, week, month, year, custom
    //     categoryFilter: req.query.category || null, // Filter by product category
    //     metrics: req.query.metrics ? req.query.metrics.split(',') : ['transactions', 'sales', 'transfers', 'adjustments'],
    //     includeAuditTrail: req.query.audit === 'true', // Include audit log data
    //     aggregationLevel: req.query.aggregation || 'daily' // hourly, daily, weekly, monthly
    //   })
    // };

    // try {
    //   const lambdaCommand = new InvokeCommand(lambdaParams);
    //   const lambdaResponse = await lambdaClient.send(lambdaCommand);
    //
    //   const responsePayload = JSON.parse(
    //     new TextDecoder().decode(lambdaResponse.Payload)
    //   );
    //
    //   res.status(200).json({
    //     message: "Analytics processed successfully",
    //     data: responsePayload,
    //     source: "aws-lambda"
    //   });
    // } catch (lambdaError) {
    //   console.error('Lambda invocation error:', lambdaError);
    //   res.status(500).json({
    //     error: 'Failed to process analytics',
    //     details: lambdaError.message
    //   });
    // }

    // Demo response (remove when implementing Lambda)
    const response = {
      message: "Hello from Express server",
      timestamp: new Date().toISOString(),
      // Demo analytics data that would come from Lambda
      analytics: {
        totalProducts: 1250,
        lowStockItems: 23,
        topSellingCategories: [
          { name: "Beverages", sales: 850 },
          { name: "Snacks", sales: 720 },
          { name: "Dairy", sales: 650 },
        ],
        revenueThisMonth: 45230.5,
        inventoryTurnover: 4.2,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Demo endpoint error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// AWS Lambda Function Examples for separate deployment

// Lambda Function 1: Inventory Analytics Processor
// export const inventoryAnalyticsHandler = async (event, context) => {
//   try {
//     const { action, storeId, dateRange } = event;
//
//     // Connect to RDS
//     const connection = await mysql.createConnection({
//       host: process.env.RDS_HOSTNAME,
//       user: process.env.RDS_USERNAME,
//       password: process.env.RDS_PASSWORD,
//       database: process.env.RDS_DB_NAME
//     });
//
//     let result;
//
//     switch (action) {
//       case 'generateInventoryReport':
//         const [rows] = await connection.execute(`
//           SELECT
//             p.category,
//             COUNT(*) as product_count,
//             SUM(p.quantity) as total_quantity,
//             SUM(p.price * p.quantity) as total_value,
//             AVG(p.price) as avg_price
//           FROM products p
//           WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
//           GROUP BY p.category
//           ORDER BY total_value DESC
//         `, [dateRange === '30days' ? 30 : 7]);
//
//         result = { inventoryReport: rows };
//         break;
//
//       case 'lowStockAlert':
//         const [lowStock] = await connection.execute(`
//           SELECT * FROM products
//           WHERE quantity <= minimum_stock
//           AND status = 'active'
//           ORDER BY quantity ASC
//         `);
//
//         result = { lowStockItems: lowStock };
//         break;
//
//       default:
//         throw new Error('Unknown action');
//     }
//
//     await connection.end();
//
//     return {
//       statusCode: 200,
//       body: JSON.stringify(result)
//     };
//   } catch (error) {
//     console.error('Lambda error:', error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ error: error.message })
//     };
//   }
// };

// Lambda Function 2: Automated Reorder System
// export const autoReorderHandler = async (event, context) => {
//   try {
//     // Connect to RDS
//     const connection = await mysql.createConnection({
//       host: process.env.RDS_HOSTNAME,
//       user: process.env.RDS_USERNAME,
//       password: process.env.RDS_PASSWORD,
//       database: process.env.RDS_DB_NAME
//     });
//
//     // Find products below reorder point
//     const [lowStockProducts] = await connection.execute(`
//       SELECT p.*, s.name as supplier_name, s.email as supplier_email
//       FROM products p
//       LEFT JOIN suppliers s ON p.supplier_id = s.id
//       WHERE p.quantity <= p.minimum_stock
//       AND p.status = 'active'
//     `);
//
//     const reorderRequests = [];
//
//     for (const product of lowStockProducts) {
//       // Calculate optimal reorder quantity
//       const reorderQuantity = product.maximum_stock - product.quantity;
//
//       // Create reorder request
//       const reorderRequest = {
//         productId: product.id,
//         productName: product.name,
//         currentStock: product.quantity,
//         reorderQuantity,
//         supplierId: product.supplier_id,
//         supplierEmail: product.supplier_email,
//         estimatedCost: product.price * reorderQuantity
//       };
//
//       reorderRequests.push(reorderRequest);
//
//       // Log reorder request in database
//       await connection.execute(`
//         INSERT INTO reorder_requests
//         (product_id, requested_quantity, estimated_cost, status, created_at)
//         VALUES (?, ?, ?, 'pending', NOW())
//       `, [product.id, reorderQuantity, reorderRequest.estimatedCost]);
//
//       // Send email notification to supplier (integrate with SES)
//       // await sendReorderEmail(reorderRequest);
//     }
//
//     await connection.end();
//
//     return {
//       statusCode: 200,
//       body: JSON.stringify({
//         message: `Generated ${reorderRequests.length} reorder requests`,
//         requests: reorderRequests
//       })
//     };
//   } catch (error) {
//     console.error('Auto reorder error:', error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ error: error.message })
//     };
//   }
// };

// Lambda Function 3: Transaction Analytics Processor
// export const transactionAnalyticsHandler = async (event, context) => {
//   try {
//     const { action, storeId, transactionTypes, dateRange, userStoreAccess } = event;
//
//     const connection = await mysql.createConnection({
//       host: process.env.RDS_HOSTNAME,
//       user: process.env.RDS_USERNAME,
//       password: process.env.RDS_PASSWORD,
//       database: process.env.RDS_DB_NAME
//     });
//
//     let result;
//     const storeFilter = storeId && storeId !== 'all' ? 'AND it.store_id = ?' : '';
//     const dateFilter = `AND it.created_at >= DATE_SUB(NOW(), INTERVAL ${dateRange === '30days' ? 30 : 7} DAY)`;
//
//     switch (action) {
//       case 'generateTransactionReport':
//         const [transactionData] = await connection.execute(`
//           SELECT
//             it.transaction_type,
//             it.store_id,
//             s.name as store_name,
//             COUNT(*) as transaction_count,
//             SUM(it.total_amount) as total_value,
//             AVG(it.total_amount) as avg_transaction_value,
//             SUM(CASE WHEN it.transaction_type = 'sale' THEN it.total_amount ELSE 0 END) as total_sales,
//             COUNT(CASE WHEN it.transaction_type = 'transfer' THEN 1 END) as transfer_count
//           FROM inventory_transactions it
//           JOIN stores s ON it.store_id = s.id
//           WHERE 1=1 ${storeFilter} ${dateFilter}
//           GROUP BY it.transaction_type, it.store_id
//           ORDER BY total_value DESC
//         `, storeId && storeId !== 'all' ? [storeId] : []);
//
//         result = { transactionAnalytics: transactionData };
//         break;
//
//       case 'salesAnalysis':
//         const [salesTrends] = await connection.execute(`
//           SELECT
//             DATE(it.created_at) as transaction_date,
//             it.store_id,
//             s.name as store_name,
//             COUNT(*) as sales_count,
//             SUM(it.total_amount) as daily_sales,
//             AVG(it.total_amount) as avg_sale_value
//           FROM inventory_transactions it
//           JOIN stores s ON it.store_id = s.id
//           WHERE it.transaction_type = 'sale' ${storeFilter} ${dateFilter}
//           GROUP BY DATE(it.created_at), it.store_id
//           ORDER BY transaction_date DESC, daily_sales DESC
//         `, storeId && storeId !== 'all' ? [storeId] : []);
//
//         result = { salesTrends };
//         break;
//
//       case 'transferAnalysis':
//         const [transferData] = await connection.execute(`
//           SELECT
//             it.store_id as from_store,
//             sf.name as from_store_name,
//             it.transfer_to_store_id as to_store,
//             st.name as to_store_name,
//             COUNT(*) as transfer_count,
//             SUM(it.total_amount) as total_transfer_value,
//             AVG(it.quantity) as avg_quantity_transferred
//           FROM inventory_transactions it
//           JOIN stores sf ON it.store_id = sf.id
//           JOIN stores st ON it.transfer_to_store_id = st.id
//           WHERE it.transaction_type = 'transfer' ${dateFilter}
//           GROUP BY it.store_id, it.transfer_to_store_id
//           ORDER BY transfer_count DESC
//         `);
//
//         result = { transferAnalytics: transferData };
//         break;
//
//       default:
//         throw new Error('Unknown action');
//     }
//
//     await connection.end();
//
//     return {
//       statusCode: 200,
//       body: JSON.stringify(result)
//     };
//   } catch (error) {
//     console.error('Transaction analytics error:', error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ error: error.message })
//     };
//   }
// };
//
// Lambda Function 4: Transaction Processor
// export const transactionProcessorHandler = async (event, context) => {
//   try {
//     const { transaction, userId, userRole } = event;
//
//     const connection = await mysql.createConnection({
//       host: process.env.RDS_HOSTNAME,
//       user: process.env.RDS_USERNAME,
//       password: process.env.RDS_PASSWORD,
//       database: process.env.RDS_DB_NAME
//     });
//
//     await connection.beginTransaction();
//
//     try {
//       // Insert transaction record
//       const [transactionResult] = await connection.execute(`
//         INSERT INTO inventory_transactions (
//           product_id, store_id, transaction_type, quantity, unit_price,
//           total_amount, reference_number, notes, user_id, user_name,
//           transfer_to_store_id, transfer_to_store_name, category, product_name
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `, [
//         transaction.productId, transaction.storeId, transaction.type.toLowerCase(),
//         transaction.quantity, transaction.unitPrice, transaction.totalAmount,
//         transaction.referenceNumber, transaction.notes, userId, transaction.userName,
//         transaction.transferToStoreId, transaction.transferToStoreName,
//         transaction.category, transaction.productName
//       ]);
//
//       // Update product inventory based on transaction type
//       switch (transaction.type.toLowerCase()) {
//         case 'sale':
//         case 'adjustment':
//           await connection.execute(`
//             UPDATE products SET quantity = quantity + ? WHERE id = ? AND store_id = ?
//           `, [transaction.quantity, transaction.productId, transaction.storeId]);
//           break;
//
//         case 'restock':
//           await connection.execute(`
//             UPDATE products SET quantity = quantity + ? WHERE id = ? AND store_id = ?
//           `, [Math.abs(transaction.quantity), transaction.productId, transaction.storeId]);
//           break;
//
//         case 'transfer':
//           // Decrease from source store
//           await connection.execute(`
//             UPDATE products SET quantity = quantity - ? WHERE id = ? AND store_id = ?
//           `, [Math.abs(transaction.quantity), transaction.productId, transaction.storeId]);
//
//           // Increase in destination store
//           await connection.execute(`
//             UPDATE products SET quantity = quantity + ? WHERE id = ? AND store_id = ?
//           `, [Math.abs(transaction.quantity), transaction.productId, transaction.transferToStoreId]);
//           break;
//       }
//
//       // Log audit trail
//       await connection.execute(`
//         INSERT INTO transaction_audit_log (
//           transaction_id, action, performed_by, new_values, ip_address
//         ) VALUES (?, 'created', ?, ?, ?)
//       `, [
//         transactionResult.insertId, userId,
//         JSON.stringify(transaction), event.ipAddress || '0.0.0.0'
//       ]);
//
//       await connection.commit();
//
//       return {
//         statusCode: 200,
//         body: JSON.stringify({
//           message: 'Transaction processed successfully',
//           transactionId: transactionResult.insertId
//         })
//       };
//     } catch (error) {
//       await connection.rollback();
//       throw error;
//     }
//   } catch (error) {
//     console.error('Transaction processor error:', error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ error: error.message })
//     };
//   }
// };
