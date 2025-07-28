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
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";
import {
  Brain,
  TrendingUp,
  Target,
  AlertTriangle,
  RefreshCw,
  Settings,
  Download,
  Zap,
  BarChart3,
  Activity,
  Gauge,
  Eye,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function AdvancedAnalytics() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEnsemble, setSelectedEnsemble] = useState("ensemble");
  const [selectedPeriod, setSelectedPeriod] = useState("30");
  const [analytics, setAnalytics] = useState({
    metrics: {
      currentVelocity: "2.3 u/h",
      forecastAccuracy: "94.2%",
      activeModels: 4,
      anomaliesDetected: 3,
    },
    demandForecast: [],
    modelPerformance: [],
    seasonalPatterns: [],
    anomalies: [],
    insights: [],
    featureImportance: [],
    correlations: [],
  });

  useEffect(() => {
    loadData();
  }, [selectedEnsemble, selectedPeriod]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, these would call your Lambda/SageMaker endpoints
      const [
        forecastResponse,
        performanceResponse,
        anomaliesResponse,
        insightsResponse,
      ] = await Promise.all([
        // apiRequest(`/api/ml/demand-forecast?period=${selectedPeriod}&model=${selectedEnsemble}`),
        // apiRequest(`/api/ml/model-performance`),
        // apiRequest(`/api/ml/anomaly-detection?period=${selectedPeriod}`),
        // apiRequest(`/api/ml/prescriptive-insights`),
        Promise.resolve({ data: generateMockForecastData() }),
        Promise.resolve({ data: generateMockPerformanceData() }),
        Promise.resolve({ data: generateMockAnomaliesData() }),
        Promise.resolve({ data: generateMockInsightsData() }),
      ]);

      setAnalytics({
        metrics: {
          currentVelocity: "2.3 u/h",
          forecastAccuracy: "94.2%",
          activeModels: 4,
          anomaliesDetected: 3,
        },
        demandForecast:
          forecastResponse.data.forecast || generateMockForecastData(),
        modelPerformance:
          performanceResponse.data.performance || generateMockPerformanceData(),
        seasonalPatterns: generateMockSeasonalData(),
        anomalies:
          anomaliesResponse.data.anomalies || generateMockAnomaliesData(),
        insights: insightsResponse.data.insights || generateMockInsightsData(),
        featureImportance: generateMockFeatureImportance(),
        correlations: generateMockCorrelations(),
      });
    } catch (error) {
      console.error("Error loading ML analytics data:", error);
      // Set fallback mock data
      setAnalytics({
        metrics: {
          currentVelocity: "2.3 u/h",
          forecastAccuracy: "94.2%",
          activeModels: 4,
          anomaliesDetected: 3,
        },
        demandForecast: generateMockForecastData(),
        modelPerformance: generateMockPerformanceData(),
        seasonalPatterns: generateMockSeasonalData(),
        anomalies: generateMockAnomaliesData(),
        insights: generateMockInsightsData(),
        featureImportance: generateMockFeatureImportance(),
        correlations: generateMockCorrelations(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockForecastData = () => [
    {
      date: "2025-07-29",
      ensemble: 58,
      lstm: 55,
      arima: 62,
      confidence_lower: 45,
      confidence_upper: 70,
    },
    {
      date: "2025-07-30",
      ensemble: 62,
      lstm: 59,
      arima: 65,
      confidence_lower: 50,
      confidence_upper: 75,
    },
    {
      date: "2025-07-31",
      ensemble: 65,
      lstm: 63,
      arima: 67,
      confidence_lower: 52,
      confidence_upper: 78,
    },
    {
      date: "2025-08-01",
      ensemble: 63,
      lstm: 61,
      arima: 65,
      confidence_lower: 50,
      confidence_upper: 76,
    },
    {
      date: "2025-08-02",
      ensemble: 67,
      lstm: 64,
      arima: 70,
      confidence_lower: 54,
      confidence_upper: 80,
    },
    {
      date: "2025-08-03",
      ensemble: 64,
      lstm: 62,
      arima: 66,
      confidence_lower: 51,
      confidence_upper: 77,
    },
    {
      date: "2025-08-04",
      ensemble: 61,
      lstm: 59,
      arima: 63,
      confidence_lower: 48,
      confidence_upper: 74,
    },
    {
      date: "2025-08-05",
      ensemble: 59,
      lstm: 57,
      arima: 61,
      confidence_lower: 46,
      confidence_upper: 72,
    },
    {
      date: "2025-08-06",
      ensemble: 55,
      lstm: 53,
      arima: 57,
      confidence_lower: 42,
      confidence_upper: 68,
    },
    {
      date: "2025-08-07",
      ensemble: 52,
      lstm: 50,
      arima: 54,
      confidence_lower: 39,
      confidence_upper: 65,
    },
    {
      date: "2025-08-08",
      ensemble: 48,
      lstm: 46,
      arima: 50,
      confidence_lower: 35,
      confidence_upper: 61,
    },
    {
      date: "2025-08-09",
      ensemble: 45,
      lstm: 43,
      arima: 47,
      confidence_lower: 32,
      confidence_upper: 58,
    },
    {
      date: "2025-08-10",
      ensemble: 42,
      lstm: 40,
      arima: 44,
      confidence_lower: 29,
      confidence_upper: 55,
    },
  ];

  const generateMockPerformanceData = () => [
    { model: "LSTM", accuracy: 91.5, mae: 4.2, rmse: 6.8, mape: 8.5 },
    { model: "ARIMA", accuracy: 89.8, mae: 5.1, rmse: 7.9, mape: 10.2 },
    { model: "Ensemble", accuracy: 92.2, mae: 3.8, rmse: 6.2, mape: 7.8 },
  ];

  const generateMockSeasonalData = () => [
    { day: "Monday", index: 0.95 },
    { day: "Tuesday", index: 0.82 },
    { day: "Wednesday", index: 0.88 },
    { day: "Thursday", index: 1.05 },
    { day: "Friday", index: 1.35 },
    { day: "Saturday", index: 1.28 },
    { day: "Sunday", index: 1.15 },
  ];

  const generateMockAnomaliesData = () => [
    {
      product: "Organic Bananas",
      type: "demand_spike",
      severity: "high",
      description: "Unusual demand spike detected - 111% above expected",
      confidence: 89.0,
      value: 95,
      expected: 45,
    },
    {
      product: "Ground Coffee",
      type: "stock_level",
      severity: "medium",
      description: "Stock levels significantly below forecast",
      confidence: 75.0,
      value: 8,
      expected: 25,
    },
    {
      product: "Whole Milk",
      type: "price_correlation",
      severity: "low",
      description: "Sales drop correlates with price increase",
      confidence: 68.0,
      value: 12,
      expected: 28,
    },
  ];

  const generateMockInsightsData = () => [
    {
      title: "Inventory Rebalancing Opportunity",
      type: "optimization",
      severity: "high",
      description:
        "Transfer 25 units of Ground Coffee from Store 002 to Store 001 to optimize inventory distribution",
      impact: "$450 revenue increase",
      confidence: 84.0,
    },
    {
      title: "Dynamic Pricing Opportunity",
      type: "pricing",
      severity: "medium",
      description:
        "Increase Organic Bananas price by 8% during peak demand hours (Friday-Sunday)",
      impact: "$230 weekly profit increase",
      confidence: 76.0,
    },
    {
      title: "Seasonal Demand Preparation",
      type: "demand",
      severity: "high",
      description:
        "Increase Whole Milk orders by 40% for next week based on weather and event patterns",
      impact: "Prevent stockouts worth $680",
      confidence: 91.0,
    },
  ];

  const generateMockFeatureImportance = () => [
    { feature: "Historical Sales", importance: 45 },
    { feature: "Day of Week", importance: 23 },
    { feature: "Season", importance: 18 },
    { feature: "Price Changes", importance: 14 },
  ];

  const generateMockCorrelations = () => [
    {
      products: "Organic Bananas ↔ Whole Milk",
      correlation: 0.73,
      strength: "strong",
    },
    {
      products: "Ground Coffee ↔ Chicken Breast",
      correlation: 0.45,
      strength: "moderate",
    },
    {
      products: "Whole Milk ↔ Chicken Breast",
      correlation: 0.62,
      strength: "moderate",
    },
    {
      products: "Organic Bananas ↔ Ground Coffee",
      correlation: 0.28,
      strength: "weak",
    },
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

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getCorrelationColor = (strength) => {
    switch (strength) {
      case "strong":
        return "#10b981";
      case "moderate":
        return "#f59e0b";
      case "weak":
        return "#ef4444";
      default:
        return "#6b7280";
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
                <p className="text-muted-foreground">Loading ML analytics...</p>
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
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-purple-500 to-blue-600 flex items-center justify-center">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 via-blue-600 to-purple-700 bg-clip-text text-transparent">
                    Advanced ML Analytics
                  </h1>
                </div>
                <p className="text-gray-600">
                  AI-powered forecasting, anomaly detection, and prescriptive
                  insights
                </p>
              </div>

              <div className="flex items-center gap-4">
                <select
                  value={selectedEnsemble}
                  onChange={(e) => setSelectedEnsemble(e.target.value)}
                  className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium min-w-[140px] focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="ensemble">Ensemble</option>
                  <option value="lstm">LSTM</option>
                  <option value="arima">ARIMA</option>
                </select>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium min-w-[120px] focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days</option>
                </select>
                <Button onClick={loadData} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">
                      Current Velocity
                    </p>
                    <p className="text-2xl font-bold">
                      {analytics.metrics.currentVelocity}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">
                      Forecast Accuracy
                    </p>
                    <p className="text-2xl font-bold">
                      {analytics.metrics.forecastAccuracy}
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-green-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">
                      Active Models
                    </p>
                    <p className="text-2xl font-bold">
                      {analytics.metrics.activeModels}
                    </p>
                  </div>
                  <Zap className="h-8 w-8 text-purple-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">
                      Anomalies Detected
                    </p>
                    <p className="text-2xl font-bold">
                      {analytics.metrics.anomaliesDetected}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Forecast Chart */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Multi-Model Demand Forecast with Confidence Intervals
              </CardTitle>
              <CardDescription>
                Comparison of LSTM, ARIMA, and ensemble forecasting models with
                uncertainty bands
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={analytics.demandForecast}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="confidence_upper"
                    stroke="none"
                    fill="#e0e7ff"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="confidence_lower"
                    stroke="none"
                    fill="#ffffff"
                    fillOpacity={1}
                  />
                  <Line
                    type="monotone"
                    dataKey="lstm"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="LSTM"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="arima"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    name="ARIMA"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ensemble"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    name="Ensemble Forecast"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Model Performance and Seasonal Patterns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Model Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Model Performance Metrics
                </CardTitle>
                <CardDescription>
                  Accuracy comparison across different ML models
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {analytics.modelPerformance.map((model, index) => (
                    <div key={index} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{model.model}</h4>
                        <Badge
                          variant={
                            model.model === "Ensemble" ? "default" : "secondary"
                          }
                        >
                          {model.accuracy}% Accuracy
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">MAE:</span>
                          <span className="font-medium ml-1">{model.mae}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">RMSE:</span>
                          <span className="font-medium ml-1">{model.rmse}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">MAPE:</span>
                          <span className="font-medium ml-1">
                            {model.mape}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Seasonal Demand Patterns */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Seasonal Demand Patterns
                </CardTitle>
                <CardDescription>
                  Weekly demand index with confidence scores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.seasonalPatterns}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <ReferenceLine
                      y={1}
                      stroke="#94a3b8"
                      strokeDasharray="2 2"
                    />
                    <Bar dataKey="index" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Anomaly Detection and Prescriptive Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Anomaly Detection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Anomaly Detection
                </CardTitle>
                <CardDescription>
                  AI-detected unusual patterns and outliers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.anomalies.map((anomaly, index) => (
                    <div
                      key={index}
                      className="border-l-4 border-orange-500 pl-4 py-2"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{anomaly.product}</h4>
                        <Badge variant={getSeverityColor(anomaly.severity)}>
                          {anomaly.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {anomaly.description}
                      </p>
                      <div className="flex justify-between text-xs">
                        <span>
                          Value: <strong>{anomaly.value}</strong> (Expected:{" "}
                          {anomaly.expected})
                        </span>
                        <span>
                          Confidence: <strong>{anomaly.confidence}%</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Prescriptive Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Prescriptive Insights
                </CardTitle>
                <CardDescription>
                  AI-generated actionable recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.insights.map((insight, index) => (
                    <div
                      key={index}
                      className="border-l-4 border-blue-500 pl-4 py-2"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{insight.title}</h4>
                        <Badge variant={getSeverityColor(insight.severity)}>
                          {insight.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {insight.description}
                      </p>
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600 font-medium">
                          {insight.impact}
                        </span>
                        <span>
                          Confidence: <strong>{insight.confidence}%</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Feature Importance and Correlations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Feature Importance Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Feature Importance Analysis
                </CardTitle>
                <CardDescription>
                  Key factors driving demand predictions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.featureImportance.map((feature, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <span className="text-sm font-medium w-32">
                        {feature.feature}
                      </span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${feature.importance}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium w-12">
                        {feature.importance}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Product Demand Correlations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Product Demand Correlations
                </CardTitle>
                <CardDescription>
                  Statistical relationships between product demands
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.correlations.map((correlation, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{correlation.products}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {correlation.strength} correlation
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{
                            backgroundColor: getCorrelationColor(
                              correlation.strength,
                            ),
                          }}
                        ></div>
                        <span className="font-medium">
                          {correlation.correlation}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
