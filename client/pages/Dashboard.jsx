import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { StatCard } from "@/components/ui/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badges";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Plus,
  Eye,
  MapPin,
  Building,
} from "lucide-react";
import {
  fetchDashboardAnalytics,
  fetchStores,
  fetchLowStockItems,
  fetchRecentTransactions,
} from "@/lib/api";
import { logHealthCheck, testDashboardConnectivity } from "@/lib/health-check";

// AWS Cognito and Lambda Integration
// import { getCurrentUser, signOut } from 'aws-amplify/auth';
// import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedStore, setSelectedStore] = useState("all");
  const [stores, setStores] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [salesTrends, setSalesTrends] = useState([]);
  const [categoryData, setCategoryData] = useState([]);

  // Individual loading states for components
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [lowStockLoading, setLowStockLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [chartsLoading, setChartsLoading] = useState(false);

  useEffect(() => {
    // Perform health check in development mode for debugging
    if (process.env.NODE_ENV === "development") {
      logHealthCheck().catch(console.error);
    }

    checkAuthentication();
    loadStores();
    fetchDashboardData();

    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Refetch data when store selection changes
  useEffect(() => {
    if (!isLoading && stores.length > 0) {
      fetchDashboardData();
    }
  }, [selectedStore]);

  // Helper function to find and navigate to specific product
  const navigateToProduct = async (productName) => {
    try {
      // First try to find the product by searching
      const response = await fetch("/api/products");
      if (response.ok) {
        const data = await response.json();
        const product = data.products.find(
          (p) =>
            p.productName.toLowerCase() === productName.toLowerCase() ||
            p.name?.toLowerCase() === productName.toLowerCase(),
        );

        if (product) {
          // Navigate directly to the product detail page
          navigate(`/products/${product.id}`);
        } else {
          // Fallback to search in products page
          navigate(`/products?search=${encodeURIComponent(productName)}`);
        }
      } else {
        // Fallback to search if API fails
        navigate(`/products?search=${encodeURIComponent(productName)}`);
      }
    } catch (error) {
      console.error("Error finding product:", error);
      // Fallback to search
      navigate(`/products?search=${encodeURIComponent(productName)}`);
    }
  };

  const loadStores = async () => {
    try {
      const storesData = await fetchStores();
      setStores(storesData);
    } catch (error) {
      console.error("Failed to load stores:", error);
      // Set fallback stores
      setStores([
        { id: "all", name: "All Stores", location: "Combined View" },
        { id: "store_001", name: "Downtown Store", location: "123 Main St" },
        {
          id: "store_002",
          name: "Mall Location",
          location: "456 Shopping Center",
        },
        { id: "store_003", name: "Uptown Branch", location: "789 North Ave" },
        { id: "store_004", name: "Westside Market", location: "321 West Blvd" },
      ]);
    }
  };

  const checkAuthentication = async () => {
    try {
      // AWS Cognito Authentication Check with Store-Based Access Control
      const { getCurrentUser, fetchUserAttributes } = await import(
        "aws-amplify/auth"
      );
      const currentUser = await getCurrentUser();
      const userAttributes = await fetchUserAttributes();

      console.log("Dashboard - Current user:", currentUser);
      console.log("Dashboard - User attributes:", userAttributes);

      // Check user's store access permissions
      const userStoreAccess = userAttributes["custom:store_access"]; // e.g., "all" or "store_001,store_002"
      const userRole = userAttributes["custom:role"]; // e.g., "admin", "manager", "employee"
      const userStatus = userAttributes["custom:status"]; // Check if account is active

      // Validate user status
      if (userStatus === "pending") {
        const { signOut } = await import("aws-amplify/auth");
        await signOut();
        navigate("/login");
        return;
      }

      if (userStatus === "inactive" || userStatus === "suspended") {
        const { signOut } = await import("aws-amplify/auth");
        await signOut();
        navigate("/login");
        return;
      }

      // Set default store based on user permissions
      let defaultStore = "all";
      if (
        userRole === "employee" &&
        userStoreAccess &&
        userStoreAccess !== "all"
      ) {
        // Employees typically see only their assigned store(s)
        const accessibleStores = userStoreAccess.split(",");
        defaultStore =
          accessibleStores.length === 1 ? accessibleStores[0] : "all";
      } else if (userRole === "manager" && userStoreAccess !== "all") {
        // Managers might have access to specific stores
        const accessibleStores = userStoreAccess.split(",");
        defaultStore =
          accessibleStores.length === 1 ? accessibleStores[0] : "all";
      }
      // Admins get "all" by default

      setSelectedStore(defaultStore);
      setUser({
        username: currentUser.username,
        attributes: {
          given_name:
            userAttributes.given_name || userAttributes.name || "User",
          family_name: userAttributes.family_name || "",
          "custom:role": userRole,
          "custom:store_access": userStoreAccess,
        },
      });
    } catch (error) {
      console.log("Authentication check failed:", error);
      // Remove demo authentication fallback
      localStorage.removeItem("isAuthenticated");
      navigate("/login");
    }
  };

  const fetchDashboardData = async () => {
    try {
      console.log(`Fetching dashboard data for store: ${selectedStore}`);

      // Quick connectivity test in development mode
      if (process.env.NODE_ENV === "development") {
        const connectivityTest = await testDashboardConnectivity(selectedStore);
        if (!connectivityTest.success) {
          console.warn("Connectivity test failed, proceeding with fallback");
        }
      }

      // Set individual loading states
      setAnalyticsLoading(true);
      setLowStockLoading(true);
      setTransactionsLoading(true);
      setChartsLoading(true);

      // Fetch all dashboard data in parallel but handle each individually
      const fetchAnalytics = async () => {
        try {
          const data = await fetchDashboardAnalytics(selectedStore);
          setAnalyticsData({
            totalProducts: data.totalProducts,
            lowStockItems: data.lowStockItems,
            revenueThisMonth: data.revenueThisMonth,
            inventoryTurnover: data.inventoryTurnover,
            topSellingCategories: data.topSellingCategories,
          });
        } catch (error) {
          console.error("Failed to fetch analytics:", error);
          setAnalyticsData({
            totalProducts: 0,
            lowStockItems: 0,
            topSellingCategories: [],
            revenueThisMonth: 0,
            inventoryTurnover: 0,
          });
        } finally {
          setAnalyticsLoading(false);
        }
      };

      const fetchLowStock = async () => {
        try {
          const data = await fetchLowStockItems(selectedStore);
          setLowStockItems(data || []);
        } catch (error) {
          console.error("Failed to fetch low stock items:", error);
          setLowStockItems([]);
        } finally {
          setLowStockLoading(false);
        }
      };

      const fetchTransactions = async () => {
        try {
          const data = await fetchRecentTransactions(selectedStore);
          setRecentTransactions(data || []);
        } catch (error) {
          console.error("Failed to fetch transactions:", error);
          setRecentTransactions([]);
        } finally {
          setTransactionsLoading(false);
        }
      };

      const fetchChartsData = async () => {
        try {
          // Generate mock sales trends data
          const mockSalesTrends = [
            { date: "Jan 10", sales: 245, forecast: 250, revenue: 2340 },
            { date: "Jan 11", sales: 280, forecast: 275, revenue: 2680 },
            { date: "Jan 12", sales: 195, forecast: 200, revenue: 1890 },
            { date: "Jan 13", sales: 320, forecast: 310, revenue: 3200 },
            { date: "Jan 14", sales: 260, forecast: 265, revenue: 2520 },
            { date: "Jan 15", sales: 290, forecast: 285, revenue: 2890 },
            { date: "Jan 16", sales: 235, forecast: 240, revenue: 2350 },
          ];

          // Generate category data based on top selling categories
          const mockCategoryData = [
            { name: "Fruits & Vegetables", value: 35, color: "#8884d8" },
            { name: "Dairy", value: 25, color: "#82ca9d" },
            { name: "Meat & Poultry", value: 20, color: "#ffc658" },
            { name: "Beverages", value: 12, color: "#ff7300" },
            { name: "Snacks", value: 8, color: "#00ff88" },
          ];

          setSalesTrends(mockSalesTrends);
          setCategoryData(mockCategoryData);
        } catch (error) {
          console.error("Failed to fetch charts data:", error);
        } finally {
          setChartsLoading(false);
        }
      };

      // Execute all fetches in parallel
      await Promise.all([
        fetchAnalytics(),
        fetchLowStock(),
        fetchTransactions(),
        fetchChartsData(),
      ]);

      console.log("Successfully fetched all dashboard data");
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setAnalyticsLoading(false);
      setLowStockLoading(false);
      setTransactionsLoading(false);
      setChartsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // AWS Cognito Sign Out
      const { signOut } = await import("aws-amplify/auth");
      await signOut();

      console.log("User signed out successfully");
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Force logout on error - clear any remaining auth state
      localStorage.removeItem("isAuthenticated");
      navigate("/login");
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation onLogout={handleLogout} />
        <div className="lg:pl-64">
          <main className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading dashboard...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: "Total Products",
      value: analyticsData?.totalProducts?.toLocaleString() || "0",
      description: "Items in inventory",
      icon: Package,
      trend: "+12%",
      trendUp: true,
    },
    {
      title: "Revenue (Month)",
      value: `$${analyticsData?.revenueThisMonth?.toLocaleString() || "0"}`,
      description: "Total sales this month",
      icon: DollarSign,
      trend: "+8.2%",
      trendUp: true,
    },
    {
      title: "Low Stock Items",
      value: analyticsData?.lowStockItems?.toString() || "0",
      description: "Items below minimum",
      icon: AlertTriangle,
      trend: "-3",
      trendUp: false,
    },
    {
      title: "Inventory Turnover",
      value: analyticsData?.inventoryTurnover?.toFixed(1) || "0.0",
      description: "Times per year",
      icon: TrendingUp,
      trend: "+0.3",
      trendUp: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation onLogout={handleLogout} />

      <div className="lg:pl-64">
        <main className="container mx-auto px-4 py-8">
          {/* Header */}
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <Package className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                      Welcome back, {user?.attributes?.given_name || "User"}!
                    </h1>
                    <p className="text-gray-600 mt-1">
                      {currentTime.toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}{" "}
                      •{" "}
                      {currentTime.toLocaleTimeString("en-US", {
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </div>

                {/* Store Selector */}
                <div className="mt-4">
                  <div className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-gray-500" />
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
                    {selectedStore !== "all" && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <MapPin className="h-4 w-4" />
                        {stores.find((s) => s.id === selectedStore)?.location}
                      </div>
                    )}
                  </div>

                  {selectedStore === "all" ? (
                    <Badge variant="default" className="mt-2">
                      Viewing All Stores Combined
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="mt-2">
                      {stores.find((s) => s.id === selectedStore)?.name}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => navigate("/products")}
                  variant="outline"
                  className="border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Inventory
                </Button>
                <Button
                  onClick={() => navigate("/products?action=add")}
                  className="bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 hover:from-blue-600 hover:via-purple-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {analyticsLoading
              ? // Loading skeleton for stats
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="bg-card rounded-lg border p-6">
                    <div className="animate-pulse">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-2/3"></div>
                    </div>
                  </div>
                ))
              : stats.map((stat, index) => <StatCard key={index} {...stat} />)}
          </div>

          {/* Dashboard Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Alert */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Low Stock Alert</CardTitle>
                  <CardDescription>
                    Items that need immediate attention
                  </CardDescription>
                </div>
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lowStockLoading ? (
                    // Loading skeleton for low stock items
                    Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="p-3 bg-muted/50 rounded-lg">
                        <div className="animate-pulse flex justify-between">
                          <div className="flex-1">
                            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                          </div>
                          <div className="w-16">
                            <div className="h-4 bg-muted rounded w-full mb-1"></div>
                            <div className="h-3 bg-muted rounded w-full"></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : lowStockItems.length > 0 ? (
                    lowStockItems.map((item, index) => (
                      <div
                        key={index}
                        onClick={() => navigateToProduct(item.name)}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer transition-all duration-200 hover:bg-muted/70 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                        title="Click to view product details"
                      >
                        <div>
                          <p className="font-medium hover:text-primary transition-colors">
                            {item.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.category}
                            {selectedStore === "all" && item.store && (
                              <span className="ml-2 text-blue-600">
                                • {item.store}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-destructive">
                            {item.current} / {item.minimum}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            current / minimum
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      All items are well stocked! 🎉
                    </p>
                  )}
                </div>
                {lowStockItems.length > 0 && (
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => navigate("/products?filter=lowstock")}
                  >
                    View All Low Stock Items
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Recent Activity</CardTitle>
                <CardDescription>Latest inventory transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transactionsLoading
                    ? // Loading skeleton for transactions
                      Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-lg">
                          <div className="animate-pulse flex justify-between">
                            <div className="flex-1">
                              <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
                              <div className="h-3 bg-muted rounded w-1/2"></div>
                            </div>
                            <div className="w-16">
                              <div className="h-4 bg-muted rounded w-full mb-1"></div>
                              <div className="h-3 bg-muted rounded w-full"></div>
                            </div>
                          </div>
                        </div>
                      ))
                    : recentTransactions.map((transaction, index) => (
                        <div
                          key={index}
                          onClick={() => navigateToProduct(transaction.product)}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer transition-all duration-200 hover:bg-muted/70 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                          title="Click to view product details"
                        >
                          <div>
                            <p className="font-medium hover:text-primary transition-colors">
                              {transaction.product}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {transaction.type} • {transaction.time}
                              {selectedStore === "all" && transaction.store && (
                                <span className="ml-2 text-blue-600">
                                  • {transaction.store}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {transaction.type === "Sale" ? "-" : "+"}
                              {transaction.quantity}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              ${transaction.amount?.toFixed(2) || "0.00"}
                            </p>
                          </div>
                        </div>
                      ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => navigate("/transactions")}
                >
                  View All Transactions
                </Button>
              </CardContent>
            </Card>

            {/* Sales vs Forecast Trends Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-xl">
                  Sales vs Forecast Trends
                </CardTitle>
                <CardDescription>
                  Actual sales performance against predictions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartsLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="animate-pulse text-center">
                      <div className="h-4 bg-muted rounded w-32 mx-auto mb-2"></div>
                      <div className="h-3 bg-muted rounded w-24 mx-auto"></div>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={salesTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        stroke="#8884d8"
                        name="Actual Sales"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="#82ca9d"
                        name="Forecasted"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Category Performance and Top Categories Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Category Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Category Performance</CardTitle>
                <CardDescription>
                  Revenue distribution by product category
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartsLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="animate-pulse text-center">
                      <div className="h-4 bg-muted rounded w-32 mx-auto mb-2"></div>
                      <div className="h-3 bg-muted rounded w-24 mx-auto"></div>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">
                  Top Selling Categories
                </CardTitle>
                <CardDescription>
                  Best performing product categories this month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsLoading ? (
                    // Loading skeleton for categories
                    Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="p-3 bg-muted/50 rounded-lg">
                        <div className="animate-pulse flex justify-between">
                          <div className="flex-1">
                            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                          </div>
                          <div className="w-16">
                            <div className="h-4 bg-muted rounded w-full mb-1"></div>
                            <div className="h-3 bg-muted rounded w-full"></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : analyticsData?.topSellingCategories?.length > 0 ? (
                    analyticsData.topSellingCategories.map(
                      (category, index) => (
                        <div
                          key={index}
                          onClick={() =>
                            navigate(
                              `/products?category=${encodeURIComponent(category.name)}`,
                            )
                          }
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer transition-all duration-200 hover:bg-muted/70 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                          title={`Click to view ${category.name} products`}
                        >
                          <div>
                            <p className="font-medium hover:text-primary transition-colors">
                              {category.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Category
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">
                              {category.sales}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              units sold
                            </p>
                          </div>
                        </div>
                      ),
                    )
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No category data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
