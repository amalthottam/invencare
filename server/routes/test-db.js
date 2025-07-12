export const testDatabase = async (req, res) => {
  try {
    // Test 1: Check if inventory_transactions table exists
    const [tables] = await req.db.execute("SHOW TABLES");
    console.log("Tables:", tables);

    // Test 2: Check inventory_transactions structure if it exists
    try {
      const [columns] = await req.db.execute("DESCRIBE inventory_transactions");
      console.log("inventory_transactions columns:", columns);
    } catch (error) {
      console.log("inventory_transactions table doesn't exist:", error.message);
    }

    // Test 3: Try a simple count
    try {
      const [count] = await req.db.execute(
        "SELECT COUNT(*) as total FROM inventory_transactions",
      );
      console.log("inventory_transactions count:", count);
    } catch (error) {
      console.log("Cannot count inventory_transactions:", error.message);
    }

    res.json({
      success: true,
      tables: tables.map((t) => Object.values(t)[0]),
      message: "Database test completed - check logs",
    });
  } catch (error) {
    console.error("Database test error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
