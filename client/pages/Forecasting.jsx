import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, CategoryBadge } from "@/components/ui/status-badges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  AlertTriangle,
  Calendar,
  BarChart3,
  X,
  Filter,
  Brain,
  Target,
  Activity,
  Cpu,
  Zap,
} from "lucide-react";

export default function Forecasting() {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("7");

  useEffect(() => {
    // Check authentication
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    fetchForecastingData();
  }, [navigate, selectedTimeframe]);

  const fetchForecastingData = async () => {
    try {
      setLoading(true);

      // Fetch dashboard summary
      const dashboardResponse = await fetch(
        "/api/analytics/forecasting-dashboard",
      );
      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json();
        setDashboardData(dashboardData);
      }

      // Fetch demand predictions
      const predictionsResponse = await fetch(
        `/api/analytics/demand-predictions?days=${selectedTimeframe}`,
      );
      if (predictionsResponse.ok) {
        const predictionsData = await predictionsResponse.json();
        setPredictions(predictionsData.predictions || []);
      }

      setError(null);
    } catch (err) {
      console.error("Failed to fetch forecasting data:", err);
      setError("Failed to load forecasting data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  const getConfidenceColor = (accuracy) => {
    const confidencePercent = accuracy * 100;
    if (confidencePercent >= 90) return "text-green-600";
    if (confidencePercent >= 80) return "text-yellow-600";
    return "text-red-600";
  };

  const getConfidenceBadge = (accuracy) => {
    const confidencePercent = Math.round(accuracy * 100);
    if (confidencePercent >= 90)
      return (
        <Badge className="bg-green-100 text-green-800">
          High ({confidencePercent}%)
        </Badge>
      );
    if (confidencePercent >= 80)
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          Medium ({confidencePercent}%)
        </Badge>
      );
    return (
      <Badge className="bg-red-100 text-red-800">
        Low ({confidencePercent}%)
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Navigation onLogout={handleLogout} />
        <div className="lg:pl-64">
          <main className="p-6 lg:p-8">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-muted-foreground">
                  Loading forecasting data...
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navigation onLogout={handleLogout} />

      <div className="lg:pl-64">
        <main className="p-6 lg:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  AI Demand Forecasting
                </h1>
              </div>
              <p className="text-muted-foreground">
                AI-powered predictions and inventory optimization powered by AWS
                SageMaker
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="7">Next 7 days</option>
                <option value="14">Next 14 days</option>
                <option value="30">Next 30 days</option>
              </select>
              <Button onClick={fetchForecastingData}>
                <Activity className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
              <Button
                onClick={fetchForecastingData}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Summary Stats */}
          {dashboardData && (
            <div className="grid gap-4 md:grid-cols-4 mb-8">
              <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Cpu className="h-8 w-8" />
                    <div>
                      <div className="text-2xl font-bold">
                        {dashboardData.summary.totalModels}
                      </div>
                      <div className="text-blue-100">Active AI Models</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Target className="h-8 w-8" />
                    <div>
                      <div className="text-2xl font-bold">
                        {(
                          parseFloat(dashboardData.summary.avgAccuracy) * 100
                        ).toFixed(1)}
                        %
                      </div>
                      <div className="text-green-100">Avg Model Accuracy</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-500 to-violet-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-8 w-8" />
                    <div>
                      <div className="text-2xl font-bold">
                        {dashboardData.summary.totalPredictions}
                      </div>
                      <div className="text-purple-100">Active Predictions</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Zap className="h-8 w-8" />
                    <div>
                      <div className="text-2xl font-bold">
                        {dashboardData.summary.highPriorityRecommendations}
                      </div>
                      <div className="text-orange-100">
                        High Priority Actions
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Demand Predictions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Demand Predictions
                </CardTitle>
                <CardDescription>
                  AI-generated demand forecasts for the next {selectedTimeframe}{" "}
                  days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {predictions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No predictions available for the selected timeframe</p>
                    </div>
                  ) : (
                    predictions.slice(0, 10).map((prediction, index) => (
                      <div
                        key={`${prediction.product_id}-${prediction.store_name}-${prediction.prediction_date}-${index}`}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium">
                            {prediction.product_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {prediction.product_id} • {prediction.store_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(
                              prediction.prediction_date,
                            ).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">
                            {Math.round(prediction.predicted_demand)} units
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Range:{" "}
                            {Math.round(prediction.confidence_interval_lower)}-
                            {Math.round(prediction.confidence_interval_upper)}
                          </div>
                          {getConfidenceBadge(prediction.model_accuracy)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Model Performance */}
            {dashboardData && dashboardData.modelPerformance && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    AI Model Performance
                  </CardTitle>
                  <CardDescription>
                    Performance metrics for deployed machine learning models
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboardData.modelPerformance.map((model, index) => (
                      <div
                        key={`${model.model_name}-${model.model_type}-${index}`}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{model.model_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {model.model_type.toUpperCase()} •{" "}
                            {model.predictions_count} predictions
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`font-bold text-lg ${getConfidenceColor(model.model_accuracy)}`}
                          >
                            {(model.model_accuracy * 100).toFixed(1)}%
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Accuracy
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Top Predicted Products */}
          {dashboardData && dashboardData.recentPredictions && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Top Predicted Demand (Next 7 Days)
                </CardTitle>
                <CardDescription>
                  Products with highest predicted demand for strategic planning
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-semibold">Product</th>
                        <th className="text-left p-4 font-semibold">Store</th>
                        <th className="text-left p-4 font-semibold">
                          Total Predicted Demand
                        </th>
                        <th className="text-left p-4 font-semibold">
                          Daily Average
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.recentPredictions.map((product, index) => (
                        <tr
                          key={`${product.product_id}-${product.store_name}-${index}`}
                          className="border-b hover:bg-slate-50/50"
                        >
                          <td className="p-4">
                            <div className="font-medium">
                              {product.product_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {product.product_id}
                            </div>
                          </td>
                          <td className="p-4">{product.store_name}</td>
                          <td className="p-4 font-semibold text-blue-600">
                            {Math.round(product.total_predicted_demand)} units
                          </td>
                          <td className="p-4">
                            {Math.round(product.avg_daily_demand)} units/day
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
