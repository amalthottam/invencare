import sqlite3 from "sqlite3";
import { promisify } from "util";

// Create SQLite database
const db = new sqlite3.Database(":memory:"); // Use in-memory database for demo

// Promisify database methods
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// Initialize database with tables and sample data
export const initializeDatabase = async () => {
  try {
    // Create stores table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create inventory_transactions table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference_number TEXT UNIQUE NOT NULL,
        transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Sale', 'Restock', 'Adjustment', 'Transfer')),
        product_id TEXT,
        product_name TEXT NOT NULL,
        category TEXT,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_amount REAL NOT NULL,
        store_id TEXT NOT NULL,
        store_name TEXT NOT NULL,
        transfer_to_store_id TEXT,
        transfer_to_store_name TEXT,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id)
      )
    `);

    // Create products table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        unit_price REAL,
        current_stock INTEGER DEFAULT 0,
        store_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id)
      )
    `);

    console.log("✅ SQLite database tables created successfully");
    return true;
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
    return false;
  }
};

export const seedSampleData = async () => {
  try {
    // Check if stores already exist
    const storeCount = await dbGet("SELECT COUNT(*) as count FROM stores");

    if (storeCount.count === 0) {
      // Insert sample stores
      const stores = [
        ["store_001", "Downtown Store", "123 Main St"],
        ["store_002", "Mall Location", "456 Shopping Center"],
        ["store_003", "Uptown Branch", "789 North Ave"],
        ["store_004", "Westside Market", "321 West Blvd"],
      ];

      for (const store of stores) {
        await dbRun(
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
        await dbRun(
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
        await dbRun(
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

    return true;
  } catch (error) {
    console.error("❌ Data seeding failed:", error.message);
    return false;
  }
};

// Database query functions
export const query = async (sql, params = []) => {
  try {
    if (sql.trim().toLowerCase().startsWith("select")) {
      const rows = await dbAll(sql, params);
      return [rows];
    } else {
      const result = await dbRun(sql, params);
      return [
        {
          insertId: result?.lastID || result,
          affectedRows: result?.changes || 1,
        },
      ];
    }
  } catch (error) {
    throw error;
  }
};

export default {
  query,
  get: dbGet,
  all: dbAll,
  run: dbRun,
};
