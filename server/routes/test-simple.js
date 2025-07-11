export const testSimple = async (req, res) => {
  try {
    // Test with no parameters
    const [rows] = await req.db.execute(
      "SELECT id, reference_number, transaction_type FROM inventory_transactions LIMIT 5",
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Simple test error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
