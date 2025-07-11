import { ProductAnalyticsService } from "../services/productAnalytics.js";
import { createApiResponse, createApiError } from "../../shared/api.js";

// Get product performance analytics
export const getProductPerformance = async (req, res) => {
  try {
    const { productId, storeId } = req.params;
    const { days = 30 } = req.query;

    const performance =
      await ProductAnalyticsService.calculateProductPerformance(
        productId,
        storeId,
        parseInt(days),
      );

    res
      .status(200)
      .json(
        createApiResponse(
          performance,
          "Product performance calculated successfully",
        ),
      );
  } catch (error) {
    console.error("Get product performance error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get demand forecast for a product
export const getDemandForecast = async (req, res) => {
  try {
    const { productId, storeId } = req.params;
    const { forecastDays = 30 } = req.query;

    const forecast = await ProductAnalyticsService.generateDemandForecast(
      productId,
      storeId,
      parseInt(forecastDays),
    );

    res
      .status(200)
      .json(
        createApiResponse(forecast, "Demand forecast generated successfully"),
      );
  } catch (error) {
    console.error("Get demand forecast error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get reorder recommendations for a store
export const getReorderRecommendations = async (req, res) => {
  try {
    const { storeId } = req.params;

    const recommendations =
      await ProductAnalyticsService.generateReorderRecommendations(storeId);

    res
      .status(200)
      .json(
        createApiResponse(
          { recommendations },
          "Reorder recommendations generated successfully",
        ),
      );
  } catch (error) {
    console.error("Get reorder recommendations error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get analytics dashboard data
export const getAnalyticsDashboard = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { days = 30 } = req.query;

    const dashboard = await ProductAnalyticsService.getAnalyticsDashboard(
      storeId,
      parseInt(days),
    );

    res
      .status(200)
      .json(createApiResponse(dashboard, "Analytics dashboard data retrieved"));
  } catch (error) {
    console.error("Get analytics dashboard error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Get product sales trends
export const getProductSalesTrends = async (req, res) => {
  try {
    const { productId, storeId } = req.params;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // This is a mock implementation - in production, you'd query the product_sales_trends table
    const trends = [];
    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      trends.push({
        date: date.toISOString().split("T")[0],
        unitsSold: Math.floor(Math.random() * 20),
        revenue: Math.floor(Math.random() * 500),
        averagePrice: 15.99 + Math.random() * 10,
      });
    }

    res
      .status(200)
      .json(createApiResponse({ trends }, "Sales trends retrieved"));
  } catch (error) {
    console.error("Get product sales trends error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Initialize analytics tables
export const initializeAnalytics = async (req, res) => {
  try {
    await ProductAnalyticsService.initializeTables();
    res
      .status(200)
      .json(createApiResponse({}, "Analytics tables initialized successfully"));
  } catch (error) {
    console.error("Initialize analytics error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Generate analytics for all products in a store
export const generateStoreAnalytics = async (req, res) => {
  try {
    const { storeId } = req.params;

    // Get all products in the store
    const [products] = await req.db.query(
      "SELECT id FROM products WHERE store_id = ?",
      [storeId],
    );

    const analytics = [];
    for (const product of products) {
      try {
        const performance =
          await ProductAnalyticsService.calculateProductPerformance(
            product.id,
            storeId,
            30,
          );
        analytics.push(performance);
      } catch (error) {
        console.error(`Error calculating analytics for ${product.id}:`, error);
      }
    }

    res
      .status(200)
      .json(
        createApiResponse(
          { analytics, total: analytics.length },
          "Store analytics generated successfully",
        ),
      );
  } catch (error) {
    console.error("Generate store analytics error:", error);
    res.status(500).json(createApiError(error));
  }
};
