import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo.js";
import {
  handleInventoryAnalytics,
  handleTransactionAnalytics,
  handleAutoReorder,
  handleTransactionProcessor,
  handleLambdaHealthCheck,
} from "./routes/lambda-integration.js";
import {
  getTransactions,
  getTransactionSummary,
  createTransaction,
  getStores as getStoresFromTransactions,
  getProducts,
} from "./routes/transactions.js";
import {
  getTransactions as getTransactionsWorking,
  getTransactionSummary as getTransactionSummaryWorking,
} from "./routes/transactions-working.js";
import { testDatabase } from "./routes/test-db.js";
import { testSimple } from "./routes/test-simple.js";
import { testParams } from "./routes/test-params.js";
import {
  getDemandPredictions,
  getForecastingDashboard,
  getStores as getForecastingStores,
  getProducts as getForecastingProducts,
  getCategoryInsights,
} from "./routes/forecasting.js";
import { generateForecast as generateForecastProxy } from "./routes/aws-proxy.js";
import {
  getProductPerformance,
  getDemandForecast,
  getReorderRecommendations,
  getAnalyticsDashboard,
  getProductSalesTrends,
  initializeAnalytics,
  generateStoreAnalytics,
} from "./routes/productAnalytics.js";
import { ProductAnalyticsService } from "./services/productAnalytics.js";
import {
  getTopSellingCategories,
  getDashboardAnalytics,
  getStores,
  getLowStockItems,
  getRecentTransactions,
} from "./routes/dashboard.js";
import { initializeDatabase, seedSampleData, query } from "./db/sqlite.js";
import { cleanupDatabase } from "./db/cleanup.js";

// AWS Lambda Integration
// import serverless from 'serverless-http';

// AWS RDS Integration
import mysql from "mysql2/promise";

// RDS Connection Configuration
const dbConfig = {
  host:
    process.env.RDS_HOSTNAME ||
    "invencaredb.cihe2wg8etco.us-east-1.rds.amazonaws.com",
  user: process.env.RDS_USERNAME || "admin",
  password: process.env.RDS_PASSWORD || "InvenCare123",
  database: process.env.RDS_DB_NAME || "invencare",
  port: process.env.RDS_PORT || 3306,
  ssl: {
    rejectUnauthorized: false,
  },
};

