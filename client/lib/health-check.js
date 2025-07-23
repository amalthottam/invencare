// Health check utilities for debugging API connectivity

/**
 * Perform a comprehensive health check of the API endpoints
 * @returns {Promise<Object>} Health check results
 */
export async function performHealthCheck() {
  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      origin: window.location.origin,
      hostname: window.location.hostname,
      port: window.location.port,
      protocol: window.location.protocol,
      userAgent: navigator.userAgent,
    },
    endpoints: {},
    errors: [],
  };

  const endpoints = [
    '/api/ping',
    '/api/health',
    '/api/dashboard/analytics',
    '/api/analytics/inventory-db',
  ];

  for (const endpoint of endpoints) {
    try {
      const startTime = performance.now();
      const response = await fetch(endpoint);
      const endTime = performance.now();
      
      results.endpoints[endpoint] = {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        responseTime: Math.round(endTime - startTime),
        headers: Object.fromEntries(response.headers.entries()),
      };

      // For successful responses, try to parse JSON
      if (response.ok) {
        try {
          const data = await response.json();
          results.endpoints[endpoint].data = data;
        } catch (jsonError) {
          results.endpoints[endpoint].parseError = jsonError.message;
        }
      }
    } catch (error) {
      results.endpoints[endpoint] = {
        error: error.message,
        type: error.constructor.name,
      };
      results.errors.push({
        endpoint,
        error: error.message,
        type: error.constructor.name,
      });
    }
  }

  return results;
}

/**
 * Log a formatted health check report to the console
 */
export async function logHealthCheck() {
  console.group('🏥 API Health Check');
  
  try {
    const results = await performHealthCheck();
    
    console.log('Environment:', results.environment);
    console.log('Timestamp:', results.timestamp);
    
    console.group('📡 Endpoint Status');
    for (const [endpoint, result] of Object.entries(results.endpoints)) {
      const status = result.error ? '❌' : result.ok ? '✅' : '⚠️';
      console.log(`${status} ${endpoint}:`, result);
    }
    console.groupEnd();
    
    if (results.errors.length > 0) {
      console.group('🚨 Errors');
      results.errors.forEach(error => {
        console.error(`${error.endpoint}: ${error.error}`);
      });
      console.groupEnd();
    }
    
    return results;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  } finally {
    console.groupEnd();
  }
}

/**
 * Quick connectivity test for dashboard data
 * @param {string} storeId - Store ID to test with
 */
export async function testDashboardConnectivity(storeId = 'all') {
  console.log(`🧪 Testing dashboard connectivity for store: ${storeId}`);
  
  try {
    const storeParam = storeId !== 'all' ? `?storeId=${storeId}` : '';
    const endpoint = `/api/dashboard/analytics${storeParam}`;
    
    console.log(`Fetching: ${window.location.origin}${endpoint}`);
    
    const response = await fetch(endpoint);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Dashboard API is working:', data);
      return { success: true, data };
    } else {
      console.warn(`⚠️ Dashboard API returned ${response.status}: ${response.statusText}`);
      return { success: false, status: response.status, statusText: response.statusText };
    }
  } catch (error) {
    console.error('❌ Dashboard connectivity test failed:', error);
    return { success: false, error: error.message };
  }
}
