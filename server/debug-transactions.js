import { query } from "./db/sqlite.js";

async function checkTransactions() {
  try {
    console.log("=== Checking total transactions in database ===");
    const [total] = await query(
      "SELECT COUNT(*) as count FROM inventory_transactions",
    );
    console.log("Total transactions in DB:", total[0].count);

    console.log("\n=== Sample transactions with dates ===");
    const [sample] = await query(
      "SELECT reference_number, transaction_type, product_name, created_at FROM inventory_transactions ORDER BY created_at DESC LIMIT 5",
    );
    console.table(sample);

    console.log("\n=== Today filter test ===");
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    console.log("Today start:", startOfToday.toISOString());

    const [todayResults] = await query(
      "SELECT COUNT(*) as count FROM inventory_transactions WHERE datetime(created_at) >= datetime(?)",
      [startOfToday.toISOString()],
    );
    console.log(
      "Transactions today (using datetime filter):",
      todayResults[0].count,
    );

    console.log("\n=== API endpoint simulation ===");
    const params = [];
    let sql = "SELECT COUNT(*) as count FROM inventory_transactions WHERE 1=1";

    // Simulate today filter from API
    const now = new Date();
    const startDateTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    sql += " AND datetime(created_at) >= datetime(?)";
    params.push(startDateTime.toISOString());

    const [apiResults] = await query(sql, params);
    console.log("API simulation result:", apiResults[0].count);

    console.log("\n=== Missing date filter issue ===");
    // Check if the issue is in the count query missing date filters
    const [countWithoutDateFilter] = await query(
      "SELECT COUNT(*) as count FROM inventory_transactions WHERE 1=1",
    );
    console.log(
      "Count without date filter (what API might be using):",
      countWithoutDateFilter[0].count,
    );

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkTransactions();
