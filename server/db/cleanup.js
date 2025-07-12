import { query } from "./sqlite.js";

export const cleanupDatabase = async () => {
  try {
    console.log("🧹 Starting database cleanup...");

    // Check for duplicate stores
    const [duplicateStores] = await query(`
      SELECT id, name, COUNT(*) as count 
      FROM stores 
      GROUP BY id 
      HAVING COUNT(*) > 1
    `);

    if (duplicateStores.length > 0) {
      console.log("❌ Found duplicate stores:", duplicateStores);
    } else {
      console.log("✅ No duplicate stores found");
    }

    // Check for duplicate transactions
    const [duplicateTransactions] = await query(`
      SELECT reference_number, COUNT(*) as count 
      FROM inventory_transactions 
      GROUP BY reference_number 
      HAVING COUNT(*) > 1
    `);

    if (duplicateTransactions.length > 0) {
      console.log("❌ Found duplicate transactions:", duplicateTransactions);

      // Remove duplicates, keeping only the first occurrence
      for (const dup of duplicateTransactions) {
        await query(
          `
          DELETE FROM inventory_transactions 
          WHERE reference_number = ? AND id NOT IN (
            SELECT id FROM inventory_transactions 
            WHERE reference_number = ? 
            ORDER BY id LIMIT 1
          )
        `,
          [dup.reference_number, dup.reference_number],
        );
      }
      console.log("🧹 Removed duplicate transactions");
    } else {
      console.log("✅ No duplicate transactions found");
    }

    // Check for transactions with invalid store_ids
    const [invalidStoreTransactions] = await query(`
      SELECT it.id, it.reference_number, it.store_id
      FROM inventory_transactions it 
      LEFT JOIN stores s ON it.store_id = s.id 
      WHERE s.id IS NULL
    `);

    if (invalidStoreTransactions.length > 0) {
      console.log(
        "❌ Found transactions with invalid store_ids:",
        invalidStoreTransactions,
      );
    } else {
      console.log("✅ All transactions have valid store_ids");
    }

    // Check for transactions with negative total amounts for sales
    const [negativeSales] = await query(`
      SELECT id, reference_number, transaction_type, total_amount 
      FROM inventory_transactions 
      WHERE transaction_type = 'Sale' AND total_amount < 0
    `);

    if (negativeSales.length > 0) {
      console.log("❌ Found sales with negative amounts:", negativeSales);
    } else {
      console.log("✅ No sales with negative amounts found");
    }

    // Check for transactions with zero quantities
    const [zeroQuantityTransactions] = await query(`
      SELECT id, reference_number, transaction_type, quantity 
      FROM inventory_transactions 
      WHERE quantity = 0
    `);

    if (zeroQuantityTransactions.length > 0) {
      console.log(
        "❌ Found transactions with zero quantities:",
        zeroQuantityTransactions,
      );
    } else {
      console.log("✅ No transactions with zero quantities found");
    }

    // Get database stats
    const [transactionCount] = await query(
      "SELECT COUNT(*) as count FROM inventory_transactions",
    );
    const [storeCount] = await query("SELECT COUNT(*) as count FROM stores");
    const [productCount] = await query(
      "SELECT COUNT(*) as count FROM products",
    );

    console.log("\n📊 Database Statistics:");
    console.log(`- Stores: ${storeCount[0].count}`);
    console.log(`- Products: ${productCount[0].count}`);
    console.log(`- Transactions: ${transactionCount[0].count}`);

    // Check transaction distribution by type
    const [transactionTypes] = await query(`
      SELECT transaction_type, COUNT(*) as count 
      FROM inventory_transactions 
      GROUP BY transaction_type 
      ORDER BY count DESC
    `);

    console.log("\n📈 Transaction Types:");
    transactionTypes.forEach((type) => {
      console.log(`- ${type.transaction_type}: ${type.count}`);
    });

    console.log("\n✅ Database cleanup completed!");
    return true;
  } catch (error) {
    console.error("❌ Database cleanup failed:", error);
    return false;
  }
};
