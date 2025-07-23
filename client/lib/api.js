// API utilities for making requests to the backend

/**
 * Get the base URL for API requests
 * In development, this should be the local dev server
 * In production, this should be the same origin as the client
 */
function getBaseURL() {
  // If we're in development mode and the origin contains localhost or 127.0.0.1, use it directly
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
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
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession();

    if (session?.tokens?.idToken) {
      return {
        'Authorization': `Bearer ${session.tokens.idToken.toString()}`
      };
    }
  } catch (error) {
    console.warn('Could not get auth token:', error);
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
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
      ...options,
    });

    if (response.status === 401) {
      // Unauthorized - redirect to login
      console.warn('API request unauthorized, user may need to re-authenticate');
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
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
export async function fetchDashboardAnalytics(storeId = 'all') {
  const storeParam = storeId !== 'all' ? `?storeId=${storeId}` : '';
  const endpoint = `/api/dashboard/analytics${storeParam}`;
  
  try {
    const result = await apiRequest(endpoint);
    return result.data;
  } catch (error) {
    console.warn('Dashboard analytics failed, trying fallback endpoint');
    
    // Fallback to inventory analytics
    try {
      const fallbackResult = await apiRequest('/api/analytics/inventory-db');
      return {
        totalProducts: fallbackResult.totalProducts,
        lowStockItems: fallbackResult.lowStockItems?.length || 0,
        revenueThisMonth: fallbackResult.totalValue || 0,
        inventoryTurnover: 0,
        topSellingCategories: [],
      };
    } catch (fallbackError) {
      console.error('Fallback API also failed:', fallbackError);
      throw new Error('All API endpoints failed');
    }
  }
}
