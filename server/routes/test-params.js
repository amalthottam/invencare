export const testParams = async (req, res) => {
  try {
    // Test with parameters
    const [rows] = await req.db.execute(
      "SELECT id, reference_number FROM inventory_transactions LIMIT ? OFFSET ?",
      [5, 0],
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Params test error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
