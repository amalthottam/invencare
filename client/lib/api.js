import { authService } from "./auth";
import { awsApiClient } from "./aws-api-client";

/**
 * API service layer for InvenCare application
 * Handles both traditional REST API calls and AWS Lambda/SageMaker integration
 */
class APIService {
  constructor() {
    this.baseURL = import.meta.env.VITE_API_ENDPOINT || "/api";
  }

  // Helper method to get authentication headers
  async getAuthHeaders() {
    const token = await authService.getIdToken();
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  // Generic fetch wrapper with authentication
  async fetchWithAuth(endpoint, options = {}) {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, redirect to login
        window.location.href = "/login";
        return;
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Traditional API methods (for existing backend endpoints)
  async getProducts(filters = {}) {
    const params = new URLSearchParams(filters);
    return await this.fetchWithAuth(`/products?${params}`);
  }

  async createProduct(productData) {
    return await this.fetchWithAuth("/products", {
      method: "POST",
      body: JSON.stringify(productData),
    });
  }

  async updateProduct(productId, productData) {
    return await this.fetchWithAuth(`/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify(productData),
    });
  }

  async deleteProduct(productId) {
    return await this.fetchWithAuth(`/products/${productId}`, {
      method: "DELETE",
    });
  }

  async getTransactions(filters = {}) {
    const params = new URLSearchParams(filters);
    return await this.fetchWithAuth(`/transactions?${params}`);
  }

  async createTransaction(transactionData) {
    return await this.fetchWithAuth("/transactions", {
      method: "POST",
      body: JSON.stringify(transactionData),
    });
  }

  async getDashboardStats() {
    return await this.fetchWithAuth("/dashboard/stats");
  }

  // AWS Lambda-based methods (enhanced functionality)
  async getUserProfile() {
    try {
      const result = await awsApiClient.getUserProfile();
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error);
    } catch (error) {
      console.error("Get user profile failed:", error);
      throw error;
    }
  }

  async updateUserProfile(profileData) {
    try {
      const result = await awsApiClient.updateUserProfile(profileData);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error);
    } catch (error) {
      console.error("Update user profile failed:", error);
      throw error;
    }
  }

  async updateUserPreferences(preferences) {
    try {
      const result = await awsApiClient.updateUserPreferences(preferences);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error);
    } catch (error) {
      console.error("Update user preferences failed:", error);
      throw error;
    }
  }

  // Machine Learning and Forecasting
  async generateInventoryForecast(inventoryData) {
    try {
      // Prepare forecast data
      const forecastData = {
        features: inventoryData.historicalData || [],
        timeframe: inventoryData.timeframe || 30,
        model_type: inventoryData.modelType || "linear",
        metadata: {
          product_id: inventoryData.productId,
          category: inventoryData.category,
          seasonality: inventoryData.seasonality,
        },
      };

      const result = await awsApiClient.generateForecast(forecastData);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error);
    } catch (error) {
      console.error("Generate inventory forecast failed:", error);
      throw error;
    }
  }

  async generateProductRecommendations(userContext) {
    try {
      const recommendationData = {
        userId: userContext.userId,
        itemFeatures: userContext.preferences || [],
        numRecommendations: userContext.limit || 10,
        context: {
          current_inventory: userContext.currentInventory,
          user_behavior: userContext.userBehavior,
          seasonal_factors: userContext.seasonalFactors,
        },
      };

      const result =
        await awsApiClient.generateRecommendations(recommendationData);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error);
    } catch (error) {
      console.error("Generate product recommendations failed:", error);
      throw error;
    }
  }

  async analyzeInventoryTrends(analysisData) {
    try {
      const result = await awsApiClient.analyzeTransactions(analysisData);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error);
    } catch (error) {
      console.error("Analyze inventory trends failed:", error);
      throw error;
    }
  }

  // Batch operations for large datasets
  async batchProcessInventoryData(inventoryDataArray) {
    try {
      const batchData = {
        requests: inventoryDataArray.map((data) => ({
          features: data.historicalData || [],
          timeframe: data.timeframe || 30,
          metadata: {
            product_id: data.productId,
            category: data.category,
          },
        })),
        prediction_type: "forecast",
      };

      const result = await awsApiClient.batchPredict(batchData);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error);
    } catch (error) {
      console.error("Batch process inventory data failed:", error);
      throw error;
    }
  }

  // Health checks and monitoring
  async checkServiceHealth() {
    try {
      const [backendHealth, awsHealth] = await Promise.allSettled([
        this.fetchWithAuth("/health"),
        awsApiClient.healthCheck(),
      ]);

      return {
        backend: {
          status:
            backendHealth.status === "fulfilled" ? "healthy" : "unhealthy",
          data:
            backendHealth.status === "fulfilled"
              ? backendHealth.value
              : { error: backendHealth.reason },
        },
        aws: {
          status: awsHealth.status === "fulfilled" ? "healthy" : "unhealthy",
          data:
            awsHealth.status === "fulfilled"
              ? awsHealth.value
              : { error: awsHealth.reason },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Service health check failed:", error);
      return {
        backend: { status: "error", error: error.message },
        aws: { status: "error", error: error.message },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Real-time inventory forecasting for dashboard
  async getDashboardForecasts() {
    try {
      // Get current inventory data
      const products = await this.getProducts();

      if (!products.success || !products.data) {
        throw new Error("Failed to fetch products data");
      }

      // Generate forecasts for top products
      const topProducts = products.data.slice(0, 5);
      const forecastPromises = topProducts.map(async (product) => {
        try {
          const forecast = await this.generateInventoryForecast({
            productId: product.id,
            historicalData: product.salesHistory || [],
            timeframe: 30,
            category: product.category,
          });
          return {
            productId: product.id,
            productName: product.name,
            forecast,
          };
        } catch (error) {
          console.warn(`Forecast failed for product ${product.id}:`, error);
          return {
            productId: product.id,
            productName: product.name,
            forecast: null,
            error: error.message,
          };
        }
      });

      const forecasts = await Promise.all(forecastPromises);
      return {
        success: true,
        forecasts,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Get dashboard forecasts failed:", error);
      return {
        success: false,
        error: error.message,
        forecasts: [],
      };
    }
  }

  // Analytics and reporting
  async getInventoryAnalytics(timeRange = "30d") {
    try {
      const [transactions, products] = await Promise.all([
        this.getTransactions({ timeRange }),
        this.getProducts(),
      ]);

      if (!transactions.success || !products.success) {
        throw new Error("Failed to fetch data for analytics");
      }

      // Process data with AWS Lambda
      const analyticsResult = await awsApiClient.processInventoryData({
        transactions: transactions.data,
        products: products.data,
        timeRange,
      });

      if (analyticsResult.success) {
        return analyticsResult.data;
      }
      throw new Error(analyticsResult.error);
    } catch (error) {
      console.error("Get inventory analytics failed:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiService = new APIService();
export default apiService;
