import { query } from "../db/sqlite.js";

export class ProductAnalyticsService {
  // Initialize analytics tables (call this on app startup)
  static async initializeTables() {
    try {
      // Basic analytics tables
      await query(`
        CREATE TABLE IF NOT EXISTS product_performance_analytics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id VARCHAR(50) NOT NULL,
          store_id VARCHAR(50) NOT NULL,
          analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
          period_type VARCHAR(20) NOT NULL,
          total_sales_volume INTEGER DEFAULT 0,
          total_sales_revenue DECIMAL(10,2) DEFAULT 0.00,
          average_sale_price DECIMAL(10,2) DEFAULT 0.00,
          sales_velocity DECIMAL(8,2) DEFAULT 0.00,
          average_inventory DECIMAL(10,2) DEFAULT 0.00,
          inventory_turnover DECIMAL(8,2) DEFAULT 0.00,
          days_inventory_outstanding INTEGER DEFAULT 0,
          stockout_occurrences INTEGER DEFAULT 0,
          gross_profit DECIMAL(10,2) DEFAULT 0.00,
          profit_margin DECIMAL(5,2) DEFAULT 0.00,
          abc_classification VARCHAR(1),
          performance_score DECIMAL(5,2) DEFAULT 0.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(product_id, store_id, analysis_date, period_type)
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS product_sales_trends (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id VARCHAR(50) NOT NULL,
          store_id VARCHAR(50) NOT NULL,
          trend_date DATE NOT NULL,
          units_sold INTEGER DEFAULT 0,
          revenue DECIMAL(10,2) DEFAULT 0.00,
          average_price DECIMAL(10,2) DEFAULT 0.00,
          ending_inventory INTEGER DEFAULT 0,
          week_over_week_growth DECIMAL(5,2) DEFAULT 0.00,
          month_over_month_growth DECIMAL(5,2) DEFAULT 0.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(product_id, store_id, trend_date)
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS product_demand_forecasts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id VARCHAR(50) NOT NULL,
          store_id VARCHAR(50) NOT NULL,
          forecast_date DATE NOT NULL,
          forecast_period INTEGER NOT NULL,
          linear_forecast DECIMAL(10,2) DEFAULT 0.00,
          seasonal_forecast DECIMAL(10,2) DEFAULT 0.00,
          arima_forecast DECIMAL(10,2) DEFAULT 0.00,
          lstm_forecast DECIMAL(10,2) DEFAULT 0.00,
          ensemble_forecast DECIMAL(10,2) DEFAULT 0.00,
          confidence_interval_lower DECIMAL(10,2) DEFAULT 0.00,
          confidence_interval_upper DECIMAL(10,2) DEFAULT 0.00,
          forecast_accuracy_score DECIMAL(5,2) DEFAULT 0.00,
          actual_sales INTEGER DEFAULT NULL,
          forecast_error DECIMAL(10,2) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(product_id, store_id, forecast_date, forecast_period)
        )
      `);

      console.log("✅ Product analytics tables initialized");
    } catch (error) {
      console.error("❌ Failed to initialize analytics tables:", error);
    }
  }