// Create RDS connection pool
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
//
// RDS Health Check Function
const checkRDSConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log("RDS connection successful");
    return true;
  } catch (error) {
    console.error("RDS connection failed:", error);
    return false;
  }
};

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize local database on startup
  initializeDatabase().then(async (success) => {
    if (success) {
      await seedSampleData();
      // Initialize product analytics tables
      await ProductAnalyticsService.initializeTables();
      console.log("🚀 Local database ready");
    }
  });

  // AWS RDS Database middleware
  app.use(async (req, res, next) => {
    try {
      req.db = pool;
      next();
    } catch (error) {
      console.error("Database middleware error:", error);
      res.status(500).json({ error: "Database connection failed" });
    }
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });

  // AWS RDS Health Check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const dbHealthy = await checkRDSConnection();
      res.json({
        status: "ok",
        database: dbHealthy ? "connected" : "disconnected",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        error: error.message,
      });
    }
  });

  // AWS RDS Product Management endpoints
  app.get("/api/products", async (req, res) => {
    try {
      const [rows] = await req.db.execute(
        `SELECT
          p.id,
          p.name as productName,
          p.sku as productId,
          COALESCE(c.name, p.category) as category,
          p.category_id,
          p.quantity as stock,
          p.price,
          s.name as storeName,
          p.store_id as storeId,
          'kg' as unit,
          CASE
            WHEN p.quantity = 0 THEN 'Out of Stock'
            WHEN p.quantity <= p.minimum_stock THEN 'Low Stock'
            ELSE 'Available'
          END as status,
          p.minimum_stock as minimumStock,
          sup.name as supplier,
          DATE_FORMAT(p.updated_at, '%Y-%m-%d') as lastUpdated,
          p.barcode,
          p.location_in_store as location,
          p.description,
          p.maximum_stock as maximumStock
        FROM products p
        JOIN stores s ON p.store_id = s.id
        LEFT JOIN suppliers sup ON p.supplier_id = sup.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'active'
        ORDER BY p.updated_at DESC`,
      );
      res.json({ products: rows });
    } catch (error) {
      console.error("Products fetch error:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await req.db.execute(
        `SELECT
          p.id,
          p.name as productName,
          p.sku as productId,
          COALESCE(c.name, p.category) as category,
          p.category_id,
          p.quantity as stock,
          p.price,
          s.name as storeName,
          p.store_id as storeId,
          'kg' as unit,
          CASE
            WHEN p.quantity = 0 THEN 'Out of Stock'
            WHEN p.quantity <= p.minimum_stock THEN 'Low Stock'
            ELSE 'Available'
          END as status,
          p.minimum_stock as minimumStock,
          p.maximum_stock as maximumStock,
          sup.name as supplier,
          DATE_FORMAT(p.updated_at, '%Y-%m-%d') as lastUpdated,
          p.barcode,
          p.location_in_store as location,
          p.description,
          DATE_FORMAT(p.created_at, '%Y-%m-%d') as createdAt
        FROM products p
        JOIN stores s ON p.store_id = s.id
        LEFT JOIN suppliers sup ON p.supplier_id = sup.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ? AND p.status = 'active'`,
        [id],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json({ product: rows[0] });
    } catch (error) {
      console.error("Product fetch error:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const {
        productName,
        productId,
        category_id,
        storeName,
        stock,
        unit,
        price = 0,
        description = "",
      } = req.body;

      // Get store_id from store name
      const [stores] = await req.db.execute(
        "SELECT id FROM stores WHERE name = ?",
        [storeName],
      );

      if (stores.length === 0) {
        return res.status(400).json({ error: "Store not found" });
      }

      const storeId = stores[0].id;

      const [result] = await req.db.execute(
        "INSERT INTO products (name, sku, category_id, quantity, price, store_id, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          productName,
          productId,
          category_id,
          stock,
          price,
          storeId,
          "active",
          description,
        ],
      );

      res.json({
        message: "Product created successfully",
        productId: result.insertId,
      });
    } catch (error) {
      console.error("Product creation error:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        productName,
        productId,
        category_id,
        stock,
        price,
        description,
        minimumStock,
        maximumStock,
      } = req.body;

      await req.db.execute(
        "UPDATE products SET name=?, sku=?, category_id=?, quantity=?, price=?, description=?, minimum_stock=?, maximum_stock=? WHERE id=?",
        [
          productName,
          productId,
          category_id,
          stock,
          price,
          description,
          minimumStock ? parseInt(minimumStock) : null,
          maximumStock ? parseInt(maximumStock) : null,
          id,
        ],
      );
      res.json({ message: "Product updated successfully" });
    } catch (error) {
      console.error("Product update error:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await req.db.execute("DELETE FROM products WHERE id=?", [id]);
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Product deletion error:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // AWS RDS Inventory Analytics
  app.get("/api/analytics/inventory-db", async (req, res) => {
    try {
      const [lowStockItems] = await req.db.execute(
        "SELECT * FROM products WHERE quantity <= minimum_stock ORDER BY quantity ASC",
      );

      const [totalProducts] = await req.db.execute(
        'SELECT COUNT(*) as total FROM products WHERE status = "active"',
      );

      const [totalValue] = await req.db.execute(
        'SELECT SUM(price * quantity) as total_value FROM products WHERE status = "active"',
      );

      res.json({
        lowStockItems,
        totalProducts: totalProducts[0].total,
        totalValue: totalValue[0].total_value || 0,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/demo", handleDemo);

  // Generate sample AI analytics data
  app.post("/api/generate-analytics-data", async (req, res) => {
    try {
      // 1. Create sample forecasting models
      const models = [
        {
          name: "Seasonal ARIMA Model",
          type: "arima",
          endpoint:
            "arn:aws:sagemaker:us-east-1:123456789012:endpoint/seasonal-arima-v1",
          accuracy: 0.8547,
          status: "deployed",
          store_id: "store_001",
          category_id: 1,
        },
        {
          name: "LSTM Deep Learning Model",
          type: "lstm",
          endpoint:
            "arn:aws:sagemaker:us-east-1:123456789012:endpoint/lstm-demand-v2",
          accuracy: 0.9122,
          status: "deployed",
          store_id: null,
          category_id: 6,
        },
        {
          name: "Prophet Trend Model",
          type: "prophet",
          endpoint:
            "arn:aws:sagemaker:us-east-1:123456789012:endpoint/prophet-trend-v1",
          accuracy: 0.8934,
          status: "deployed",
          store_id: "store_002",
          category_id: 2,
        },
      ];

      for (const model of models) {
        await req.db.execute(
          `INSERT IGNORE INTO demand_forecasting_models
           (model_name, model_type, sagemaker_endpoint, model_accuracy, training_status, store_id, category_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            model.name,
            model.type,
            model.endpoint,
            model.accuracy,
            model.status,
            model.store_id,
            model.category_id,
          ],
        );
      }

      // 2. Generate demand predictions for next 30 days
      const [products] = await req.db.execute(
        "SELECT id, store_id FROM products LIMIT 10",
      );
      const [modelIds] = await req.db.execute(
        "SELECT id FROM demand_forecasting_models",
      );

      for (const product of products) {
        for (let days = 1; days <= 30; days++) {
          const predictionDate = new Date();
          predictionDate.setDate(predictionDate.getDate() + days);

          const basedemand = 20 + Math.random() * 50;
          const seasonalFactor = 1 + 0.3 * Math.sin((days / 7) * Math.PI);
          const predictedDemand = Math.round(basedemand * seasonalFactor);

          await req.db.execute(
            `INSERT IGNORE INTO demand_predictions
             (product_id, store_id, model_id, prediction_date, predicted_demand,
              confidence_interval_lower, confidence_interval_upper, factors, lambda_execution_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              product.id,
              product.store_id,
              modelIds[Math.floor(Math.random() * modelIds.length)].id,
              predictionDate.toISOString().split("T")[0],
              predictedDemand,
              Math.round(predictedDemand * 0.8),
              Math.round(predictedDemand * 1.2),
              JSON.stringify({
                seasonality: "weekly",
                weatherImpact: "minimal",
                promotions: Math.random() > 0.8 ? "active" : "none",
              }),
              `lambda-exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ],
          );
        }
      }

      // 3. Generate inventory optimization recommendations
      for (const product of products) {
        const currentStock = 50 + Math.random() * 200;
        const recommendedStock = currentStock + (Math.random() * 40 - 20);
        const reorderPoint = Math.round(currentStock * 0.3);

        await req.db.execute(
          `INSERT IGNORE INTO inventory_optimization
           (product_id, store_id, current_stock, recommended_stock, reorder_point,
            optimal_order_quantity, safety_stock, stockout_probability, excess_inventory_risk,
            cost_optimization_score, recommendation_type, reasoning, implementation_priority,
            estimated_cost_savings, lambda_function_version, analysis_date, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product.id,
            product.store_id,
            Math.round(currentStock),
            Math.round(recommendedStock),
            reorderPoint,
            Math.round(recommendedStock * 0.6),
            Math.round(reorderPoint * 0.5),
            (Math.random() * 0.15).toFixed(2),
            (Math.random() * 0.25).toFixed(2),
            (Math.random() * 1000).toFixed(2),
            recommendedStock > currentStock
              ? "increase"
              : recommendedStock < currentStock
                ? "decrease"
                : "maintain",
            JSON.stringify({
              demandTrend: Math.random() > 0.5 ? "increasing" : "stable",
              seasonalFactor: "moderate",
              supplierReliability: "high",
              storageCost: "low",
            }),
            Math.random() > 0.6
              ? "high"
              : Math.random() > 0.3
                ? "medium"
                : "low",
            (Math.random() * 500).toFixed(2),
            "lambda-inv-opt-v1.2",
            new Date().toISOString().split("T")[0],
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
          ],
        );
      }

      res.json({
        message: "AI Analytics sample data generated successfully",
        modelsCreated: models.length,
        predictionsGenerated: products.length * 30,
        optimizationRecommendations: products.length,
      });
    } catch (error) {
      console.error("Analytics data generation error:", error);
      res.status(500).json({ error: "Failed to generate analytics data" });
    }
  });

  // Categories API endpoints
  app.get("/api/categories", async (req, res) => {
    try {
      const [rows] = await req.db.execute(
        "SELECT id, name, description FROM categories ORDER BY name ASC",
      );
      res.json({ categories: rows });
    } catch (error) {
      console.error("Categories fetch error:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Database initialization endpoint
  app.post("/api/init-database", async (req, res) => {
    try {
      // Create categories table
      await req.db.execute(`
        CREATE TABLE IF NOT EXISTS categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_name (name)
        )
      `);

      // Insert default categories
      const categories = [
        [
          "Fruits & Vegetables",
          "Fresh produce including fruits and vegetables",
        ],
        ["Dairy", "Milk, cheese, yogurt and other dairy products"],
        ["Bakery", "Bread, pastries and baked goods"],
        ["Meat & Poultry", "Fresh meat and poultry products"],
        ["Seafood", "Fresh fish and seafood"],
        ["Beverages", "Drinks including juices, sodas and water"],
        ["Snacks", "Chips, nuts and snack foods"],
        ["Grains", "Rice, pasta and grain products"],
        ["Frozen Foods", "Frozen vegetables, meals and ice cream"],
        ["Personal Care", "Health and beauty products"],
      ];

      for (const [name, description] of categories) {
        await req.db.execute(
          "INSERT IGNORE INTO categories (name, description) VALUES (?, ?)",
          [name, description],
        );
      }

      // Add category_id column to products table if it doesn't exist
      try {
        await req.db.execute(`
          ALTER TABLE products
          ADD COLUMN category_id INT,
          ADD FOREIGN KEY (category_id) REFERENCES categories(id)
        `);
      } catch (error) {
        // Column might already exist, ignore error
        console.log("Category_id column might already exist:", error.message);
      }

      // Update existing products to use category_id
      const categoryMapping = {
        "Fruits & Vegetables": 1,
        Dairy: 2,
        Bakery: 3,
        "Meat & Poultry": 4,
        Seafood: 5,
        Beverages: 6,
        Snacks: 7,
        Grains: 8,
      };

      for (const [categoryName, categoryId] of Object.entries(
        categoryMapping,
      )) {
        await req.db.execute(
          "UPDATE products SET category_id = ? WHERE category = ?",
          [categoryId, categoryName],
        );
      }

      // Create AI Analytics tables for Lambda and SageMaker integration

      // 1. Demand Forecasting Models table
      await req.db.execute(`
        CREATE TABLE IF NOT EXISTS demand_forecasting_models (
          id INT AUTO_INCREMENT PRIMARY KEY,
          model_name VARCHAR(100) NOT NULL,
          model_type ENUM('arima', 'lstm', 'prophet', 'linear_regression') NOT NULL,
          sagemaker_endpoint VARCHAR(255),
          model_artifacts_s3_path VARCHAR(500),
          training_data_s3_path VARCHAR(500),
          model_accuracy DECIMAL(5,4),
          training_status ENUM('training', 'completed', 'failed', 'deployed') DEFAULT 'training',
          created_by VARCHAR(255),
          store_id VARCHAR(50),
          category_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id) REFERENCES stores(id),
          FOREIGN KEY (category_id) REFERENCES categories(id),
          INDEX idx_model_type (model_type),
          INDEX idx_training_status (training_status),
          INDEX idx_store_category (store_id, category_id)
        )
      `);

      // 2. Demand Predictions table
      await req.db.execute(`
        CREATE TABLE IF NOT EXISTS demand_predictions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          product_id INT NOT NULL,
          store_id VARCHAR(50) NOT NULL,
          model_id INT NOT NULL,
          prediction_date DATE NOT NULL,
          predicted_demand DECIMAL(10,2) NOT NULL,
          confidence_interval_lower DECIMAL(10,2),
          confidence_interval_upper DECIMAL(10,2),
          actual_demand DECIMAL(10,2) NULL,
          prediction_accuracy DECIMAL(5,4) NULL,
          factors JSON,
          lambda_execution_id VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY (store_id) REFERENCES stores(id),
          FOREIGN KEY (model_id) REFERENCES demand_forecasting_models(id),
          INDEX idx_product_date (product_id, prediction_date),
          INDEX idx_store_date (store_id, prediction_date),
          INDEX idx_model_execution (model_id, lambda_execution_id),
          UNIQUE KEY unique_prediction (product_id, store_id, model_id, prediction_date)
        )
      `);

      // 3. Market Trends Analysis table
      await req.db.execute(`
        CREATE TABLE IF NOT EXISTS market_trends (
          id INT AUTO_INCREMENT PRIMARY KEY,
          category_id INT NOT NULL,
          store_id VARCHAR(50),
          trend_type ENUM('seasonal', 'promotional', 'competitor', 'economic', 'weather') NOT NULL,
          trend_period ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly') NOT NULL,
          trend_value DECIMAL(10,4) NOT NULL,
          trend_direction ENUM('increasing', 'decreasing', 'stable') NOT NULL,
          confidence_score DECIMAL(3,2) NOT NULL,
          external_factors JSON,
          analysis_date DATE NOT NULL,
          sagemaker_job_name VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id),
          FOREIGN KEY (store_id) REFERENCES stores(id),
          INDEX idx_category_date (category_id, analysis_date),
          INDEX idx_trend_type (trend_type, trend_period),
          INDEX idx_sagemaker_job (sagemaker_job_name)
        )
      `);

      // 4. Customer Behavior Analytics table
      await req.db.execute(`
        CREATE TABLE IF NOT EXISTS customer_behavior_analytics (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_segment VARCHAR(50) NOT NULL,
          store_id VARCHAR(50) NOT NULL,
          category_id INT NOT NULL,
          purchase_frequency DECIMAL(5,2),
          average_basket_size DECIMAL(8,2),
          price_sensitivity DECIMAL(3,2),
          seasonal_preference JSON,
          loyalty_score DECIMAL(3,2),
          churn_probability DECIMAL(3,2),
          predicted_ltv DECIMAL(10,2),
          behavior_drivers JSON,
          analysis_period_start DATE NOT NULL,
          analysis_period_end DATE NOT NULL,
          ml_model_version VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id) REFERENCES stores(id),
          FOREIGN KEY (category_id) REFERENCES categories(id),
          INDEX idx_segment_store (customer_segment, store_id),
          INDEX idx_analysis_period (analysis_period_start, analysis_period_end),
          INDEX idx_loyalty_churn (loyalty_score, churn_probability)
        )
      `);

      // 5. Inventory Optimization Recommendations table
      await req.db.execute(`
        CREATE TABLE IF NOT EXISTS inventory_optimization (
          id INT AUTO_INCREMENT PRIMARY KEY,
          product_id INT NOT NULL,
          store_id VARCHAR(50) NOT NULL,
          current_stock INT NOT NULL,
          recommended_stock INT NOT NULL,
          reorder_point INT NOT NULL,
          optimal_order_quantity INT NOT NULL,
          safety_stock INT NOT NULL,
          stockout_probability DECIMAL(3,2),
          excess_inventory_risk DECIMAL(3,2),
          cost_optimization_score DECIMAL(8,2),
          recommendation_type ENUM('increase', 'decrease', 'maintain', 'discontinue') NOT NULL,
          reasoning JSON,
          implementation_priority ENUM('high', 'medium', 'low') NOT NULL,
          estimated_cost_savings DECIMAL(10,2),
          lambda_function_version VARCHAR(50),
          analysis_date DATE NOT NULL,
          expires_at DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY (store_id) REFERENCES stores(id),
          INDEX idx_product_store (product_id, store_id),
          INDEX idx_recommendation_type (recommendation_type, implementation_priority),
          INDEX idx_analysis_expiry (analysis_date, expires_at),
          INDEX idx_cost_savings (estimated_cost_savings DESC)
        )
      `);

      // 6. AI Model Performance Metrics table
      await req.db.execute(`
        CREATE TABLE IF NOT EXISTS ai_model_metrics (
          id INT AUTO_INCREMENT PRIMARY KEY,
          model_id INT NOT NULL,
          model_name VARCHAR(100) NOT NULL,
          metric_type ENUM('accuracy', 'precision', 'recall', 'f1_score', 'mape', 'rmse', 'mae') NOT NULL,
          metric_value DECIMAL(8,6) NOT NULL,
          evaluation_dataset VARCHAR(100),
          evaluation_period_start DATE NOT NULL,
          evaluation_period_end DATE NOT NULL,
          sagemaker_training_job VARCHAR(100),
          hyperparameters JSON,
          feature_importance JSON,
          model_drift_score DECIMAL(3,2),
          retrain_recommended BOOLEAN DEFAULT FALSE,
          benchmark_comparison DECIMAL(8,6),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (model_id) REFERENCES demand_forecasting_models(id),
          INDEX idx_model_metric (model_id, metric_type),
          INDEX idx_evaluation_period (evaluation_period_start, evaluation_period_end),
          INDEX idx_drift_retrain (model_drift_score, retrain_recommended)
        )
      `);

      res.json({
        message: "Database initialized successfully with AI Analytics tables",
        categoriesCreated: categories.length,
        aiTablesCreated: 6,
      });
    } catch (error) {
      console.error("Database initialization error:", error);
      res.status(500).json({ error: "Failed to initialize database" });
    }
  });

  // Database test route
  app.get("/api/test-db", testDatabase);
  app.get("/api/test-simple", testSimple);
  app.get("/api/test-params", testParams);

  // Local database transaction routes
  app.get("/api/transactions", getTransactionsWorking);
  app.get("/api/transactions/summary", getTransactionSummaryWorking);
  app.post("/api/transactions", createTransaction);
  app.get("/api/stores", getStoresFromTransactions);
  app.get("/api/products", getProducts);

  // Local database forecasting routes
app.get("/api/analytics/demand-predictions", getDemandPredictions);
app.get("/api/analytics/forecasting-dashboard", getForecastingDashboard);
app.get("/api/analytics/forecasting-stores", getForecastingStores);
app.get("/api/analytics/forecasting-products", getForecastingProducts);
app.get("/api/analytics/category-insights", getCategoryInsights);

// AWS proxy routes
app.post("/api/aws/generate-forecast", generateForecastProxy);

  // Product Analytics routes
  app.get("/api/analytics/products/:storeId/dashboard", getAnalyticsDashboard);
  app.get(
    "/api/analytics/products/:productId/:storeId/performance",
    getProductPerformance,
  );
  app.get(
    "/api/analytics/products/:productId/:storeId/forecast",
    getDemandForecast,
  );
  app.get(
    "/api/analytics/products/:productId/:storeId/trends",
    getProductSalesTrends,
  );
  app.get("/api/analytics/stores/:storeId/reorder", getReorderRecommendations);
  app.post("/api/analytics/stores/:storeId/generate", generateStoreAnalytics);
  app.post("/api/analytics/initialize", initializeAnalytics);

  // Dashboard Analytics routes
  app.get("/api/dashboard/analytics", getDashboardAnalytics);
  app.get("/api/dashboard/categories", getTopSellingCategories);
  app.get("/api/dashboard/stores", getStores);
  app.get("/api/dashboard/low-stock", getLowStockItems);
  app.get("/api/dashboard/transactions", getRecentTransactions);

  // Database cleanup endpoint
  app.post("/api/database/cleanup", async (req, res) => {
    try {
      const success = await cleanupDatabase();
      if (success) {
        res.json({
          success: true,
          message: "Database cleanup completed successfully",
        });
      } else {
        res
          .status(500)
          .json({ success: false, message: "Database cleanup failed" });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Debug endpoint for transactions
  app.get("/api/debug/transactions", async (req, res) => {
    try {
      const [transactions] = await query(
        "SELECT * FROM inventory_transactions ORDER BY created_at DESC LIMIT 10",
      );
      const [stores] = await query("SELECT * FROM stores");
      const [products] = await query("SELECT * FROM products LIMIT 5");

      res.json({
        success: true,
        data: {
          transactions,
          stores,
          products,
          transactionCount: transactions.length,
          storeCount: stores.length,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Lambda-powered API routes
  app.get("/api/analytics/inventory", handleInventoryAnalytics);
  app.get("/api/analytics/transactions", handleTransactionAnalytics);
  app.post("/api/reorder/auto", handleAutoReorder);
  app.post("/api/transactions/process", handleTransactionProcessor);
  app.get("/api/lambda/health", handleLambdaHealthCheck);

  // Real-time analytics endpoint
  app.get("/api/analytics/realtime", async (req, res) => {
    try {
      const modifiedReq = {
        ...req,
        query: { ...req.query, action: "realTimeMetrics" },
      };
      await handleTransactionAnalytics(modifiedReq, res);
    } catch (error) {
      console.error("Real-time analytics error:", error);
      res.status(500).json({
        success: false,
        error: "Real-time analytics failed",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // AWS Lambda Error handling middleware
  // app.use((error, req, res, next) => {
  //   console.error('Server error:', error);
  //   res.status(500).json({
  //     error: 'Internal server error',
  //     message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  //   });
  // });

  return app;
}

// AWS Lambda Handler Export
// export const handler = serverless(createServer());

// RDS Database Schema and Sample Data (run this SQL to create tables and insert sample data)
// CREATE TABLE stores (
//   id VARCHAR(50) PRIMARY KEY,
//   name VARCHAR(255) NOT NULL,
//   address TEXT,
//   city VARCHAR(100),
//   state VARCHAR(100),
//   zip_code VARCHAR(20),
//   phone VARCHAR(20),
//   manager_id VARCHAR(255), -- Cognito user ID
//   status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
//   timezone VARCHAR(50) DEFAULT 'UTC',
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   INDEX idx_status (status),
//   INDEX idx_manager (manager_id)
// );
//
// CREATE TABLE products (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   name VARCHAR(255) NOT NULL,
//   description TEXT,
//   price DECIMAL(10, 2) NOT NULL,
//   quantity INT NOT NULL DEFAULT 0,
//   category VARCHAR(100),
//   sku VARCHAR(100),
//   barcode VARCHAR(100),
//   minimum_stock INT DEFAULT 5,
//   maximum_stock INT DEFAULT 100,
//   supplier_id INT,
//   store_id VARCHAR(50) NOT NULL, -- Links to stores table
//   location_in_store VARCHAR(100), -- Aisle/shelf location within store
//   status ENUM('active', 'inactive', 'discontinued') DEFAULT 'active',
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
//   INDEX idx_store_category (store_id, category),
//   INDEX idx_store_sku (store_id, sku),
//   INDEX idx_status (status),
//   UNIQUE KEY unique_sku_per_store (sku, store_id) -- SKU unique per store
// );
//
// CREATE TABLE suppliers (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   name VARCHAR(255) NOT NULL,
//   contact_person VARCHAR(255),
//   email VARCHAR(255),
//   phone VARCHAR(50),
//   address TEXT,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );
//
// CREATE TABLE user_store_access (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   user_id VARCHAR(255) NOT NULL, -- Cognito user ID
//   store_id VARCHAR(50) NOT NULL,
//   role ENUM('admin', 'manager', 'employee', 'viewer') NOT NULL,
//   granted_by VARCHAR(255), -- Cognito user ID who granted access
//   granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   expires_at TIMESTAMP NULL, -- Optional expiration
//   status ENUM('active', 'suspended', 'revoked') DEFAULT 'active',
//   FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
//   INDEX idx_user_store (user_id, store_id),
//   INDEX idx_store (store_id),
//   INDEX idx_status (status),
//   UNIQUE KEY unique_user_store (user_id, store_id)
// );
//
// CREATE TABLE inventory_transactions (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   product_id INT NOT NULL,
//   store_id VARCHAR(50) NOT NULL, -- Store where transaction occurred
//   transaction_type ENUM('sale', 'restock', 'adjustment', 'transfer') NOT NULL, -- Updated for Transaction page types
//   quantity INT NOT NULL, -- Positive for inbound, negative for outbound/adjustments
//   unit_price DECIMAL(10, 2) NOT NULL, -- Price per unit at time of transaction
//   total_amount DECIMAL(12, 2) NOT NULL, -- Total transaction value (quantity * unit_price)
//   reference_number VARCHAR(100) UNIQUE, -- Auto-generated reference (SALE-2024-001, RST-2024-002, etc.)
//   notes TEXT,
//   user_id VARCHAR(255), -- Cognito user ID who performed transaction
//   user_name VARCHAR(255), -- User's display name from Cognito attributes
//   transfer_to_store_id VARCHAR(50) NULL, -- For store-to-store transfers
//   transfer_to_store_name VARCHAR(255) NULL, -- Destination store name for transfers
//   category VARCHAR(100), -- Product category for analytics aggregation
//   product_name VARCHAR(255), -- Product name snapshot for historical records
//   audit_trail JSON, -- Additional metadata: IP address, session info, approval chain
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
//   FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
//   FOREIGN KEY (transfer_to_store_id) REFERENCES stores(id) ON DELETE SET NULL,
//   INDEX idx_product_store (product_id, store_id),
//   INDEX idx_store (store_id),
//   INDEX idx_transaction_type (transaction_type),
//   INDEX idx_created_at (created_at),
//   INDEX idx_user (user_id),
//   INDEX idx_reference_number (reference_number),
//   INDEX idx_category (category),
//   INDEX idx_transfer_stores (store_id, transfer_to_store_id),
//   INDEX idx_analytics (store_id, transaction_type, created_at) -- For Lambda analytics queries
// );
//
// -- Transaction Audit Log Table
// CREATE TABLE transaction_audit_log (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   transaction_id INT NOT NULL,
//   action ENUM('created', 'modified', 'approved', 'rejected', 'voided') NOT NULL,
//   performed_by VARCHAR(255) NOT NULL, -- Cognito user ID
//   old_values JSON, -- Previous values before modification
//   new_values JSON, -- New values after modification
//   reason TEXT, -- Reason for modification/approval/rejection
//   ip_address VARCHAR(45),
//   user_agent TEXT,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY (transaction_id) REFERENCES inventory_transactions(id) ON DELETE CASCADE,
//   INDEX idx_transaction (transaction_id),
//   INDEX idx_user (performed_by),
//   INDEX idx_action (action),
//   INDEX idx_created_at (created_at)
// );
//
// -- Sample Data INSERT Queries for RDS Tables
//
// -- 1. Insert Store Data
// INSERT INTO stores (id, name, address, city, state, zip_code, phone, manager_id, status, timezone) VALUES
// ('store_001', 'Downtown Store', '123 Main Street', 'New York', 'NY', '10001', '+1-555-0101', 'mgr_001', 'active', 'America/New_York'),
// ('store_002', 'Mall Location', '456 Shopping Center Blvd', 'New York', 'NY', '10002', '+1-555-0102', 'mgr_002', 'active', 'America/New_York'),
// ('store_003', 'Uptown Branch', '789 North Avenue', 'New York', 'NY', '10003', '+1-555-0103', 'mgr_003', 'active', 'America/New_York'),
// ('store_004', 'Westside Market', '321 West Boulevard', 'New York', 'NY', '10004', '+1-555-0104', 'mgr_004', 'active', 'America/New_York');
//
// -- 2. Insert Supplier Data
// INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES
// ('Fresh Farm Co', 'Robert Green', 'robert@freshfarm.com', '+1-555-1001', '100 Farm Road, Fresh Valley, NY 12001'),
// ('Pure Dairy Ltd', 'Maria Santos', 'maria@puredairy.com', '+1-555-1002', '200 Dairy Lane, Milk Town, NY 12002'),
// ('City Bakery', 'Pierre Dubois', 'pierre@citybakery.com', '+1-555-1003', '300 Baker Street, Bread City, NY 12003'),
// ('Premium Meats', 'John Butcher', 'john@premiummeats.com', '+1-555-1004', '400 Meat Market Ave, Beef Town, NY 12004'),
// ('Coffee Roasters Inc', 'Elena Rodriguez', 'elena@coffeeroasters.com', '+1-555-1005', '500 Coffee Bean Blvd, Brew City, NY 12005'),
// ('Ocean Fresh Co', 'Captain Jack Fisher', 'jack@oceanfresh.com', '+1-555-1006', '600 Harbor Street, Fish Port, NY 12006'),
// ('Fresh Juice Co', 'Anna Citrus', 'anna@freshjuice.com', '+1-555-1007', '700 Orchard Lane, Juice Valley, NY 12007'),
// ('Snack Masters', 'Mike Crunchy', 'mike@snackmasters.com', '+1-555-1008', '800 Snack Avenue, Chip City, NY 12008'),
// ('French Bakery', 'Sophie Baguette', 'sophie@frenchbakery.com', '+1-555-1009', '900 Paris Street, Croissant Town, NY 12009'),
// ('Energy Corp', 'Victor Power', 'victor@energycorp.com', '+1-555-1010', '1000 Energy Drive, Power City, NY 12010'),
// ('Cool Treats Ltd', 'Emma Freeze', 'emma@cooltreats.com', '+1-555-1011', '1100 Ice Cream Lane, Frozen Falls, NY 12011'),
// ('Nut Company', 'Oliver Cashew', 'oliver@nutcompany.com', '+1-555-1012', '1200 Nut Grove Road, Almond Hills, NY 12012'),
// ('Italian Foods', 'Marco Pasta', 'marco@italianfoods.com', '+1-555-1013', '1300 Pasta Way, Little Italy, NY 12013');
//
// -- 3. Insert Product Data
// INSERT INTO products (name, description, price, quantity, category, sku, barcode, minimum_stock, maximum_stock, supplier_id, store_id, location_in_store, status) VALUES
// -- Downtown Store Products
// ('Organic Bananas', 'Fresh organic bananas from local farms', 1.99, 120, 'Fruits & Vegetables', 'FV-BAN-001', '123456789012', 20, 150, 1, 'store_001', 'Aisle 1-A', 'active'),
// ('Red Apples', 'Crispy red apples, perfect for snacking', 2.49, 85, 'Fruits & Vegetables', 'FV-APP-002', '123456789013', 15, 100, 1, 'store_001', 'Aisle 1-A', 'active'),
// ('Whole Milk', 'Fresh whole milk, 3.25% fat content', 3.79, 42, 'Dairy', 'DA-MLK-003', '123456789014', 10, 60, 2, 'store_001', 'Aisle 3-B', 'active'),
// ('Cheddar Cheese', 'Aged cheddar cheese, sharp flavor', 5.99, 7, 'Dairy', 'DA-CHE-004', '123456789015', 8, 30, 2, 'store_001', 'Aisle 3-B', 'active'),
// ('Brown Bread', 'Whole wheat brown bread, sliced', 2.49, 24, 'Bakery', 'BK-BRD-005', '123456789016', 5, 40, 3, 'store_001', 'Aisle 2-C', 'active'),
//
// -- Mall Location Products
// ('Organic Carrots', 'Fresh organic carrots, bunched', 1.89, 65, 'Fruits & Vegetables', 'FV-CAR-006', '123456789017', 20, 80, 1, 'store_002', 'Aisle 1-A', 'active'),
// ('Greek Yogurt', 'Thick and creamy Greek-style yogurt', 4.99, 8, 'Dairy', 'DA-YOG-007', '123456789018', 10, 25, 2, 'store_002', 'Aisle 3-B', 'active'),
// ('Chicken Breast', 'Fresh boneless chicken breast', 12.99, 15, 'Meat & Poultry', 'MP-CHI-008', '123456789019', 5, 25, 4, 'store_002', 'Aisle 4-D', 'active'),
// ('Ground Coffee', 'Premium ground coffee, medium roast', 8.99, 32, 'Beverages', 'BV-COF-009', '123456789020', 8, 50, 5, 'store_002', 'Aisle 5-E', 'active'),
//
// -- Uptown Branch Products
// ('Fresh Salmon', 'Atlantic salmon, fresh caught', 18.99, 0, 'Seafood', 'SF-SAL-010', '123456789021', 3, 15, 6, 'store_003', 'Aisle 4-F', 'active'),
// ('Orange Juice', 'Fresh squeezed orange juice', 4.49, 28, 'Beverages', 'BV-JUI-011', '123456789022', 12, 40, 7, 'store_003', 'Aisle 5-E', 'active'),
// ('Potato Chips', 'Crispy potato chips, salt flavor', 3.99, 156, 'Snacks', 'SN-CHI-012', '123456789023', 25, 200, 8, 'store_003', 'Aisle 6-G', 'active'),
// ('Croissants', 'Fresh French croissants', 1.99, 5, 'Bakery', 'BK-CRO-013', '123456789024', 10, 30, 9, 'store_003', 'Aisle 2-C', 'active'),
//
// -- Westside Market Products
// ('Beef Steak', 'Premium beef steak, ribeye cut', 24.99, 12, 'Meat & Poultry', 'MP-STE-014', '123456789025', 3, 20, 4, 'store_004', 'Aisle 4-D', 'active'),
// ('Energy Drinks', 'High caffeine energy drinks', 2.99, 48, 'Beverages', 'BV-ENE-015', '123456789026', 20, 100, 10, 'store_004', 'Aisle 5-E', 'active'),
// ('Ice Cream', 'Premium vanilla ice cream', 6.99, 22, 'Dairy', 'DA-ICE-016', '123456789027', 8, 35, 11, 'store_004', 'Freezer A-1', 'active'),
// ('Mixed Nuts', 'Deluxe mixed nuts, roasted', 7.99, 3, 'Snacks', 'SN-NUT-017', '123456789028', 5, 25, 12, 'store_004', 'Aisle 6-G', 'active'),
// ('Pasta', 'Italian durum wheat pasta', 1.79, 67, 'Grains', 'GR-PAS-018', '123456789029', 15, 80, 13, 'store_004', 'Aisle 7-H', 'active');
//
// -- 4. Insert User Store Access Data (Sample user permissions)
// INSERT INTO user_store_access (user_id, store_id, role, granted_by, status) VALUES
// ('mgr_001', 'store_001', 'manager', 'admin_001', 'active'),
// ('mgr_002', 'store_002', 'manager', 'admin_001', 'active'),
// ('mgr_003', 'store_003', 'manager', 'admin_001', 'active'),
// ('mgr_004', 'store_004', 'manager', 'admin_001', 'active'),
// ('emp_001', 'store_001', 'employee', 'mgr_001', 'active'),
// ('emp_002', 'store_002', 'employee', 'mgr_002', 'active'),
// ('emp_003', 'store_003', 'employee', 'mgr_003', 'active'),
// ('emp_004', 'store_004', 'employee', 'mgr_004', 'active'),
// ('admin_001', 'store_001', 'admin', 'system', 'active'),
// ('admin_001', 'store_002', 'admin', 'system', 'active'),
// ('admin_001', 'store_003', 'admin', 'system', 'active'),
// ('admin_001', 'store_004', 'admin', 'system', 'active');
//
// -- 5. Insert Sample Transaction Data
// INSERT INTO inventory_transactions (product_id, store_id, transaction_type, quantity, unit_price, total_amount, reference_number, notes, user_id, user_name, transfer_to_store_id, transfer_to_store_name, category, product_name, created_at) VALUES
// -- Recent Sales - January 15, 2024
// (1, 'store_001', 'sale', 15, 1.99, 29.85, 'SALE-2024-001', 'Regular customer purchase', 'emp_001', 'John Smith', NULL, NULL, 'Fruits & Vegetables', 'Organic Bananas', '2024-01-15 14:30:00'),
// (3, 'store_001', 'sale', 4, 3.79, 15.16, 'SALE-2024-002', 'Family weekly shopping', 'emp_001', 'John Smith', NULL, NULL, 'Dairy', 'Whole Milk', '2024-01-15 14:32:00'),
// (8, 'store_002', 'sale', 2, 12.99, 25.98, 'SALE-2024-003', 'Premium meat selection', 'emp_002', 'Sarah Johnson', NULL, NULL, 'Meat & Poultry', 'Chicken Breast', '2024-01-15 15:45:00'),
// (15, 'store_004', 'sale', 6, 2.99, 17.94, 'SALE-2024-004', 'Bulk purchase discount applied', 'emp_004', 'Tom Brown', NULL, NULL, 'Beverages', 'Energy Drinks', '2024-01-15 13:10:00'),
// (12, 'store_003', 'sale', 8, 3.99, 31.92, 'SALE-2024-005', 'Party supplies purchase', 'emp_003', 'Emma Wilson', NULL, NULL, 'Snacks', 'Potato Chips', '2024-01-15 16:20:00'),
//
// -- Restocks - January 15, 2024
// (1, 'store_001', 'restock', 50, 1.20, 60.00, 'RST-2024-006', 'Weekly delivery from Fresh Farm Co', 'mgr_001', 'Lisa Davis', NULL, NULL, 'Fruits & Vegetables', 'Organic Bananas', '2024-01-15 08:00:00'),
// (3, 'store_001', 'restock', 48, 2.80, 134.40, 'RST-2024-007', 'Dairy delivery from Pure Dairy Ltd', 'mgr_001', 'Lisa Davis', NULL, NULL, 'Dairy', 'Whole Milk', '2024-01-15 08:30:00'),
// (9, 'store_002', 'restock', 24, 6.50, 156.00, 'RST-2024-008', 'Premium coffee restock', 'mgr_002', 'Mike Wilson', NULL, NULL, 'Beverages', 'Ground Coffee', '2024-01-15 09:15:00'),
// (15, 'store_004', 'restock', 72, 1.80, 129.60, 'RST-2024-009', 'High demand product restock', 'mgr_004', 'David Chen', NULL, NULL, 'Beverages', 'Energy Drinks', '2024-01-15 10:00:00'),
//
// -- Transfers - January 15, 2024
// (4, 'store_002', 'transfer', 12, 5.99, 71.88, 'TRF-2024-010', 'Low stock transfer to high-demand location', 'mgr_002', 'Mike Wilson', 'store_001', 'Downtown Store', 'Dairy', 'Cheddar Cheese', '2024-01-15 11:20:00'),
// (11, 'store_003', 'transfer', 15, 4.49, 67.35, 'TRF-2024-011', 'Excess inventory redistribution', 'mgr_003', 'Anna Garcia', 'store_004', 'Westside Market', 'Beverages', 'Orange Juice', '2024-01-15 12:00:00'),
//
// -- Adjustments - January 14-15, 2024
// (10, 'store_003', 'adjustment', -3, 18.99, -56.97, 'ADJ-2024-012', 'Expired seafood disposal', 'mgr_003', 'Anna Garcia', NULL, NULL, 'Seafood', 'Fresh Salmon', '2024-01-14 18:00:00'),
// (13, 'store_003', 'adjustment', -2, 1.99, -3.98, 'ADJ-2024-013', 'Day-old bakery items removed', 'emp_003', 'Emma Wilson', NULL, NULL, 'Bakery', 'Croissants', '2024-01-14 19:30:00'),
// (17, 'store_004', 'adjustment', -1, 7.99, -7.99, 'ADJ-2024-014', 'Damaged packaging - customer return', 'emp_004', 'Tom Brown', NULL, NULL, 'Snacks', 'Mixed Nuts', '2024-01-14 17:15:00'),
//
// -- Additional Sales from Previous Days
// (2, 'store_001', 'sale', 10, 2.49, 24.90, 'SALE-2024-015', 'Healthy fruit selection', 'emp_001', 'John Smith', NULL, NULL, 'Fruits & Vegetables', 'Red Apples', '2024-01-14 16:45:00'),
// (7, 'store_002', 'sale', 3, 4.99, 14.97, 'SALE-2024-016', 'Health-conscious customer', 'emp_002', 'Sarah Johnson', NULL, NULL, 'Dairy', 'Greek Yogurt', '2024-01-14 14:20:00'),
// (14, 'store_004', 'sale', 1.5, 24.99, 37.49, 'SALE-2024-017', 'Premium cut for dinner', 'emp_004', 'Tom Brown', NULL, NULL, 'Meat & Poultry', 'Beef Steak', '2024-01-14 17:30:00'),
// (16, 'store_004', 'sale', 2, 6.99, 13.98, 'SALE-2024-018', 'Family dessert purchase', 'emp_004', 'Tom Brown', NULL, NULL, 'Dairy', 'Ice Cream', '2024-01-14 15:00:00'),
//
// -- More Restocks from Previous Week
// (12, 'store_003', 'restock', 100, 2.50, 250.00, 'RST-2024-019', 'Large shipment from Snack Masters', 'mgr_003', 'Anna Garcia', NULL, NULL, 'Snacks', 'Potato Chips', '2024-01-13 09:00:00'),
// (18, 'store_004', 'restock', 60, 1.20, 72.00, 'RST-2024-020', 'Italian Foods weekly delivery', 'mgr_004', 'David Chen', NULL, NULL, 'Grains', 'Pasta', '2024-01-13 10:30:00');
//
// -- 6. Sample Queries for Analytics and Reporting
//
// -- Query: Get low stock items across all stores
// SELECT p.name, p.sku, p.quantity, p.minimum_stock, s.name as store_name, p.category
// FROM products p
// JOIN stores s ON p.store_id = s.id
// WHERE p.quantity <= p.minimum_stock AND p.status = 'active'
// ORDER BY p.quantity ASC;
//
// -- Query: Daily sales report by store
// SELECT
//   it.store_id,
//   s.name as store_name,
//   DATE(it.created_at) as sale_date,
//   COUNT(*) as transaction_count,
//   SUM(it.total_amount) as daily_sales,
//   AVG(it.total_amount) as avg_transaction_value
// FROM inventory_transactions it
// JOIN stores s ON it.store_id = s.id
// WHERE it.transaction_type = 'sale'
//   AND it.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
// GROUP BY it.store_id, DATE(it.created_at)
// ORDER BY sale_date DESC, daily_sales DESC;
//
// -- Query: Top selling products by category
// SELECT
//   it.category,
//   it.product_name,
//   SUM(it.quantity) as total_sold,
//   SUM(it.total_amount) as total_revenue,
//   COUNT(*) as transaction_count
// FROM inventory_transactions it
// WHERE it.transaction_type = 'sale'
//   AND it.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
// GROUP BY it.category, it.product_name
// ORDER BY total_sold DESC;
//
// -- Query: Store transfer analysis
// SELECT
//   it.store_id as from_store,
//   sf.name as from_store_name,
//   it.transfer_to_store_id as to_store,
//   st.name as to_store_name,
//   COUNT(*) as transfer_count,
//   SUM(it.total_amount) as total_transfer_value
// FROM inventory_transactions it
// JOIN stores sf ON it.store_id = sf.id
// JOIN stores st ON it.transfer_to_store_id = st.id
// WHERE it.transaction_type = 'transfer'
//   AND it.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
// GROUP BY it.store_id, it.transfer_to_store_id
// ORDER BY transfer_count DESC;
//
// -- Query: Inventory value by store and category
// SELECT
//   s.name as store_name,
//   p.category,
//   COUNT(*) as product_count,
//   SUM(p.quantity) as total_quantity,
//   SUM(p.price * p.quantity) as inventory_value
// FROM products p
// JOIN stores s ON p.store_id = s.id
// WHERE p.status = 'active'
// GROUP BY s.id, p.category
// ORDER BY store_name, inventory_value DESC;
