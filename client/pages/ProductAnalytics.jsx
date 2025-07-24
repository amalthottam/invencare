import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  AlertTriangle,
  Package,
  DollarSign,
  Calendar,
  Store,
  RefreshCw,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function ProductAnalytics() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState("all");
  const [stores, setStores] = useState([]);
  const [analytics, setAnalytics] = useState({
    demandForecasts: [],
    performanceMetrics: [],
    reorderRecommendations: [],
    salesTrends: [],
    categoryInsights: [],
  });

  useEffect(() => {
    loadData();
  }, [selectedStore]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load stores first
      if (stores.length === 0) {
        const storesResponse = await apiRequest("/api/dashboard/stores");
        setStores(storesResponse.data.stores);
      }

      // Load analytics data
      const [
        forecastsResponse,
        performanceResponse,
        reorderResponse,
        trendsResponse,
      ] = await Promise.all([
        apiRequest(`/api/analytics/demand-forecast?storeId=${selectedStore}`),
        apiRequest(`/api/analytics/products/${selectedStore}/dashboard`),
        apiRequest(`/api/analytics/reorder-recommendations?storeId=${selectedStore}`),
        apiRequest(`/api/analytics/sales-trends?storeId=${selectedStore}`),
      ]);

      setAnalytics({
        demandForecasts: forecastsResponse.data?.forecasts || [],
        performanceMetrics: performanceResponse.data?.metrics || {},
        reorderRecommendations: reorderResponse.data?.recommendations || [],
        salesTrends: trendsResponse.data?.trends || [],
        categoryInsights: performanceResponse.data?.categoryInsights || [],
      });
    } catch (error) {
      console.error("Error loading analytics data:", error);
      // Set fallback data
      setAnalytics({
        demandForecasts: generateMockForecastData(),
        performanceMetrics: generateMockPerformanceData(),
        reorderRecommendations: generateMockReorderData(),
        salesTrends: generateMockTrendsData(),
        categoryInsights: generateMockCategoryData(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mock data generators for fallback
  const generateMockForecastData = () => [
    { date: "2024-01-15", product: "Organic Bananas", predicted: 45, actual: 42, confidence: 85 },
    { date: "2024-01-16", product: "Organic Bananas", predicted: 38, actual: 40, confidence: 82 },
    { date: "2024-01-17", product: "Organic Bananas", predicted: 52, actual: null, confidence: 78 },
    { date: "2024-01-18", product: "Organic Bananas", predicted: 48, actual: null, confidence: 80 },
    { date: "2024-01-19", product: "Whole Milk", predicted: 25, actual: 28, confidence: 90 },
    { date: "2024-01-20", product: "Whole Milk", predicted: 30, actual: null, confidence: 88 },
  ];

  const generateMockPerformanceData = () => ({
    totalProducts: 156,
    activeProducts: 142,
    forecastAccuracy: 84.5,
    averageTurnover: 6.2,
    topPerformers: [
      { name: "Organic Bananas", score: 94, revenue: 2340, units: 1245 },
      { name: "Whole Milk", score: 89, revenue: 1890, units: 498 },
      { name: "Chicken Breast", score: 86, revenue: 3200, units: 124 },
    ],
  });

  const generateMockReorderData = () => [
    {
      product: "Organic Bananas",
      currentStock: 15,
      recommendedOrder: 100,
      urgency: "high",
      projectedStockout: "2024-01-20",
      estimatedCost: 120,
    },
    {
      product: "Ground Coffee",
      currentStock: 8,
      recommendedOrder: 50,
      urgency: "critical",
      projectedStockout: "2024-01-18",
      estimatedCost: 450,
    },
    {
      product: "Cheddar Cheese",
      currentStock: 25,
      recommendedOrder: 30,
      urgency: "normal",
      projectedStockout: "2024-01-25",
      estimatedCost: 180,
    },
  ];

  const generateMockTrendsData = () => [
    { date: "Jan 10", sales: 245, forecast: 250, revenue: 2340 },
    { date: "Jan 11", sales: 280, forecast: 275, revenue: 2680 },
    { date: "Jan 12", sales: 195, forecast: 200, revenue: 1890 },
    { date: "Jan 13", sales: 320, forecast: 310, revenue: 3200 },
    { date: "Jan 14", sales: 260, forecast: 265, revenue: 2520 },
    { date: "Jan 15", sales: 290, forecast: 285, revenue: 2890 },
    { date: "Jan 16", sales: 235, forecast: 240, revenue: 2350 },
  ];

  const generateMockCategoryData = () => [
    { name: "Fruits & Vegetables", value: 35, color: "#8884d8" },
    { name: "Dairy", value: 25, color: "#82ca9d" },
    { name: "Meat & Poultry", value: 20, color: "#ffc658" },
    { name: "Beverages", value: 12, color: "#ff7300" },
    { name: "Snacks", value: 8, color: "#00ff88" },
  ];

  const handleLogout = async () => {
    try {
      const { signOut } = await import("aws-amplify/auth");
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      navigate("/login");
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case "critical": return "destructive";
      case "high": return "default";
      case "normal": return "secondary";
      default: return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation onLogout={handleLogout} />
        <div className="lg:pl-64">
          <main className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading analytics...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation onLogout={handleLogout} />
      
      <div className="lg:pl-64">
        <main className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                  Product Analytics
                </h1>
                <p className="text-gray-600 mt-2">
                  Advanced insights and predictions for inventory management
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-gray-500" />
                  <select
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium min-w-[200px] focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={loadData} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                    <p className="text-2xl font-bold">{analytics.performanceMetrics.totalProducts || 0}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Forecast Accuracy</p>
                    <p className="text-2xl font-bold">{analytics.performanceMetrics.forecastAccuracy || 0}%</p>
                  </div>
                  <Target className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Turnover</p>
                    <p className="text-2xl font-bold">{analytics.performanceMetrics.averageTurnover || 0}x</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Products</p>
                    <p className="text-2xl font-bold">{analytics.performanceMetrics.activeProducts || 0}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Sales Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Sales vs Forecast Trends</CardTitle>
                <CardDescription>Actual sales performance against predictions</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.salesTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sales" stroke="#8884d8" name="Actual Sales" />
                    <Line type="monotone" dataKey="forecast" stroke="#82ca9d" name="Forecasted" strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
                <CardDescription>Revenue distribution by product category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.categoryInsights}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.categoryInsights.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Demand Forecasts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Demand Forecasts
                </CardTitle>
                <CardDescription>AI-powered demand predictions for key products</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.demandForecasts.slice(0, 5).map((forecast, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{forecast.product}</p>
                        <p className="text-sm text-muted-foreground">{forecast.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{forecast.predicted} units</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{forecast.confidence}% confidence</Badge>
                          {forecast.actual && (
                            <span className={`text-xs ${forecast.actual > forecast.predicted ? 'text-green-600' : 'text-red-600'}`}>
                              Actual: {forecast.actual}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Reorder Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Reorder Recommendations
                </CardTitle>
                <CardDescription>Automated recommendations to prevent stockouts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.reorderRecommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{recommendation.product}</p>
                        <p className="text-sm text-muted-foreground">
                          Current: {recommendation.currentStock} units
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Stockout: {recommendation.projectedStockout}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Order {recommendation.recommendedOrder} units</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={getUrgencyColor(recommendation.urgency)}>
                            {recommendation.urgency}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            ${recommendation.estimatedCost}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Products</CardTitle>
              <CardDescription>Products with highest performance scores and revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analytics.performanceMetrics.topPerformers?.map((product, index) => (
                  <div key={index} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{product.name}</h3>
                      <Badge variant="default">{product.score}/100</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Revenue:</span>
                        <span className="font-medium">${product.revenue?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Units Sold:</span>
                        <span className="font-medium">{product.units?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
