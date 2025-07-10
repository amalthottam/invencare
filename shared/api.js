/**
 * Shared code between client and server
 * Useful to share interfaces and types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

// AWS Cognito User Types
// export interface CognitoUser {
//   username: string;
//   email: string;
//   email_verified: boolean;
//   sub: string;
//   given_name?: string;
//   family_name?: string;
//   phone_number?: string;
//   picture?: string;
//   'custom:role'?: 'admin' | 'manager' | 'employee';
//   'custom:store_id'?: string;
// }

// AWS API Response Types
export const createApiResponse = (data, message = "Success") => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

export const createApiError = (error, statusCode = 500) => ({
  success: false,
  error: error.message || error,
  statusCode,
  timestamp: new Date().toISOString(),
});

// Product Management Types
export const ProductStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  DISCONTINUED: "discontinued",
};

export const TransactionType = {
  IN: "in",
  OUT: "out",
  ADJUSTMENT: "adjustment",
};

// AWS Lambda Event Types with Store Context
// export interface InventoryAnalyticsEvent {
//   action: 'generateInventoryReport' | 'lowStockAlert' | 'salesAnalysis' | 'crossStoreComparison';
//   storeId?: string; // null for all stores, specific ID for individual store
//   storeIds?: string[]; // Multiple store IDs for managers with limited access
//   includeStoreBreakdown?: boolean; // Include per-store metrics when viewing all stores
//   userRole?: 'admin' | 'manager' | 'employee';
//   userStoreAccess?: string[]; // List of store IDs user can access
//   dateRange?: '7days' | '30days' | '90days';
//   categoryFilter?: string;
//   userId?: string; // Cognito user ID
//   requestedMetrics?: string[]; // Specific metrics requested
// }

// export interface TransactionAnalyticsEvent {
//   action: 'generateTransactionReport' | 'salesAnalysis' | 'transferAnalysis' | 'auditReport' | 'realTimeMetrics';
//   storeId?: string; // null for all stores, specific ID for individual store
//   storeIds?: string[]; // Multiple store IDs for managers
//   transactionTypes?: ('sale' | 'restock' | 'adjustment' | 'transfer')[]; // Filter by transaction types
//   dateRange?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
//   startDate?: string; // For custom date ranges
//   endDate?: string; // For custom date ranges
//   categoryFilter?: string; // Filter by product category
//   userRole?: 'admin' | 'manager' | 'employee';
//   userStoreAccess?: string[]; // Store access validation
//   userId?: string; // Cognito user ID for audit
//   aggregationLevel?: 'hourly' | 'daily' | 'weekly' | 'monthly';
//   includeAuditTrail?: boolean; // Include transaction audit data
//   includeStoreBreakdown?: boolean; // Per-store metrics breakdown
//   metrics?: string[]; // Specific metrics: ['volume', 'value', 'frequency', 'trends']
// }

// export interface TransactionProcessorEvent {
//   transaction: {
//     productId: number;
//     storeId: string;
//     type: 'sale' | 'restock' | 'adjustment' | 'transfer';
//     quantity: number;
//     unitPrice: number;
//     totalAmount: number;
//     transferToStoreId?: string;
//     transferToStoreName?: string;
//     notes?: string;
//     category: string;
//     productName: string;
//     referenceNumber: string;
//   };
//   userId: string; // Cognito user ID
//   userRole: 'admin' | 'manager' | 'employee';
//   userName: string; // From Cognito attributes
//   ipAddress?: string; // For audit trail
//   sessionId?: string; // Session tracking
//   requireApproval?: boolean; // High-value transactions
// }

// export interface AutoReorderEvent {
//   storeId?: string;
//   forceReorder?: boolean;
//   productIds?: number[];
//   supplierId?: number;
// }

// export interface PriceOptimizationEvent {
//   storeId?: string;
//   categoryFilter?: string;
//   analysisType: 'demand' | 'competition' | 'margin' | 'all';
//   timeframe?: number;
// }

// AWS RDS Data Types with Store Integration
// export interface Store {
//   id: string; // e.g., 'store_001'
//   name: string; // e.g., 'Downtown Store'
//   address: string;
//   city: string;
//   state: string;
//   zip_code: string;
//   phone: string;
//   manager_id: string; // Cognito user ID
//   status: 'active' | 'inactive' | 'maintenance';
//   timezone: string;
//   created_at: string;
//   updated_at: string;
// }
//
// export interface Product {
//   id: number;
//   name: string;
//   description?: string;
//   price: number;
//   quantity: number;
//   category?: string;
//   sku?: string;
//   barcode?: string;
//   minimum_stock: number;
//   maximum_stock: number;
//   supplier_id?: number;
//   store_id: string; // Links to Store
//   location_in_store?: string; // Aisle/shelf location
//   status: 'active' | 'inactive' | 'discontinued';
//   created_at: string;
//   updated_at: string;
//   store?: Store; // Populated via JOIN
// }
//
// export interface UserStoreAccess {
//   id: number;
//   user_id: string; // Cognito user ID
//   store_id: string;
//   role: 'admin' | 'manager' | 'employee' | 'viewer';
//   granted_by: string;
//   granted_at: string;
//   expires_at?: string;
//   status: 'active' | 'suspended' | 'revoked';
//   store?: Store; // Populated via JOIN
// }

// export interface Supplier {
//   id: number;
//   name: string;
//   contact_person?: string;
//   email?: string;
//   phone?: string;
//   address?: string;
//   created_at: string;
//   updated_at: string;
// }

// export interface InventoryTransaction {
//   id: number;
//   product_id: number;
//   store_id: string; // Store where transaction occurred
//   transaction_type: 'sale' | 'restock' | 'adjustment' | 'transfer';
//   quantity: number; // Positive for inbound, negative for outbound
//   unit_price: number; // Price per unit at transaction time
//   total_amount: number; // Total transaction value
//   reference_number: string; // Unique transaction reference (SALE-2024-001, etc.)
//   notes?: string;
//   user_id: string; // Cognito user ID
//   user_name: string; // User display name
//   transfer_to_store_id?: string; // For store-to-store transfers
//   transfer_to_store_name?: string; // Destination store name
//   category: string; // Product category for analytics
//   product_name: string; // Product name snapshot
//   audit_trail?: any; // Additional metadata as JSON
//   created_at: string;
//   updated_at: string;
//   store?: Store; // Populated via JOIN
//   product?: Product; // Populated via JOIN
// }

// export interface TransactionAuditLog {
//   id: number;
//   transaction_id: number;
//   action: 'created' | 'modified' | 'approved' | 'rejected' | 'voided';
//   performed_by: string; // Cognito user ID
//   old_values?: any; // Previous values as JSON
//   new_values?: any; // New values as JSON
//   reason?: string; // Modification reason
//   ip_address?: string;
//   user_agent?: string;
//   created_at: string;
//   transaction?: InventoryTransaction; // Populated via JOIN
// }

// export interface ReorderRequest {
//   id: number;
//   product_id: number;
//   requested_quantity: number;
//   estimated_cost: number;
//   status: 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';
//   supplier_id?: number;
//   notes?: string;
//   created_at: string;
//   updated_at: string;
// }

// API Response Interfaces
// export interface DemoResponse {
//   message: string;
//   timestamp: string;
//   analytics?: {
//     totalProducts: number;
//     lowStockItems: number;
//     topSellingCategories: Array<{
//       name: string;
//       sales: number;
//     }>;
//     revenueThisMonth: number;
//     inventoryTurnover: number;
//   };
// }

// export interface ProductListResponse {
//   products: Product[];
//   pagination?: {
//     page: number;
//     limit: number;
//     total: number;
//     totalPages: number;
//   };
//   filters?: {
//     category?: string;
//     status?: string;
//     lowStock?: boolean;
//   };
// }

// export interface AnalyticsResponse {
//   lowStockItems: Product[];
//   totalProducts: number;
//   totalValue: number;
//   categoryBreakdown: Array<{
//     category: string;
//     product_count: number;
//     total_quantity: number;
//     total_value: number;
//     avg_price: number;
//   }>;
//   salesTrends?: Array<{
//     date: string;
//     total_sales: number;
//     transaction_count: number;
//   }>;
// }

// export interface ReorderAnalysisResponse {
//   message: string;
//   requests: Array<{
//     productId: number;
//     productName: string;
//     currentStock: number;
//     reorderQuantity: number;
//     supplierId?: number;
//     supplierEmail?: string;
//     estimatedCost: number;
//   }>;
// }

// export interface PriceOptimizationResponse {
//   message: string;
//   recommendations: Array<{
//     productId: number;
//     productName: string;
//     category: string;
//     currentPrice: number;
//     recommendedPrice: number;
//     action: 'increase' | 'decrease' | 'maintain';
//     reason: string;
//     salesVelocity: number;
//   }>;
// }

// export interface TransactionAnalyticsResponse {
//   message: string;
//   storeId?: string;
//   storeName?: string;
//   dateRange: string;
//   transactionAnalytics?: Array<{
//     transaction_type: string;
//     store_id: string;
//     store_name: string;
//     transaction_count: number;
//     total_value: number;
//     avg_transaction_value: number;
//     total_sales: number;
//     transfer_count: number;
//   }>;
//   salesTrends?: Array<{
//     transaction_date: string;
//     store_id: string;
//     store_name: string;
//     sales_count: number;
//     daily_sales: number;
//     avg_sale_value: number;
//   }>;
//   transferAnalytics?: Array<{
//     from_store: string;
//     from_store_name: string;
//     to_store: string;
//     to_store_name: string;
//     transfer_count: number;
//     total_transfer_value: number;
//     avg_quantity_transferred: number;
//   }>;
//   summaryMetrics?: {
//     totalTransactions: number;
//     totalSalesValue: number;
//     totalRestocks: number;
//     totalTransfers: number;
//     totalAdjustments: number;
//     avgTransactionValue: number;
//     topPerformingStores: Array<{
//       store_id: string;
//       store_name: string;
//       total_sales: number;
//       transaction_count: number;
//     }>;
//   };
// }

// export interface TransactionListResponse {
//   transactions: InventoryTransaction[];
//   pagination?: {
//     page: number;
//     limit: number;
//     total: number;
//     totalPages: number;
//   };
//   filters?: {
//     storeId?: string;
//     transactionType?: string;
//     dateRange?: string;
//     categoryFilter?: string;
//     userFilter?: string;
//   };
//   summaryStats?: {
//     totalTransactions: number;
//     totalSales: number;
//     totalRestocks: number;
//     totalTransfers: number;
//     totalAdjustments: number;
//   };
// }

// Validation Functions
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  // AWS Cognito password requirements
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^a-zA-Z\d]/.test(password)
  );
};

export const validateSKU = (sku) => {
  // Basic SKU validation (alphanumeric, hyphens, underscores)
  const skuRegex = /^[A-Z0-9_-]+$/i;
  return skuRegex.test(sku) && sku.length >= 3 && sku.length <= 50;
};

export const validatePrice = (price) => {
  return typeof price === "number" && price > 0 && price < 999999.99;
};

export const validateQuantity = (quantity) => {
  return Number.isInteger(quantity) && quantity >= 0;
};

// Utility Functions
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const calculateInventoryValue = (products) => {
  return products.reduce((total, product) => {
    return total + product.price * product.quantity;
  }, 0);
};

export const generateSKU = (productName, category) => {
  const namePrefix = productName.substring(0, 3).toUpperCase();
  const categoryPrefix = category
    ? category.substring(0, 2).toUpperCase()
    : "GN";
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${categoryPrefix}-${namePrefix}-${randomSuffix}`;
};

// Store Management Utility Functions
export const validateStoreAccess = (userStoreAccess, requestedStoreId) => {
  if (!userStoreAccess || userStoreAccess === "all") return true;
  if (!requestedStoreId || requestedStoreId === "all")
    return userStoreAccess === "all";
  return userStoreAccess.split(",").includes(requestedStoreId);
};

export const filterStoresByAccess = (stores, userStoreAccess) => {
  if (!userStoreAccess || userStoreAccess === "all") return stores;
  const accessibleStoreIds = userStoreAccess.split(",");
  return stores.filter((store) => accessibleStoreIds.includes(store.id));
};

export const getDefaultStoreForUser = (
  userRole,
  userStoreAccess,
  userPrimaryStore,
) => {
  if (userRole === "admin") return "all";
  if (userRole === "employee" && userPrimaryStore) return userPrimaryStore;
  if (userStoreAccess === "all") return "all";
  const accessibleStores = userStoreAccess.split(",");
  return accessibleStores.length === 1 ? accessibleStores[0] : "all";
};

// Transaction Validation Functions
export const validateTransactionType = (type) => {
  const validTypes = ["sale", "restock", "adjustment", "transfer"];
  return validTypes.includes(type.toLowerCase());
};

export const validateTransactionAmount = (amount) => {
  return typeof amount === "number" && amount > 0 && amount < 9999999.99;
};

export const validateReferenceNumber = (refNumber) => {
  const refRegex = /^(SALE|RST|ADJ|TRF)-\d{4}-\d+$/;
  return refRegex.test(refNumber);
};

export const generateTransactionReference = (type, year = null) => {
  const currentYear = year || new Date().getFullYear();
  const typePrefix = type.toUpperCase().substring(0, 3);
  const timestamp = Date.now();
  return `${typePrefix}-${currentYear}-${timestamp}`;
};

// Transaction Utility Functions
export const calculateTransactionMetrics = (transactions) => {
  const metrics = {
    totalTransactions: transactions.length,
    totalSales: 0,
    totalRestocks: 0,
    totalTransfers: 0,
    totalAdjustments: 0,
    salesValue: 0,
    avgTransactionValue: 0,
  };

  transactions.forEach((txn) => {
    switch (txn.transaction_type || txn.type) {
      case "sale":
        metrics.totalSales++;
        metrics.salesValue += txn.total_amount || txn.totalAmount || 0;
        break;
      case "restock":
        metrics.totalRestocks++;
        break;
      case "transfer":
        metrics.totalTransfers++;
        break;
      case "adjustment":
        metrics.totalAdjustments++;
        break;
    }
  });

  metrics.avgTransactionValue =
    metrics.totalTransactions > 0
      ? metrics.salesValue / metrics.totalTransactions
      : 0;

  return metrics;
};

export const groupTransactionsByStore = (transactions) => {
  return transactions.reduce((acc, txn) => {
    const storeId = txn.store_id || txn.storeId;
    if (!acc[storeId]) {
      acc[storeId] = {
        storeId,
        storeName: txn.store_name || txn.storeName,
        transactions: [],
        metrics: null,
      };
    }
    acc[storeId].transactions.push(txn);
    return acc;
  }, {});
};

export const filterTransactionsByDateRange = (transactions, dateRange) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return transactions.filter((txn) => {
    const txnDate = new Date(txn.created_at || txn.timestamp);

    switch (dateRange) {
      case "today":
        return txnDate >= today;
      case "week":
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return txnDate >= weekAgo;
      case "month":
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return txnDate >= monthAgo;
      case "quarter":
        const quarterAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        return txnDate >= quarterAgo;
      case "year":
        const yearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        return txnDate >= yearAgo;
      default:
        return true;
    }
  });
};

// AWS Configuration Helpers
export const getAWSConfig = () => ({
  region: process.env.AWS_REGION || "us-east-1",
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    userPoolClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
  },
  rds: {
    hostname: process.env.RDS_HOSTNAME,
    username: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DB_NAME,
    port: process.env.RDS_PORT || 3306,
  },
  lambda: {
    analyticsFunction: process.env.LAMBDA_ANALYTICS_FUNCTION,
    reorderFunction: process.env.LAMBDA_REORDER_FUNCTION,
    priceOptimizationFunction: process.env.LAMBDA_PRICE_OPTIMIZATION_FUNCTION,
    storeAnalyticsFunction: process.env.LAMBDA_STORE_ANALYTICS_FUNCTION,
    transactionAnalyticsFunction:
      process.env.LAMBDA_TRANSACTION_ANALYTICS_FUNCTION,
    transactionProcessorFunction:
      process.env.LAMBDA_TRANSACTION_PROCESSOR_FUNCTION,
  },
});

// Error Messages
export const ErrorMessages = {
  INVALID_EMAIL: "Please enter a valid email address",
  WEAK_PASSWORD:
    "Password must be at least 8 characters with uppercase, lowercase, number and special character",
  INVALID_SKU:
    "SKU must be 3-50 characters, alphanumeric with hyphens/underscores only",
  INVALID_PRICE: "Price must be a positive number less than $999,999.99",
  INVALID_QUANTITY: "Quantity must be a non-negative integer",
  PRODUCT_NOT_FOUND: "Product not found",
  SUPPLIER_NOT_FOUND: "Supplier not found",
  INSUFFICIENT_STOCK: "Insufficient stock for this operation",
  DUPLICATE_SKU: "A product with this SKU already exists",
  DATABASE_ERROR: "Database operation failed",
  UNAUTHORIZED: "Unauthorized access",
  FORBIDDEN: "Access forbidden",
  COGNITO_ERROR: "Authentication service error",
  LAMBDA_ERROR: "Analytics service temporarily unavailable",
  RDS_CONNECTION_ERROR: "Database connection failed",
};
