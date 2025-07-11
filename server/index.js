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
          p.category,
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
          p.location_in_store as location
        FROM products p
        JOIN stores s ON p.store_id = s.id
        LEFT JOIN suppliers sup ON p.supplier_id = sup.id
        WHERE p.status = 'active'
        ORDER BY p.updated_at DESC`,
      );
      res.json({ products: rows });
    } catch (error) {
      console.error("Products fetch error:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const {
        productName,
        productId,
        category,
        storeName,
        stock,
        unit,
        price = 0,
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
        "INSERT INTO products (name, sku, category, quantity, price, store_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [productName, productId, category, stock, price, storeId, "active"],
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
      const { productName, productId, category, stock, price } = req.body;
      await req.db.execute(
        "UPDATE products SET name=?, sku=?, category=?, quantity=?, price=? WHERE id=?",
        [productName, productId, category, stock, price, id],
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

      res.json({
        message: "Database initialized successfully",
        categoriesCreated: categories.length,
      });
    } catch (error) {
      console.error("Database initialization error:", error);
      res.status(500).json({ error: "Failed to initialize database" });
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