  // Calculate product performance metrics
  static async calculateProductPerformance(productId, storeId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get sales data from transactions
      const [salesData] = await query(
        `
        SELECT 
          COUNT(*) as transaction_count,
          SUM(quantity) as total_volume,
          SUM(total_amount) as total_revenue,
          AVG(unit_price) as avg_price
        FROM inventory_transactions 
        WHERE product_id = ? 
          AND store_id = ? 
          AND transaction_type = 'Sale'
          AND datetime(created_at) >= datetime(?)
        `,
        [productId, storeId, startDate.toISOString()],
      );

      // Get current product info
      const [productInfo] = await query(
        `
        SELECT quantity as current_stock, minimum_stock, maximum_stock, price
        FROM products 
        WHERE id = ? AND store_id = ?
        `,
        [productId, storeId],
      );

      if (!productInfo.length) {
        throw new Error("Product not found");
      }

      const sales = salesData[0] || {};
      const product = productInfo[0];

      // Calculate metrics
      const salesVelocity = (sales.total_volume || 0) / days;
      const inventoryTurnover =
        product.current_stock > 0
          ? (sales.total_volume || 0) / product.current_stock
          : 0;
      const daysInventoryOutstanding =
        salesVelocity > 0 ? product.current_stock / salesVelocity : 999;

      // ABC Classification based on revenue
      let abcClass = "C";
      if ((sales.total_revenue || 0) > 1000) abcClass = "A";
      else if ((sales.total_revenue || 0) > 500) abcClass = "B";

      // Performance score (0-100)
      const performanceScore = Math.min(
        100,
        salesVelocity * 10 +
          inventoryTurnover * 20 +
          (abcClass === "A" ? 30 : abcClass === "B" ? 15 : 5),
      );

      return {
        productId,
        storeId,
        totalSalesVolume: sales.total_volume || 0,
        totalSalesRevenue: sales.total_revenue || 0,
        averageSalePrice: sales.avg_price || 0,
        salesVelocity: parseFloat(salesVelocity.toFixed(2)),
        inventoryTurnover: parseFloat(inventoryTurnover.toFixed(2)),
        daysInventoryOutstanding: Math.round(daysInventoryOutstanding),
        abcClassification: abcClass,
        performanceScore: parseFloat(performanceScore.toFixed(2)),
        currentStock: product.current_stock,
        transactionCount: sales.transaction_count || 0,
      };
    } catch (error) {
      console.error("Error calculating product performance:", error);
      throw error;
    }
  }

  // Generate demand forecast using multiple models
  static async generateDemandForecast(productId, storeId, forecastDays = 30) {
    try {
      // Get historical sales data (last 90 days)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const [historicalData] = await query(
        `
        SELECT 
          DATE(created_at) as sale_date,
          SUM(quantity) as daily_sales
        FROM inventory_transactions 
        WHERE product_id = ? 
          AND store_id = ? 
          AND transaction_type = 'Sale'
          AND datetime(created_at) >= datetime(?)
        GROUP BY DATE(created_at)
        ORDER BY sale_date
        `,
        [productId, storeId, startDate.toISOString()],
      );

      if (historicalData.length < 7) {
        throw new Error("Insufficient historical data for forecasting");
      }

      const salesData = historicalData.map((row) => row.daily_sales);
      const avgDailySales =
        salesData.reduce((a, b) => a + b, 0) / salesData.length;

      // Simple linear trend
      const linearForecast = avgDailySales * forecastDays;

      // Seasonal forecast (basic seasonality detection)
      const seasonalMultiplier = this.calculateSeasonalIndex(salesData);
      const seasonalForecast = linearForecast * seasonalMultiplier;

      // ARIMA-like forecast (simplified moving average with trend)
      const arimaForecast = this.simpleARIMAForecast(salesData, forecastDays);

      // LSTM-like forecast (pattern-based forecast)
      const lstmForecast = this.simpleLSTMForecast(salesData, forecastDays);

      // Ensemble forecast (weighted average)
      const ensembleForecast =
        linearForecast * 0.25 +
        seasonalForecast * 0.25 +
        arimaForecast * 0.25 +
        lstmForecast * 0.25;

      // Confidence intervals (±20% for simplicity)
      const confidence = ensembleForecast * 0.2;

      return {
        productId,
        storeId,
        forecastPeriod: forecastDays,
        linearForecast: parseFloat(linearForecast.toFixed(2)),
        seasonalForecast: parseFloat(seasonalForecast.toFixed(2)),
        arimaForecast: parseFloat(arimaForecast.toFixed(2)),
        lstmForecast: parseFloat(lstmForecast.toFixed(2)),
        ensembleForecast: parseFloat(ensembleForecast.toFixed(2)),
        confidenceIntervalLower: parseFloat(
          (ensembleForecast - confidence).toFixed(2),
        ),
        confidenceIntervalUpper: parseFloat(
          (ensembleForecast + confidence).toFixed(2),
        ),
        forecastAccuracyScore: 85.0, // Mock accuracy score
        historicalDataPoints: salesData.length,
      };
    } catch (error) {
      console.error("Error generating demand forecast:", error);
      throw error;
    }
  }

  // Helper method to calculate seasonal index
  static calculateSeasonalIndex(salesData) {
    if (salesData.length < 14) return 1.0;

    const recentAvg = salesData.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const overallAvg = salesData.reduce((a, b) => a + b, 0) / salesData.length;

    return overallAvg > 0 ? recentAvg / overallAvg : 1.0;
  }

  // Simplified ARIMA forecast
  static simpleARIMAForecast(salesData, forecastDays) {
    if (salesData.length < 3)
      return salesData[salesData.length - 1] * forecastDays;

    // Calculate trend
    const recent = salesData.slice(-7);
    const trend =
      recent.length > 1
        ? (recent[recent.length - 1] - recent[0]) / (recent.length - 1)
        : 0;

    const lastValue = salesData[salesData.length - 1];
    const avgDailySales = recent.reduce((a, b) => a + b, 0) / recent.length;

    return Math.max(
      0,
      (avgDailySales + (trend * forecastDays) / 2) * forecastDays,
    );
  }

  // Simplified LSTM-like forecast
  static simpleLSTMForecast(salesData, forecastDays) {
    if (salesData.length < 7)
      return salesData[salesData.length - 1] * forecastDays;

    // Look for weekly patterns
    const weeklyPattern = [];
    for (let i = 0; i < 7; i++) {
      const dayValues = salesData.filter((_, index) => index % 7 === i);
      weeklyPattern[i] =
        dayValues.length > 0
          ? dayValues.reduce((a, b) => a + b, 0) / dayValues.length
          : 0;
    }

    let totalForecast = 0;
    for (let day = 0; day < forecastDays; day++) {
      totalForecast += weeklyPattern[day % 7];
    }

    return totalForecast;
  }

  // Generate reorder recommendations
  static async generateReorderRecommendations(storeId) {
    try {
      const [products] = await query(
        `
        SELECT 
          id as product_id,
          name,
          quantity as current_stock,
          minimum_stock,
          maximum_stock,
          price
        FROM products 
        WHERE store_id = ? AND quantity <= minimum_stock * 1.2
        ORDER BY (minimum_stock - quantity) DESC
        `,
        [storeId],
      );

      const recommendations = [];

      for (const product of products) {
        try {
          // Get demand forecast for next 14 days
          const forecast = await this.generateDemandForecast(
            product.product_id,
            storeId,
            14,
          );

          const projectedDemand = forecast.ensembleForecast;
          const stockNeeded = Math.max(
            0,
            projectedDemand + product.minimum_stock - product.current_stock,
          );

          let urgencyLevel = "normal";
          if (product.current_stock <= 0) urgencyLevel = "critical";
          else if (product.current_stock <= product.minimum_stock * 0.5)
            urgencyLevel = "high";
          else if (product.current_stock <= product.minimum_stock)
            urgencyLevel = "normal";

          recommendations.push({
            productId: product.product_id,
            productName: product.name,
            currentStock: product.current_stock,
            minimumStock: product.minimum_stock,
            maximumStock: product.maximum_stock,
            projectedDemand14Days: Math.round(projectedDemand),
            recommendedOrderQuantity: Math.round(stockNeeded),
            urgencyLevel,
            estimatedStockoutRisk:
              product.current_stock <= product.minimum_stock
                ? "High"
                : "Medium",
            forecastAccuracy: forecast.forecastAccuracyScore,
          });
        } catch (forecastError) {
          console.error(
            `Forecast error for product ${product.product_id}:`,
            forecastError,
          );
          // Fallback recommendation
          recommendations.push({
            productId: product.product_id,
            productName: product.name,
            currentStock: product.current_stock,
            minimumStock: product.minimum_stock,
            maximumStock: product.maximum_stock,
            projectedDemand14Days: 0,
            recommendedOrderQuantity:
              product.minimum_stock - product.current_stock,
            urgencyLevel: product.current_stock <= 0 ? "critical" : "normal",
            estimatedStockoutRisk: "Unknown",
            forecastAccuracy: 0,
          });
        }
      }

      return recommendations;
    } catch (error) {
      console.error("Error generating reorder recommendations:", error);
      throw error;
    }
  }

  // Get analytics dashboard data
  static async getAnalyticsDashboard(storeId, days = 30) {
    try {
      // Get top performing products
      const [topProducts] = await query(
        `
        SELECT 
          it.product_id,
          it.product_name,
          SUM(it.quantity) as total_sold,
          SUM(it.total_amount) as total_revenue,
          COUNT(*) as transaction_count
        FROM inventory_transactions it
        WHERE it.store_id = ? 
          AND it.transaction_type = 'Sale'
          AND datetime(it.created_at) >= datetime(date('now', '-${days} days'))
        GROUP BY it.product_id, it.product_name
        ORDER BY total_revenue DESC
        LIMIT 10
        `,
        [storeId],
      );

      // Get category performance
      const [categoryPerformance] = await query(
        `
        SELECT 
          it.category,
          SUM(it.quantity) as total_sold,
          SUM(it.total_amount) as total_revenue,
          COUNT(DISTINCT it.product_id) as unique_products
        FROM inventory_transactions it
        WHERE it.store_id = ? 
          AND it.transaction_type = 'Sale'
          AND datetime(it.created_at) >= datetime(date('now', '-${days} days'))
        GROUP BY it.category
        ORDER BY total_revenue DESC
        `,
        [storeId],
      );

      // Get inventory alerts
      const [inventoryAlerts] = await query(
        `
        SELECT 
          id as product_id,
          name as product_name,
          quantity as current_stock,
          minimum_stock,
          CASE 
            WHEN quantity = 0 THEN 'Out of Stock'
            WHEN quantity <= minimum_stock * 0.5 THEN 'Critical Low'
            WHEN quantity <= minimum_stock THEN 'Low Stock'
            ELSE 'Normal'
          END as alert_type
        FROM products 
        WHERE store_id = ? AND quantity <= minimum_stock
        ORDER BY quantity ASC
        `,
        [storeId],
      );

      return {
        topProducts: topProducts.map((p) => ({
          productId: p.product_id,
          productName: p.product_name,
          totalSold: p.total_sold,
          totalRevenue: parseFloat(p.total_revenue),
          transactionCount: p.transaction_count,
        })),
        categoryPerformance: categoryPerformance.map((c) => ({
          category: c.category,
          totalSold: c.total_sold,
          totalRevenue: parseFloat(c.total_revenue),
          uniqueProducts: c.unique_products,
        })),
        inventoryAlerts: inventoryAlerts.map((a) => ({
          productId: a.product_id,
          productName: a.product_name,
          currentStock: a.current_stock,
          minimumStock: a.minimum_stock,
          alertType: a.alert_type,
        })),
        summary: {
          totalProducts: topProducts.length,
          totalCategories: categoryPerformance.length,
          criticalAlerts: inventoryAlerts.filter(
            (a) =>
              a.alert_type === "Critical Low" ||
              a.alert_type === "Out of Stock",
          ).length,
        },
      };
    } catch (error) {
      console.error("Error getting analytics dashboard:", error);
      throw error;
    }
  }
}
