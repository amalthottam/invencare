import mysql from "mysql2/promise";

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "inventory_management",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Database connected successfully");
    connection.release();
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    return false;
  }
};

// Initialize database and create tables if they don't exist
export const initializeDatabase = async () => {
  try {
    const connection = await pool.getConnection();

    // Create database if it doesn't exist
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`,
    );
    await connection.execute(`USE ${dbConfig.database}`);

    // Create stores table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stores (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create products table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        unit_price DECIMAL(10, 2),
        current_stock INT DEFAULT 0,
        store_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id)
      )
    `);

    // Create inventory_transactions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reference_number VARCHAR(100) UNIQUE NOT NULL,
        transaction_type ENUM('Sale', 'Restock', 'Adjustment', 'Transfer') NOT NULL,
        product_id VARCHAR(50),
        product_name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        store_id VARCHAR(50) NOT NULL,
        store_name VARCHAR(255) NOT NULL,
        transfer_to_store_id VARCHAR(50) NULL,
        transfer_to_store_name VARCHAR(255) NULL,
        user_id VARCHAR(100) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id),
        FOREIGN KEY (transfer_to_store_id) REFERENCES stores(id),
        INDEX idx_transaction_type (transaction_type),
        INDEX idx_store_id (store_id),
        INDEX idx_created_at (created_at),
        INDEX idx_reference_number (reference_number)
      )
    `);

    console.log("✅ Database tables initialized successfully");
    connection.release();
    return true;
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
    return false;
  }
};

// Insert sample data if tables are empty
export const seedSampleData = async () => {
  try {
    const connection = await pool.getConnection();

    // Check if stores table is empty
    const [storeRows] = await connection.execute(
      "SELECT COUNT(*) as count FROM stores",
    );

    if (storeRows[0].count === 0) {
      // Insert sample stores
      const stores = [
        ["store_001", "Downtown Store", "123 Main St"],
        ["store_002", "Mall Location", "456 Shopping Center"],
        ["store_003", "Uptown Branch", "789 North Ave"],
        ["store_004", "Westside Market", "321 West Blvd"],
      ];

      for (const store of stores) {
        await connection.execute(
          "INSERT INTO stores (id, name, location) VALUES (?, ?, ?)",
          store,
        );
      }

      // Insert sample products
      const products = [
        [
          "FV-BAN-001",
          "Organic Bananas",
          "Fruits & Vegetables",
          1.99,
          100,
          "store_001",
        ],
        ["DA-MLK-003", "Whole Milk", "Dairy", 3.79, 50, "store_001"],
        [
          "MP-CHI-008",
          "Chicken Breast",
          "Meat & Poultry",
          12.99,
          25,
          "store_002",
        ],
        ["BV-ENE-015", "Energy Drinks", "Beverages", 2.99, 75, "store_004"],
        ["SN-CHI-012", "Potato Chips", "Snacks", 3.99, 60, "store_003"],
        ["BV-COF-009", "Ground Coffee", "Beverages", 8.99, 30, "store_002"],
        ["DA-CHE-004", "Cheddar Cheese", "Dairy", 5.99, 40, "store_002"],
        ["SF-SAL-010", "Fresh Salmon", "Seafood", 18.99, 15, "store_003"],
        ["BK-CRO-013", "Croissants", "Bakery", 1.99, 35, "store_003"],
        ["SN-NUT-017", "Mixed Nuts", "Snacks", 7.99, 45, "store_004"],
      ];

      for (const product of products) {
        await connection.execute(
          "INSERT INTO products (id, name, category, unit_price, current_stock, store_id) VALUES (?, ?, ?, ?, ?, ?)",
          product,
        );
      }

      // Insert sample transactions
      const transactions = [
        [
          "SALE-2024-001",
          "Sale",
          "FV-BAN-001",
          "Organic Bananas",
          "Fruits & Vegetables",
          15,
          1.99,
          29.85,
          "store_001",
          "Downtown Store",
          null,
          null,
          "emp_001",
          "John Smith",
          "Regular customer purchase",
        ],
        [
          "SALE-2024-002",
          "Sale",
          "DA-MLK-003",
          "Whole Milk",
          "Dairy",
          4,
          3.79,
          15.16,
          "store_001",
          "Downtown Store",
          null,
          null,
          "emp_001",
          "John Smith",
          "Family weekly shopping",
        ],
        [
          "SALE-2024-003",
          "Sale",
          "MP-CHI-008",
          "Chicken Breast",
          "Meat & Poultry",
          2,
          12.99,
          25.98,
          "store_002",
          "Mall Location",
          null,
          null,
          "emp_002",
          "Sarah Johnson",
          "Premium meat selection",
        ],
        [
          "RST-2024-006",
          "Restock",
          "FV-BAN-001",
          "Organic Bananas",
          "Fruits & Vegetables",
          50,
          1.2,
          60.0,
          "store_001",
          "Downtown Store",
          null,
          null,
          "mgr_001",
          "Lisa Davis",
          "Weekly delivery from Fresh Farm Co",
        ],
        [
          "TRF-2024-010",
          "Transfer",
          "DA-CHE-004",
          "Cheddar Cheese",
          "Dairy",
          12,
          5.99,
          71.88,
          "store_002",
          "Mall Location",
          "store_001",
          "Downtown Store",
          "mgr_002",
          "Mike Wilson",
          "Low stock transfer to high-demand location",
        ],
        [
          "ADJ-2024-012",
          "Adjustment",
          "SF-SAL-010",
          "Fresh Salmon",
          "Seafood",
          -3,
          18.99,
          -56.97,
          "store_003",
          "Uptown Branch",
          null,
          null,
          "mgr_003",
          "Anna Garcia",
          "Expired seafood disposal",
        ],
      ];

      for (const transaction of transactions) {
        await connection.execute(
          `
          INSERT INTO inventory_transactions 
          (reference_number, transaction_type, product_id, product_name, category, quantity, unit_price, total_amount, store_id, store_name, transfer_to_store_id, transfer_to_store_name, user_id, user_name, notes) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          transaction,
        );
      }

      console.log("✅ Sample data seeded successfully");
    } else {
      console.log("📊 Database already contains data, skipping seeding");
    }

    connection.release();
    return true;
  } catch (error) {
    console.error("❌ Data seeding failed:", error.message);
    return false;
  }
};

export default pool;
