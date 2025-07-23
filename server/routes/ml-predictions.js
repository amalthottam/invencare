import { Router } from "express";
import sagemakerService from "../services/sagemaker-db-integration.js";

const router = Router();

// Forecast demand for a specific product
router.post("/forecast", async (req, res) => {
  try {
    const {
      product_id,
      store_id,
      forecast_days = 30,
      model_type = "lstm",
    } = req.body;

    if (!product_id || !store_id) {
      return res.status(400).json({
        error: "product_id and store_id are required",
      });
    }

    const result = await sagemakerService.forecastDemand(
      product_id,
      store_id,
      forecast_days,
      model_type,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Forecast error:", error);
    res.status(500).json({
      error: "Failed to generate forecast",
      message: error.message,
    });
  }
});

// Classify product (ABC analysis)
router.post("/classify", async (req, res) => {
  try {
    const { product_id, store_id } = req.body;

    if (!product_id || !store_id) {
      return res.status(400).json({
        error: "product_id and store_id are required",
      });
    }

    const result = await sagemakerService.classifyProduct(product_id, store_id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Classification error:", error);
    res.status(500).json({
      error: "Failed to classify product",
      message: error.message,
    });
  }
});

// Get latest predictions for a product
router.get("/latest/:product_id/:store_id", async (req, res) => {
  try {
    const { product_id, store_id } = req.params;

    const predictions = await sagemakerService.getLatestPredictions(
      product_id,
      store_id,
    );

    res.json({
      success: true,
      data: predictions,
    });
  } catch (error) {
    console.error("Get predictions error:", error);
    res.status(500).json({
      error: "Failed to fetch predictions",
      message: error.message,
    });
  }
});

// Batch predictions for entire store
router.post("/batch/:store_id", async (req, res) => {
  try {
    const { store_id } = req.params;
    const { model_type = "lstm" } = req.body;

    // This might take a while, so we'll start the process and return immediately
    const result = await sagemakerService.batchPredictStore(
      store_id,
      model_type,
    );

    res.json({
      success: true,
      message: "Batch prediction completed",
      data: result,
    });
  } catch (error) {
    console.error("Batch prediction error:", error);
    res.status(500).json({
      error: "Failed to run batch predictions",
      message: error.message,
    });
  }
});

// Get training data for a product (for debugging/analysis)
router.get("/training-data/:product_id/:store_id", async (req, res) => {
  try {
    const { product_id, store_id } = req.params;
    const { days = 90 } = req.query;

    const data = await sagemakerService.getTrainingData(
      product_id,
      store_id,
      parseInt(days),
    );

    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Training data error:", error);
    res.status(500).json({
      error: "Failed to fetch training data",
      message: error.message,
    });
  }
});

// Get product features (for debugging/analysis)
router.get("/features/:product_id/:store_id", async (req, res) => {
  try {
    const { product_id, store_id } = req.params;

    const features = await sagemakerService.getProductFeatures(
      product_id,
      store_id,
    );

    res.json({
      success: true,
      data: features,
    });
  } catch (error) {
    console.error("Features error:", error);
    res.status(500).json({
      error: "Failed to fetch product features",
      message: error.message,
    });
  }
});

// Health check for SageMaker endpoints
router.get("/health", async (req, res) => {
  try {
    const { model_type = "lstm" } = req.query;

    // Test with dummy data
    const testData = {
      historical_data: [10, 12, 15, 8, 20, 18, 14, 16, 11, 13],
      forecast_days: 7,
    };

    const result = await sagemakerService.predict(model_type, testData);

    res.json({
      success: true,
      message: `${model_type} endpoint is healthy`,
      data: {
        endpoint_name: sagemakerService.endpoints[model_type],
        response_time: new Date().toISOString(),
        test_prediction: result,
      },
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      error: "Endpoint health check failed",
      message: error.message,
    });
  }
});

export default router;
