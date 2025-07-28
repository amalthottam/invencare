import { RequestHandler } from "express";
import { createApiResponse, createApiError } from "../../shared/api.js";
import fetch from "node-fetch";

const LAMBDA_BASE_URL = process.env.ML_LAMBDA_BASE_URL || "https://your-api-gateway-url.amazonaws.com/prod";

// Get ML demand forecast
export const getMLDemandForecast = async (req, res) => {
  try {
    const { productId, storeId } = req.params;
    const { model = "ensemble", steps_ahead = 14 } = req.query;

    // Call Lambda function via API Gateway
    const response = await fetch(`${LAMBDA_BASE_URL}/ml/demand-forecast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        store_id: storeId,
        model: model,
        steps_ahead: parseInt(steps_ahead),
      }),
    });

    if (!response.ok) {
      throw new Error(`Lambda API error: ${response.status}`);
    }

    const data = await response.json();
    
    res.status(200).json(
      createApiResponse(
        data,
        "ML demand forecast generated successfully"
      )
    );
  } catch (error) {
    console.error("Get ML demand forecast error:", error);
    
    // Fallback to mock data if Lambda is not available
    const mockForecast = generateMockForecast(parseInt(req.query.steps_ahead || 14));
    
    res.status(200).json(
      createApiResponse(
        mockForecast,
        "ML demand forecast generated (fallback mode)"
      )
    );
  }
};

// Get ML model performance metrics
export const getMLModelPerformance = async (req, res) => {
  try {
    const response = await fetch(`${LAMBDA_BASE_URL}/ml/model-performance`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Lambda API error: ${response.status}`);
    }

    const data = await response.json();
    
    res.status(200).json(
      createApiResponse(
        data,
        "ML model performance metrics retrieved successfully"
      )
    );
  } catch (error) {
    console.error("Get ML model performance error:", error);
    
    // Fallback to mock data
    const mockPerformance = {
      performance: [
        {
          model: "LSTM",
          accuracy: 91.5,
          mae: 4.2,
          rmse: 6.8,
          mape: 8.5,
          last_updated: new Date().toISOString()
        },
        {
          model: "ARIMA",
          accuracy: 89.8,
          mae: 5.1,
          rmse: 7.9,
          mape: 10.2,
          last_updated: new Date().toISOString()
        },
        {
          model: "Ensemble",
          accuracy: 92.2,
          mae: 3.8,
          rmse: 6.2,
          mape: 7.8,
          last_updated: new Date().toISOString()
        }
      ]
    };
    
    res.status(200).json(
      createApiResponse(
        mockPerformance,
        "ML model performance metrics retrieved (fallback mode)"
      )
    );
  }
};

