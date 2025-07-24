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
    }
  }
}

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

/**
 * Fetch demand forecasts for products
 * @param {string} storeId - The store ID to filter by (or 'all')
 * @returns {Promise<any>} - Demand forecasts data
 */
export async function fetchDemandForecasts(storeId = "all") {
  const storeParam = storeId !== "all" ? `?storeId=${storeId}` : "";
  const endpoint = `/api/analytics/demand-forecast${storeParam}`;

  try {
    const result = await apiRequest(endpoint);
    return result.data;
  } catch (error) {
    console.error("Failed to fetch demand forecasts:", error);
    throw error;
  }
}

/**
 * Fetch product analytics dashboard data
 * @param {string} storeId - The store ID to filter by (or 'all')
 * @returns {Promise<any>} - Product analytics dashboard data
 */
export async function fetchProductAnalyticsDashboard(storeId = "all") {
  const endpoint = `/api/analytics/products/${storeId}/dashboard`;

  try {
    const result = await apiRequest(endpoint);
    return result.data;
  } catch (error) {
    console.error("Failed to fetch product analytics dashboard:", error);
    throw error;
  }
}

/**
 * Fetch reorder recommendations
 * @param {string} storeId - The store ID to filter by (or 'all')
 * @returns {Promise<any>} - Reorder recommendations data
 */
export async function fetchReorderRecommendations(storeId = "all") {
  const storeParam = storeId !== "all" ? `?storeId=${storeId}` : "";
  const endpoint = `/api/analytics/reorder-recommendations${storeParam}`;

  try {
    const result = await apiRequest(endpoint);
    return result.data;
  } catch (error) {
    console.error("Failed to fetch reorder recommendations:", error);
    throw error;
  }
}

/**
 * Fetch sales trends data
 * @param {string} storeId - The store ID to filter by (or 'all')
 * @returns {Promise<any>} - Sales trends data
 */
export async function fetchSalesTrends(storeId = "all") {
  const storeParam = storeId !== "all" ? `?storeId=${storeId}` : "";
  const endpoint = `/api/analytics/sales-trends${storeParam}`;

  try {
    const result = await apiRequest(endpoint);
    return result.data;
  } catch (error) {
    console.error("Failed to fetch sales trends:", error);
    throw error;
  }
}
