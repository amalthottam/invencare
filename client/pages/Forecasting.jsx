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
} from "lucide-react";

const forecastData = [
  {
    id: "1",
    productName: "Organic Bananas",
    productId: "ORG-BAN-001",
    category: "Fruits & Vegetables",
    currentStock: 120,
    avgDailySales: 15,
    daysUntilStockout: 8,
    confidence: 89,
  },
  {
    id: "2",
    productName: "Whole Milk",
    productId: "WHL-MLK-002",
    category: "Dairy",
    currentStock: 8,
    avgDailySales: 12,
    daysUntilStockout: 1,
    confidence: 95,
  },
  {
    id: "3",
    productName: "Brown Bread",
    productId: "BRN-BRD-003",
    category: "Bakery",
    currentStock: 0,
    avgDailySales: 8,
    daysUntilStockout: 0,
    confidence: 100,
  },
];

export default function Forecasting() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalProducts, setModalProducts] = useState([]);

  useEffect(() => {
    // Check authentication
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  const getUrgencyBadge = (daysUntilStockout) => {
    if (daysUntilStockout === 0) {
      return <StatusBadge status="Out of Stock" />;
    } else if (daysUntilStockout <= 3) {
      return <StatusBadge status="Critical" />;
    } else if (daysUntilStockout <= 7) {
      return <StatusBadge status="Warning" />;
    } else {
      return <StatusBadge status="Normal" />;
    }
  };

  const filteredForecast = forecastData.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;

    let matchesFilter = true;
    if (selectedFilter === "critical") {
      matchesFilter = item.daysUntilStockout <= 3;
    } else if (selectedFilter === "warning") {
      matchesFilter = item.daysUntilStockout > 3 && item.daysUntilStockout <= 7;
    } else if (selectedFilter === "normal") {
      matchesFilter = item.daysUntilStockout > 7;
    }

    return matchesCategory && matchesFilter;
  });

  const categories = [...new Set(forecastData.map((item) => item.category))];

  const handleCardClick = (filterType) => {
    let products = [];
    let title = "";

    switch (filterType) {
      case "critical":
        products = forecastData.filter((item) => item.daysUntilStockout <= 3);
        title = "Critical Level Products";
        break;
      case "warning":
        products = forecastData.filter(
          (item) => item.daysUntilStockout > 3 && item.daysUntilStockout <= 7,
        );
        title = "Warning Level Products";
        break;
      case "normal":
        products = forecastData.filter((item) => item.daysUntilStockout > 7);
        title = "Well Stocked Products";
        break;
      case "confidence":
        products = [...forecastData].sort(
          (a, b) => b.confidence - a.confidence,
        );
        title = "Products by Confidence Level";
        break;
      default:
        products = forecastData;
        title = "All Products";
    }

    setModalProducts(products);
    setModalTitle(title);
    setShowDetailModal(true);
  };

  const applyFilter = (filterType) => {
    setSelectedFilter(filterType);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <Navigation onLogout={handleLogout} />

      <div className="lg:pl-64">
        <main className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Demand Forecasting
                  </h1>
                </div>
                <p className="text-muted-foreground">
                  Predict inventory needs and optimize stock levels
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All Levels</option>
                  <option value="critical">Critical Only</option>
                  <option value="warning">Warning Only</option>
                  <option value="normal">Normal Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick("normal")}
            >
              <CardContent className="p-6">
                <div className="text-2xl font-bold">
                  {
                    filteredForecast.filter(
                      (item) => item.daysUntilStockout > 7,
                    ).length
                  }
                </div>
                <div className="text-green-100">Well Stocked</div>
                <div className="text-green-200 text-xs mt-1">
                  Click to view details
                </div>
              </CardContent>
            </Card>
            <Card
              className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white border-0 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick("warning")}
            >
              <CardContent className="p-6">
                <div className="text-2xl font-bold">
                  {
                    filteredForecast.filter(
                      (item) =>
                        item.daysUntilStockout <= 7 &&
                        item.daysUntilStockout > 3,
                    ).length
                  }
                </div>
                <div className="text-yellow-100">Warning Level</div>
                <div className="text-yellow-200 text-xs mt-1">
                  Click to view details
                </div>
              </CardContent>
            </Card>
            <Card
              className="bg-gradient-to-r from-red-500 to-pink-600 text-white border-0 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick("critical")}
            >
              <CardContent className="p-6">
                <div className="text-2xl font-bold">
                  {
                    filteredForecast.filter(
                      (item) => item.daysUntilStockout <= 3,
                    ).length
                  }
                </div>
                <div className="text-red-100">Critical Level</div>
                <div className="text-red-200 text-xs mt-1">
                  Click to view details
                </div>
              </CardContent>
            </Card>
            <Card
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick("confidence")}
            >
              <CardContent className="p-6">
                <div className="text-2xl font-bold">
                  {Math.round(
                    filteredForecast.reduce(
                      (sum, item) => sum + item.confidence,
                      0,
                    ) / filteredForecast.length,
                  )}
                  %
                </div>
                <div className="text-blue-100">Avg Confidence</div>
                <div className="text-blue-200 text-xs mt-1">
                  Click to view details
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              variant={selectedFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => applyFilter("all")}
            >
              All Products ({forecastData.length})
            </Button>
            <Button
              variant={
                selectedFilter === "critical" ? "destructive" : "outline"
              }
              size="sm"
              onClick={() => applyFilter("critical")}
            >
              Critical (
              {
                forecastData.filter((item) => item.daysUntilStockout <= 3)
                  .length
              }
              )
            </Button>
            <Button
              variant={selectedFilter === "warning" ? "secondary" : "outline"}
              size="sm"
              onClick={() => applyFilter("warning")}
            >
              Warning (
              {
                forecastData.filter(
                  (item) =>
                    item.daysUntilStockout > 3 && item.daysUntilStockout <= 7,
                ).length
              }
              )
            </Button>
            <Button
              variant={selectedFilter === "normal" ? "default" : "outline"}
              size="sm"
              onClick={() => applyFilter("normal")}
            >
              Normal (
              {forecastData.filter((item) => item.daysUntilStockout > 7).length}
              )
            </Button>
          </div>

          {/* Forecast Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Inventory Forecast
              </CardTitle>
              <CardDescription>
                AI-powered predictions for stock depletion and reorder timing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredForecast.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="font-medium">{item.productName}</h3>
                        <span className="font-mono text-sm text-blue-600">
                          {item.productId}
                        </span>
                        <CategoryBadge category={item.category} />
                        <span className="text-sm text-muted-foreground">
                          Confidence: {item.confidence}%
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <span>Current Stock: {item.currentStock}</span>
                        <span>Daily Sales: {item.avgDailySales}</span>
                        <span>
                          {item.daysUntilStockout === 0
                            ? "Out of stock"
                            : `${item.daysUntilStockout} days until stockout`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getUrgencyBadge(item.daysUntilStockout)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detail Modal */}
          {showDetailModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-semibold">{modalTitle}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDetailModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  {modalProducts.length > 0 ? (
                    modalProducts.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <h3 className="font-medium">{item.productName}</h3>
                            <span className="font-mono text-sm text-blue-600">
                              {item.productId}
                            </span>
                            <CategoryBadge category={item.category} />
                            <span className="text-sm text-muted-foreground">
                              Confidence: {item.confidence}%
                            </span>
                          </div>
                          <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <span>Current Stock: {item.currentStock}</span>
                            <span>Daily Sales: {item.avgDailySales}</span>
                            <span>
                              {item.daysUntilStockout === 0
                                ? "Out of stock"
                                : `${item.daysUntilStockout} days until stockout`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getUrgencyBadge(item.daysUntilStockout)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No products found for this filter.
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {modalProducts.length} product
                    {modalProducts.length !== 1 ? "s" : ""}
                  </div>
                  <Button onClick={() => setShowDetailModal(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
