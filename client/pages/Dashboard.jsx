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
  Package,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Plus,
  Eye,
  MapPin,
  Building,
} from "lucide-react";
import { fetchDashboardAnalytics } from "@/lib/api";
import { logHealthCheck, testDashboardConnectivity } from "@/lib/health-check";

// AWS Cognito and Lambda Integration
// import { getCurrentUser, signOut } from 'aws-amplify/auth';
// import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// Mock store data
const stores = [
  { id: "all", name: "All Stores", location: "Combined View" },
  { id: "store_001", name: "Downtown Store", location: "123 Main St" },
  { id: "store_002", name: "Mall Location", location: "456 Shopping Center" },
  { id: "store_003", name: "Uptown Branch", location: "789 North Ave" },
  { id: "store_004", name: "Westside Market", location: "321 West Blvd" },
];

// Mock analytics data by store
const storeAnalytics = {
  all: {
    totalProducts: 3250,
    lowStockItems: 47,
    revenueThisMonth: 125430.5,
    inventoryTurnover: 4.2,
    topSellingCategories: [
      { name: "Beverages", sales: 2150 },
      { name: "Snacks", sales: 1820 },
      { name: "Dairy", sales: 1650 },
    ],
  },
  store_001: {
    totalProducts: 850,
    lowStockItems: 12,
    revenueThisMonth: 32150.25,
    inventoryTurnover: 4.5,
    topSellingCategories: [
      { name: "Beverages", sales: 580 },
      { name: "Dairy", sales: 420 },
      { name: "Snacks", sales: 385 },
    ],
  },
  store_002: {
    totalProducts: 920,
    lowStockItems: 15,
    revenueThisMonth: 38920.75,
    inventoryTurnover: 4.1,
    topSellingCategories: [
      { name: "Snacks", sales: 680 },
      { name: "Beverages", sales: 610 },
      { name: "Dairy", sales: 450 },
    ],
  },
  store_003: {
    totalProducts: 780,
    lowStockItems: 8,
    revenueThisMonth: 28790.0,
    inventoryTurnover: 3.9,
    topSellingCategories: [
      { name: "Dairy", sales: 520 },
      { name: "Beverages", sales: 480 },
      { name: "Bakery", sales: 380 },
    ],
  },
  store_004: {
    totalProducts: 700,
    lowStockItems: 12,
    revenueThisMonth: 25569.5,
    inventoryTurnover: 4.3,
    topSellingCategories: [
      { name: "Beverages", sales: 480 },
      { name: "Snacks", sales: 375 },
      { name: "Meat & Poultry", sales: 320 },
    ],
  },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedStore, setSelectedStore] = useState("all");

  useEffect(() => {
    // Perform health check in development mode for debugging
    if (process.env.NODE_ENV === 'development') {
      logHealthCheck().catch(console.error);
    }

    checkAuthentication();
    fetchDashboardData();

    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Refetch data when store selection changes
  useEffect(() => {
    if (!isLoading) {
      fetchDashboardData();
    }
  }, [selectedStore]);

  const checkAuthentication = async () => {
    try {
      // AWS Cognito Authentication Check with Store-Based Access Control
      // const currentUser = await getCurrentUser();
      // const userAttributes = await fetchUserAttributes();
      //
      // // Check user's store access permissions
      // const userStoreAccess = userAttributes['custom:store_access']; // e.g., "all" or "store_001,store_002"
      // const userRole = userAttributes['custom:role']; // e.g., "admin", "manager", "employee"
      // const userPrimaryStore = userAttributes['custom:primary_store']; // User's main store
      //
      // // Set default store based on user permissions
      // let defaultStore = "all";
      // if (userRole === "employee" && userPrimaryStore) {
      //   // Employees typically see only their assigned store
      //   defaultStore = userPrimaryStore;
      // } else if (userRole === "manager" && userStoreAccess !== "all") {
      //   // Managers might have access to specific stores
      //   const accessibleStores = userStoreAccess.split(',');
      //   defaultStore = accessibleStores.length === 1 ? accessibleStores[0] : "all";
      // }
      // // Admins get "all" by default
      //
      // setSelectedStore(defaultStore);
      // setUser(currentUser);

      // Demo authentication check (remove when implementing Cognito)
      const isAuthenticated = localStorage.getItem("isAuthenticated");
      if (!isAuthenticated) {
        navigate("/login");
        return;
      }

      // Demo user data with store access control (remove when implementing Cognito)
      setUser({
        username: "demo@invencare.com",
        attributes: {
          given_name: "Demo",
          family_name: "User",
          "custom:role": "manager", // Role determines default store access
          "custom:primary_store": "store_001", // User's main store assignment
          "custom:store_access": "all", // Stores user can access: "all" or "store_001,store_002"
        },
      });
    } catch (error) {
      console.log("Authentication check failed:", error);
      navigate("/login");
    }
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      console.log(`Fetching dashboard data for store: ${selectedStore}`);

      const data = await fetchDashboardAnalytics(selectedStore);
      console.log("Successfully fetched dashboard data:", data);

      setAnalyticsData({
        totalProducts: data.totalProducts,
        lowStockItems: data.lowStockItems,
        revenueThisMonth: data.revenueThisMonth,
        inventoryTurnover: data.inventoryTurnover,
        topSellingCategories: data.topSellingCategories,
      });
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      console.log("Network error details:", {
        message: error.message,
        stack: error.stack,
        origin: window.location.origin,
        href: window.location.href
      });

      // Always provide fallback data to ensure the UI still works
      console.log("Using mock data due to network error");
      setAnalyticsData(storeAnalytics[selectedStore] || {
        totalProducts: 0,
        lowStockItems: 0,
        topSellingCategories: [],
        revenueThisMonth: 0,
        inventoryTurnover: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // AWS Cognito Sign Out
      // await signOut();

      // Demo logout (remove when implementing Cognito)
      localStorage.removeItem("isAuthenticated");
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Force logout on error
      localStorage.removeItem("isAuthenticated");
      navigate("/login");
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
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

  // Store-specific low stock data
  const storeLowStockData = {
    all: [
      {
        name: "Organic Bananas",
        current: 15,
        minimum: 30,
        category: "Produce",
        store: "Downtown",
      },
      {
        name: "Whole Milk Gallon",
        current: 8,
        minimum: 20,
        category: "Dairy",
        store: "Mall",
      },
      {
        name: "Coca Cola 12pk",
        current: 12,
        minimum: 25,
        category: "Beverages",
        store: "Uptown",
      },
      {
        name: "Brown Bread",
        current: 6,
        minimum: 15,
        category: "Bakery",
        store: "Westside",
      },
    ],
    store_001: [
      { name: "Organic Bananas", current: 5, minimum: 10, category: "Produce" },
      { name: "Fresh Apples", current: 3, minimum: 8, category: "Produce" },
    ],
    store_002: [
      { name: "Whole Milk Gallon", current: 2, minimum: 5, category: "Dairy" },
      { name: "Potato Chips", current: 4, minimum: 10, category: "Snacks" },
      { name: "Energy Drinks", current: 3, minimum: 8, category: "Beverages" },
    ],
    store_003: [
      { name: "Greek Yogurt", current: 4, minimum: 12, category: "Dairy" },
    ],
    store_004: [
      {
        name: "Ground Beef",
        current: 2,
        minimum: 8,
        category: "Meat & Poultry",
      },
      { name: "Sandwich Bread", current: 3, minimum: 10, category: "Bakery" },
    ],
  };

  const lowStockItems = storeLowStockData[selectedStore] || [];

  // Store-specific recent transactions
  const storeTransactions = {
    all: [
      {
        id: "TXN-001",
        type: "Sale",
        product: "Lay's Potato Chips",
        quantity: 45,
        amount: 224.55,
        time: "1 hour ago",
        store: "All Stores",
      },
      {
        id: "TXN-002",
        type: "Restock",
        product: "Wonder Bread",
        quantity: 96,
        amount: 239.04,
        time: "3 hours ago",
        store: "Multiple",
      },
      {
        id: "TXN-003",
        type: "Sale",
        product: "Organic Bananas",
        quantity: 32,
        amount: 63.68,
        time: "5 hours ago",
        store: "All Stores",
      },
    ],
    store_001: [
      {
        id: "TXN-101",
        type: "Sale",
        product: "Coffee Beans",
        quantity: 5,
        amount: 49.95,
        time: "30 min ago",
      },
      {
        id: "TXN-102",
        type: "Sale",
        product: "Fresh Milk",
        quantity: 8,
        amount: 31.92,
        time: "1 hour ago",
      },
      {
        id: "TXN-103",
        type: "Restock",
        product: "Organic Bananas",
        quantity: 20,
        amount: 39.8,
        time: "3 hours ago",
      },
    ],
    store_002: [
      {
        id: "TXN-201",
        type: "Sale",
        product: "Energy Drinks",
        quantity: 12,
        amount: 35.88,
        time: "45 min ago",
      },
      {
        id: "TXN-202",
        type: "Sale",
        product: "Potato Chips",
        quantity: 6,
        amount: 17.94,
        time: "2 hours ago",
      },
      {
        id: "TXN-203",
        type: "Restock",
        product: "Yogurt Cups",
        quantity: 24,
        amount: 71.76,
        time: "4 hours ago",
      },
    ],
    store_003: [
      {
        id: "TXN-301",
        type: "Sale",
        product: "Greek Yogurt",
        quantity: 8,
        amount: 31.92,
        time: "1 hour ago",
      },
      {
        id: "TXN-302",
        type: "Sale",
        product: "Artisan Bread",
        quantity: 3,
        amount: 14.97,
        time: "2 hours ago",
      },
    ],
    store_004: [
      {
        id: "TXN-401",
        type: "Sale",
        product: "Ground Beef",
        quantity: 4,
        amount: 35.96,
        time: "20 min ago",
      },
      {
        id: "TXN-402",
        type: "Restock",
        product: "Chicken Breast",
        quantity: 15,
        amount: 89.85,
        time: "1 hour ago",
      },
      {
        id: "TXN-403",
        type: "Sale",
        product: "Sandwich Bread",
        quantity: 7,
        amount: 17.43,
        time: "3 hours ago",
      },
    ],
  };

  const recentTransactions = storeTransactions[selectedStore] || [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation onLogout={handleLogout} />

      <div className="lg:pl-64">
        <main className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome back, {user?.attributes?.given_name || "User"}!
              </h1>
              <p className="text-muted-foreground">
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

              {/* Store Selector */}
              <div className="mt-4">
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <select
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium min-w-[200px]"
                  >
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                  {selectedStore !== "all" && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
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

            <div className="flex gap-2">
              <Button onClick={() => navigate("/products")}>
                <Eye className="h-4 w-4 mr-2" />
                View Inventory
              </Button>
              <Button onClick={() => navigate("/products?action=add")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
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
                  {lowStockItems.length > 0 ? (
                    lowStockItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.category}
                            {selectedStore === "all" && item.store && (
                              <span className="ml-2 text-blue-600">
                                • {item.store} Store
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
                  {recentTransactions.map((transaction, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{transaction.product}</p>
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
                          ${transaction.amount.toFixed(2)}
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

            {/* Top Categories */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-xl">
                  Top Selling Categories
                </CardTitle>
                <CardDescription>
                  Best performing product categories this month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analyticsData?.topSellingCategories?.map(
                    (category, index) => (
                      <div
                        key={index}
                        className="p-4 bg-muted/50 rounded-lg text-center"
                      >
                        <p className="font-semibold text-lg">{category.name}</p>
                        <p className="text-2xl font-bold text-primary">
                          {category.sales}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          units sold
                        </p>
                      </div>
                    ),
                  ) || (
                    <div className="col-span-3 text-center text-muted-foreground py-8">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Analytics data will appear here</p>
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
