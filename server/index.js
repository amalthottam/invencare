import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo.js";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Basic ping route
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });

  // Demo route
  app.get("/api/demo", handleDemo);

  // Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`InvenCare server running on port ${PORT}`);
  });

  return app;
}

// ✅ Call createServer() only if run directly (not when imported as a module)
if (import.meta.url === `file://${process.argv[1]}`) {
  createServer();
}
