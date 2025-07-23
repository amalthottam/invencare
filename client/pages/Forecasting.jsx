import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Activity,
  Brain,
  Target,
  Cpu,
  Zap,
  Store,
  Package,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
  Loader2,
} from "lucide-react";

export default function Forecasting() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);

  useEffect(() => {
    fetchForecastingData();
  }, []);

  const fetchForecastingData = async () => {
    try {
      setLoading(true);

      // Fetch dashboard summary
      const dashboardResponse = await fetch("/api/analytics/forecasting-dashboard");
      if (dashboardResponse.ok) {
        const response = await dashboardResponse.json();
        setDashboardData(response.data);
      }

      // Fetch demand predictions
      const predictionsResponse = await fetch("/api/analytics/demand-predictions?days=30");
      if (predictionsResponse.ok) {
        const response = await predictionsResponse.json();
        setPredictions(response.data.predictions || []);
      }

      setError(null);
    } catch (err) {
      console.error("Failed to fetch forecasting data:", err);
      setError("Failed to load forecasting data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateForecast = async () => {
    try {
      setGenerating(true);
      setGenerateSuccess(false);
      setError(null);

      const response = await fetch(
        "https://guo98gn0q0.execute-api.us-east-1.amazonaws.com/production/forecast/refresh-predictions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "lPACRhgg5y8dqG6OMOUXFNWPpJdH7IP1cdNPRsW7",
          },
          body: JSON.stringify({
            forecasting_days: 30,
          }),
        }
      );

      if (response.ok) {
        setGenerateSuccess(true);
        // Refresh the data after successful generation
        setTimeout(() => {
          fetchForecastingData();
        }, 2000);
      } else {
        throw new Error(`API call failed with status: ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to generate forecast:", err);
      setError("Failed to generate forecast. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const getConfidenceColor = (accuracy) => {
    if (!accuracy) return "text-gray-500";
    const confidencePercent = accuracy * 100;
    if (confidencePercent >= 80) return "text-green-600";
    if (confidencePercent >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getConfidenceBadge = (accuracy) => {
    if (!accuracy) return <Badge variant="secondary">Unknown</Badge>;
    const confidencePercent = Math.round(accuracy * 100);
    if (confidencePercent >= 80)
      return (
        <Badge className="bg-green-100 text-green-800">
          High ({confidencePercent}%)
        </Badge>
      );
    if (confidencePercent >= 60)
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getUncertaintyLevel = (prediction) => {
    if (!prediction.confidence_interval_lower || !prediction.confidence_interval_upper) {
      return "Unknown";
    }
    const uncertainty = prediction.confidence_interval_upper - prediction.confidence_interval_lower;
    const relative = uncertainty / prediction.predicted_demand;
    if (relative <= 0.2) return "Low";
    if (relative <= 0.5) return "Medium";
    return "High";
  };

  const getCategoryColor = (category) => {
    const colors = {
      "Fruits & Vegetables": "bg-green-100 text-green-800",
      "Dairy": "bg-blue-100 text-blue-800",
      "Meat & Poultry": "bg-red-100 text-red-800",
      "Beverages": "bg-purple-100 text-purple-800",
      "Bakery": "bg-orange-100 text-orange-800",
      "Snacks": "bg-yellow-100 text-yellow-800",
      "Seafood": "bg-cyan-100 text-cyan-800",
      "Grains": "bg-amber-100 text-amber-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
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
                <p className="text-muted-foreground">Loading forecasting data...</p>
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
                <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  AI Demand Forecasting
                </h1>
              </div>
              <p className="text-muted-foreground">
                Unified model predictions powered by AWS Lambda & SageMaker
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={fetchForecastingData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
              <Button
                onClick={generateForecast}
                disabled={generating}
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 animate-pulse"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : generateSuccess ? (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generated!
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generate Forecast
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Success Message */}
          {generateSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg animate-fade-in">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-green-600" />
                <p className="text-green-700 font-medium">
                  Forecast generation completed successfully!
                </p>
              </div>
              <p className="text-green-600 text-sm mt-1">
                New predictions have been generated for the next 30 days. Data will refresh automatically.
              </p>
            </div>
          )}

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
          {dashboardData && dashboardData.summary && (
            <div className="grid gap-4 md:grid-cols-4 mb-8">
              <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Cpu className="h-8 w-8" />
                    <div>
                      <div className="text-2xl font-bold">
                        {dashboardData.summary.totalModels || 1}
                      </div>
                      <div className="text-blue-100">Active AI Model</div>
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
                        {dashboardData.summary.avgAccuracy ? 
                          (parseFloat(dashboardData.summary.avgAccuracy) * 100).toFixed(1) : 
                          '65.0'}%
                      </div>
                      <div className="text-green-100">Model Accuracy</div>
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
                        {dashboardData.summary.totalPredictions || predictions.length}
                      </div>
                      <div className="text-purple-100">Total Predictions</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8" />
                    <div>
                      <div className="text-2xl font-bold">
                        {dashboardData.summary.highPriorityRecommendations || 0}
                      </div>
                      <div className="text-orange-100">High Uncertainty</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}



          <div className="grid gap-6 lg:grid-cols-3">
            {/* Demand Predictions - Takes 2 columns */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Demand Predictions
                  <Badge variant="outline" className="ml-auto">
                    {predictions.length} predictions
                  </Badge>
                </CardTitle>
                <CardDescription>
                  AI-generated demand forecasts for the next {selectedTimeframe} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {predictions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No predictions available for the selected filters</p>
                      <p className="text-sm">Try adjusting your timeframe or filters</p>
                    </div>
                  ) : (
                    predictions.map((prediction) => (
                      <div
                        key={`${prediction.product_id}-${prediction.store_id}-${prediction.prediction_date}`}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{prediction.product_name}</span>
                            <Badge className={getCategoryColor(prediction.category)} variant="outline">
                              {prediction.category}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-2">
                              <Store className="h-3 w-3" />
                              {prediction.store_name}
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              {formatDate(prediction.prediction_date)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div className="font-bold text-lg text-blue-600">
                            {Math.round(prediction.predicted_demand)} units
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Range: {Math.round(prediction.confidence_interval_lower || 0)} - 
                            {Math.round(prediction.confidence_interval_upper || 0)}
                          </div>
                          <div className="flex gap-2">
                            {getConfidenceBadge(prediction.prediction_accuracy)}
                            <Badge variant="outline" className="text-xs">
                              {getUncertaintyLevel(prediction)} uncertainty
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Model Performance & Recent Insights */}
            <div className="space-y-6">
              {/* Model Performance */}
              {dashboardData && dashboardData.modelPerformance && dashboardData.modelPerformance.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      Model Performance
                    </CardTitle>
                    <CardDescription>
                      Current AI model metrics and status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardData.modelPerformance.map((model, index) => (
                        <div
                          key={`${model.model_name}-${index}`}
                          className="p-4 border rounded-lg"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium">{model.model_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {model.model_type?.toUpperCase()} • {model.predictions_count} predictions
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-bold text-lg ${getConfidenceColor(model.model_accuracy)}`}>
                                {model.model_accuracy ? 
                                  (model.model_accuracy * 100).toFixed(1) : 
                                  '65.0'}%
                              </div>
                              <div className="text-sm text-muted-foreground">Accuracy</div>
                            </div>
                          </div>
                          <Badge 
                            className={model.training_status === 'deployed' ? 
                              'bg-green-100 text-green-800' : 
                              'bg-yellow-100 text-yellow-800'}
                          >
                            {model.training_status || 'deployed'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Products This Week */}
              {dashboardData && dashboardData.recentPredictions && dashboardData.recentPredictions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Top Predicted Demand
                    </CardTitle>
                    <CardDescription>
                      Highest demand products (next 7 days)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dashboardData.recentPredictions.slice(0, 5).map((product, index) => (
                        <div
                          key={`${product.product_id}-${product.store_name}-${index}`}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">{product.product_name}</div>
                            <div className="text-xs text-muted-foreground">{product.store_name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-blue-600">
                              {Math.round(product.total_predicted_demand)} units
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {Math.round(product.avg_daily_demand)}/day
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Accuracy Trends */}
              {dashboardData && dashboardData.accuracyTrends && dashboardData.accuracyTrends.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Recent Accuracy
                    </CardTitle>
                    <CardDescription>
                      Model accuracy over past week
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dashboardData.accuracyTrends.map((trend, index) => (
                        <div
                          key={`${trend.date}-${index}`}
                          className="flex items-center justify-between py-2"
                        >
                          <div className="text-sm text-muted-foreground">
                            {formatDate(trend.date)}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`text-sm font-medium ${getConfidenceColor(trend.avg_accuracy)}`}>
                              {trend.avg_accuracy ? 
                                `${Math.round(trend.avg_accuracy * 100)}%` : 
                                'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ({trend.prediction_count} predictions)
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
