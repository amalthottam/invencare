<<<<<<< HEAD
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
=======
// API utilities for making requests to the backend

/**
 * Get the base URL for API requests
 * In development, this should be the local dev server
 * In production, this should be the same origin as the client
 */
function getBaseURL() {
  // If we're in development mode and the origin contains localhost or 127.0.0.1, use it directly
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return window.location.origin;
  }

  // For deployed environments, we should use the same origin
  // This prevents CORS issues and ensures we're hitting the right server
  return window.location.origin;
}

/**
 * Get authentication headers for API requests
 */
async function getAuthHeaders() {
  try {
    const { fetchAuthSession } = await import("aws-amplify/auth");
    const session = await fetchAuthSession();

    if (session?.tokens?.idToken) {
      return {
        Authorization: `Bearer ${session.tokens.idToken.toString()}`,
      };
    }
  } catch (error) {
    console.warn("Could not get auth token:", error);
  }

  return {};
}

/**
 * Make an API request with proper error handling and authentication
 * @param {string} endpoint - The API endpoint (e.g., '/api/dashboard/analytics')
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>} - The response data
 */
export async function apiRequest(endpoint, options = {}) {
  const baseURL = getBaseURL();
  const url = `${baseURL}${endpoint}`;

  console.log(`Making API request to: ${url}`);

  try {
    // Get authentication headers
    const authHeaders = await getAuthHeaders();

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...options.headers,
      },
      ...options,
    });

    if (response.status === 401) {
      // Unauthorized - redirect to login
      console.warn(
        "API request unauthorized, user may need to re-authenticate",
      );
      window.location.href = "/login";
      throw new Error("Authentication required");
    }

    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status} - ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API request failed for ${url}:`, error);
    throw error;
  }
}

/**
 * Fetch dashboard analytics data
 * @param {string} storeId - The store ID to filter by (or 'all')
 * @returns {Promise<any>} - Dashboard analytics data
 */
export async function fetchDashboardAnalytics(storeId = "all") {
  const storeParam = storeId !== "all" ? `?storeId=${storeId}` : "";
  const endpoint = `/api/dashboard/analytics${storeParam}`;

  try {
    const result = await apiRequest(endpoint);
    return result.data;
  } catch (error) {
    console.warn("Dashboard analytics failed, trying fallback endpoint");

    // Fallback to inventory analytics
    try {
      const fallbackResult = await apiRequest("/api/analytics/inventory-db");
      return {
        totalProducts: fallbackResult.totalProducts,
        lowStockItems: fallbackResult.lowStockItems?.length || 0,
        revenueThisMonth: fallbackResult.totalValue || 0,
        inventoryTurnover: 0,
        topSellingCategories: [],
      };
    } catch (fallbackError) {
      console.error("Fallback API also failed:", fallbackError);
      throw new Error("All API endpoints failed");
>>>>>>> origin/main
    }
  }
}

<<<<<<< HEAD
// Export singleton instance
export const apiService = new APIService();
export default apiService;
=======
/**
 * Fetch stores list
 * @returns {Promise<any>} - Stores data
 */
export async function fetchStores() {
  try {
    const result = await apiRequest("/api/dashboard/stores");
    return result.data.stores;
  } catch (error) {
    console.error("Failed to fetch stores:", error);
    // Return mock data as fallback
    return [
      { id: "all", name: "All Stores", location: "Combined View" },
      { id: "store_001", name: "Downtown Store", location: "123 Main St" },
      {
        id: "store_002",
        name: "Mall Location",
        location: "456 Shopping Center",
      },
      { id: "store_003", name: "Uptown Branch", location: "789 North Ave" },
      { id: "store_004", name: "Westside Market", location: "321 West Blvd" },
    ];
  }
}

/**
 * Fetch low stock items
 * @param {string} storeId - The store ID to filter by (or 'all')
 * @returns {Promise<any>} - Low stock items data
 */
export async function fetchLowStockItems(storeId = "all") {
  const storeParam = storeId !== "all" ? `?storeId=${storeId}` : "";
  const endpoint = `/api/dashboard/low-stock${storeParam}`;

  try {
    const result = await apiRequest(endpoint);
    return result.data.items;
  } catch (error) {
    console.error("Failed to fetch low stock items:", error);
    return [];
  }
}

/**
 * Fetch recent transactions
 * @param {string} storeId - The store ID to filter by (or 'all')
 * @returns {Promise<any>} - Recent transactions data
 */
export async function fetchRecentTransactions(storeId = "all") {
  const storeParam = storeId !== "all" ? `?storeId=${storeId}` : "";
  const endpoint = `/api/dashboard/transactions${storeParam}`;

  try {
    const result = await apiRequest(endpoint);
    return result.data.transactions;
  } catch (error) {
    console.error("Failed to fetch recent transactions:", error);
    return [];
  }
}
>>>>>>> origin/main
