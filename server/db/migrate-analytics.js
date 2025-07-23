import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { query } from "./sqlite.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  try {
    console.log("🚀 Starting product analytics database migration...");

    // Read and execute the migration file
    const migrationSQL = readFileSync(
      join(__dirname, "migrations", "product-analytics.sql"),
      "utf8",
    );

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    for (const statement of statements) {
      console.log("Executing:", statement.substring(0, 50) + "...");
      await query(statement);
    }

    console.log("✅ Product analytics migration completed successfully!");

    // Verify tables were created
    const [tables] = await query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name LIKE '%analytics%' OR name LIKE '%forecast%' OR name LIKE '%reorder%'
      ORDER BY name
    `);

    console.log("\n📊 Created analytics tables:");
    tables.forEach((table) => console.log(`  - ${table.name}`));

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