// Get anomaly detection results
export const getAnomalyDetection = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { period = 30 } = req.query;

    const response = await fetch(`${LAMBDA_BASE_URL}/ml/anomaly-detection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        store_id: storeId,
        period: parseInt(period),
      }),
    });

    if (!response.ok) {
      throw new Error(`Lambda API error: ${response.status}`);
    }

    const data = await response.json();
    
    res.status(200).json(
      createApiResponse(
        data,
        "Anomaly detection results retrieved successfully"
      )
    );
  } catch (error) {
    console.error("Get anomaly detection error:", error);
    
    // Fallback to mock data
    const mockAnomalies = {
      anomalies: [
        {
          product: "Organic Bananas",
          type: "demand_spike",
          severity: "high",
          description: "Unusual demand spike detected - 111% above expected",
          confidence: 89.0,
          value: 95,
          expected: 45,
          detected_at: new Date().toISOString()
        },
        {
          product: "Ground Coffee",
          type: "stock_level",
          severity: "medium",
          description: "Stock levels significantly below forecast",
          confidence: 75.0,
          value: 8,
          expected: 25,
          detected_at: new Date().toISOString()
        },
        {
          product: "Whole Milk",
          type: "price_correlation",
          severity: "low",
          description: "Sales drop correlates with price increase",
          confidence: 68.0,
          value: 12,
          expected: 28,
          detected_at: new Date().toISOString()
        }
      ]
    };
    
    res.status(200).json(
      createApiResponse(
        mockAnomalies,
        "Anomaly detection results retrieved (fallback mode)"
      )
    );
  }
};

// Get prescriptive insights
export const getPrescriptiveInsights = async (req, res) => {
  try {
    const { storeId } = req.params;

    const response = await fetch(`${LAMBDA_BASE_URL}/ml/prescriptive-insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        store_id: storeId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Lambda API error: ${response.status}`);
    }

    const data = await response.json();
    
    res.status(200).json(
      createApiResponse(
        data,
        "Prescriptive insights retrieved successfully"
      )
    );
  } catch (error) {
    console.error("Get prescriptive insights error:", error);
    
    // Fallback to mock data
    const mockInsights = {
      insights: [
        {
          title: "Inventory Rebalancing Opportunity",
          type: "optimization",
          severity: "high",
          description: "Transfer 25 units of Ground Coffee from Store 002 to Store 001 to optimize inventory distribution",
          impact: "$450 revenue increase",
          confidence: 84.0,
          generated_at: new Date().toISOString()
        },
        {
          title: "Dynamic Pricing Opportunity",
          type: "pricing",
          severity: "medium",
          description: "Increase Organic Bananas price by 8% during peak demand hours (Friday-Sunday)",
          impact: "$230 weekly profit increase",
          confidence: 76.0,
          generated_at: new Date().toISOString()
        },
        {
          title: "Seasonal Demand Preparation",
          type: "demand",
          severity: "high",
          description: "Increase Whole Milk orders by 40% for next week based on weather and event patterns",
          impact: "Prevent stockouts worth $680",
          confidence: 91.0,
          generated_at: new Date().toISOString()
        }
      ]
    };
    
    res.status(200).json(
      createApiResponse(
        mockInsights,
        "Prescriptive insights retrieved (fallback mode)"
      )
    );
  }
};

// Get sales trends for ML analysis
export const getMLSalesTrends = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { period = 30 } = req.query;

    // This would typically fetch from your sales trends table
    // For now, we'll generate mock data
    const trends = generateMockSalesTrends(parseInt(period));
    
    res.status(200).json(
      createApiResponse(
        { trends },
        "ML sales trends retrieved successfully"
      )
    );
  } catch (error) {
    console.error("Get ML sales trends error:", error);
    res.status(500).json(createApiError(error));
  }
};

// Helper function to generate mock forecast data
function generateMockForecast(steps_ahead) {
  const forecast = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  
  for (let i = 0; i < steps_ahead; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    const baseValue = 50;
    const trend = -0.5 * i; // Slight downward trend
    const seasonal = 10 * Math.sin((i * 2 * Math.PI) / 7); // Weekly seasonality
    const noise = (Math.random() - 0.5) * 10;
    
    const prediction = Math.max(0, baseValue + trend + seasonal + noise);
    const confidenceMargin = prediction * 0.2;
    
    forecast.push({
      date: date.toISOString().split('T')[0],
      ensemble: Math.round(prediction),
      lstm: Math.round(prediction * 0.95),
      arima: Math.round(prediction * 1.05),
      confidence_lower: Math.round(prediction - confidenceMargin),
      confidence_upper: Math.round(prediction + confidenceMargin)
    });
  }
  
  return {
    forecast: {
      model: "Ensemble",
      dates: forecast.map(f => f.date),
      predictions: forecast.map(f => f.ensemble),
      confidence_lower: forecast.map(f => f.confidence_lower),
      confidence_upper: forecast.map(f => f.confidence_upper),
      confidence_level: 0.95
    },
    all_models: {
      lstm: {
        model: "LSTM",
        dates: forecast.map(f => f.date),
        predictions: forecast.map(f => f.lstm),
        confidence_lower: forecast.map(f => Math.round(f.lstm * 0.8)),
        confidence_upper: forecast.map(f => Math.round(f.lstm * 1.2)),
        confidence_level: 0.95
      },
      arima: {
        model: "ARIMA",
        dates: forecast.map(f => f.date),
        predictions: forecast.map(f => f.arima),
        confidence_lower: forecast.map(f => Math.round(f.arima * 0.8)),
        confidence_upper: forecast.map(f => Math.round(f.arima * 1.2)),
        confidence_level: 0.95
      },
      ensemble: {
        model: "Ensemble",
        dates: forecast.map(f => f.date),
        predictions: forecast.map(f => f.ensemble),
        confidence_lower: forecast.map(f => f.confidence_lower),
        confidence_upper: forecast.map(f => f.confidence_upper),
        confidence_level: 0.95
      }
    },
    generated_at: new Date().toISOString()
  };
}

// Helper function to generate mock sales trends
function generateMockSalesTrends(days) {
  const trends = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    const baseValue = 250;
    const weekdayMultiplier = [0.8, 0.85, 0.9, 1.0, 1.3, 1.4, 1.2][date.getDay()];
    const noise = (Math.random() - 0.5) * 50;
    
    const sales = Math.max(0, Math.round(baseValue * weekdayMultiplier + noise));
    const forecast = Math.round(sales * (0.95 + Math.random() * 0.1));
    const revenue = sales * (15 + Math.random() * 10);
    
    trends.push({
      date: date.toISOString().split('T')[0],
      sales,
      forecast,
      revenue: Math.round(revenue)
    });
  }
  
  return trends;
}
