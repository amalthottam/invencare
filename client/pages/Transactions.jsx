import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Receipt,
  Plus,
  Search,
  Calendar,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowRightLeft,
  Building,
  MapPin,
  X,
  Download,
  Filter,
} from "lucide-react";

// Mock store data (consistent with Dashboard)
const stores = [
  { id: "all", name: "All Stores", location: "Combined View" },
  { id: "store_001", name: "Downtown Store", location: "123 Main St" },
  { id: "store_002", name: "Mall Location", location: "456 Shopping Center" },
  { id: "store_003", name: "Uptown Branch", location: "789 North Ave" },
  { id: "store_004", name: "Westside Market", location: "321 West Blvd" },
];

// Comprehensive Sample Transaction Data for Multi-Store Inventory System
const mockTransactions = [
  // Recent Sales - January 15, 2024
  {
    id: "TXN-2024-001",
    type: "Sale",
    productName: "Organic Bananas",
    productId: "FV-BAN-001",
    category: "Fruits & Vegetables",
    quantity: 15,
    unitPrice: 1.99,
    totalAmount: 29.85,
    storeId: "store_001",
    storeName: "Downtown Store",
    userId: "emp_001",
    userName: "John Smith",
    timestamp: "2024-01-15T14:30:00Z",
    referenceNumber: "SALE-2024-001",
    notes: "Regular customer purchase",
  },
  {
    id: "TXN-2024-002",
    type: "Sale",
    productName: "Whole Milk",
    productId: "DA-MLK-003",
    category: "Dairy",
    quantity: 4,
    unitPrice: 3.79,
    totalAmount: 15.16,
    storeId: "store_001",
    storeName: "Downtown Store",
    userId: "emp_001",
    userName: "John Smith",
    timestamp: "2024-01-15T14:32:00Z",
    referenceNumber: "SALE-2024-002",
    notes: "Family weekly shopping",
  },
  {
    id: "TXN-2024-003",
    type: "Sale",
    productName: "Chicken Breast",
    productId: "MP-CHI-008",
    category: "Meat & Poultry",
    quantity: 2,
    unitPrice: 12.99,
    totalAmount: 25.98,
    storeId: "store_002",
    storeName: "Mall Location",
    userId: "emp_002",
    userName: "Sarah Johnson",
    timestamp: "2024-01-15T15:45:00Z",
    referenceNumber: "SALE-2024-003",
    notes: "Premium meat selection",
  },
  {
    id: "TXN-2024-004",
    type: "Sale",
    productName: "Energy Drinks",
    productId: "BV-ENE-015",
    category: "Beverages",
    quantity: 6,
    unitPrice: 2.99,
    totalAmount: 17.94,
    storeId: "store_004",
    storeName: "Westside Market",
    userId: "emp_004",
    userName: "Tom Brown",
    timestamp: "2024-01-15T13:10:00Z",
    referenceNumber: "SALE-2024-004",
    notes: "Bulk purchase discount applied",
  },
  {
    id: "TXN-2024-005",
    type: "Sale",
    productName: "Potato Chips",
    productId: "SN-CHI-012",
    category: "Snacks",
    quantity: 8,
    unitPrice: 3.99,
    totalAmount: 31.92,
    storeId: "store_003",
    storeName: "Uptown Branch",
    userId: "emp_003",
    userName: "Emma Wilson",
    timestamp: "2024-01-15T16:20:00Z",
    referenceNumber: "SALE-2024-005",
    notes: "Party supplies purchase",
  },

  // Restocks - January 15, 2024
  {
    id: "TXN-2024-006",
    type: "Restock",
    productName: "Organic Bananas",
    productId: "FV-BAN-001",
    category: "Fruits & Vegetables",
    quantity: 50,
    unitPrice: 1.2,
    totalAmount: 60.0,
    storeId: "store_001",
    storeName: "Downtown Store",
    userId: "mgr_001",
    userName: "Lisa Davis",
    timestamp: "2024-01-15T08:00:00Z",
    referenceNumber: "RST-2024-006",
    notes: "Weekly delivery from Fresh Farm Co",
  },
  {
    id: "TXN-2024-007",
    type: "Restock",
    productName: "Whole Milk",
    productId: "DA-MLK-003",
    category: "Dairy",
    quantity: 48,
    unitPrice: 2.8,
    totalAmount: 134.4,
    storeId: "store_001",
    storeName: "Downtown Store",
    userId: "mgr_001",
    userName: "Lisa Davis",
    timestamp: "2024-01-15T08:30:00Z",
    referenceNumber: "RST-2024-007",
    notes: "Dairy delivery from Pure Dairy Ltd",
  },
  {
    id: "TXN-2024-008",
    type: "Restock",
    productName: "Ground Coffee",
    productId: "BV-COF-009",
    category: "Beverages",
    quantity: 24,
    unitPrice: 6.5,
    totalAmount: 156.0,
    storeId: "store_002",
    storeName: "Mall Location",
    userId: "mgr_002",
    userName: "Mike Wilson",
    timestamp: "2024-01-15T09:15:00Z",
    referenceNumber: "RST-2024-008",
    notes: "Premium coffee restock",
  },
  {
    id: "TXN-2024-009",
    type: "Restock",
    productName: "Energy Drinks",
    productId: "BV-ENE-015",
    category: "Beverages",
    quantity: 72,
    unitPrice: 1.8,
    totalAmount: 129.6,
    storeId: "store_004",
    storeName: "Westside Market",
    userId: "mgr_004",
    userName: "David Chen",
    timestamp: "2024-01-15T10:00:00Z",
    referenceNumber: "RST-2024-009",
    notes: "High demand product restock",
  },

  // Transfers - January 15, 2024
  {
    id: "TXN-2024-010",
    type: "Transfer",
    productName: "Cheddar Cheese",
    productId: "DA-CHE-004",
    category: "Dairy",
    quantity: 12,
    unitPrice: 5.99,
    totalAmount: 71.88,
    storeId: "store_002",
    storeName: "Mall Location",
    transferToStoreId: "store_001",
    transferToStoreName: "Downtown Store",
    userId: "mgr_002",
    userName: "Mike Wilson",
    timestamp: "2024-01-15T11:20:00Z",
    referenceNumber: "TRF-2024-010",
    notes: "Low stock transfer to high-demand location",
  },
  {
    id: "TXN-2024-011",
    type: "Transfer",
    productName: "Orange Juice",
    productId: "BV-JUI-011",
    category: "Beverages",
    quantity: 15,
    unitPrice: 4.49,
    totalAmount: 67.35,
    storeId: "store_003",
    storeName: "Uptown Branch",
    transferToStoreId: "store_004",
    transferToStoreName: "Westside Market",
    userId: "mgr_003",
    userName: "Anna Garcia",
    timestamp: "2024-01-15T12:00:00Z",
    referenceNumber: "TRF-2024-011",
    notes: "Excess inventory redistribution",
  },

  // Adjustments - January 14-15, 2024
  {
    id: "TXN-2024-012",
    type: "Adjustment",
    productName: "Fresh Salmon",
    productId: "SF-SAL-010",
    category: "Seafood",
    quantity: -3,
    unitPrice: 18.99,
    totalAmount: -56.97,
    storeId: "store_003",
    storeName: "Uptown Branch",
    userId: "mgr_003",
    userName: "Anna Garcia",
    timestamp: "2024-01-14T18:00:00Z",
    referenceNumber: "ADJ-2024-012",
    notes: "Expired seafood disposal",
  },
  {
    id: "TXN-2024-013",
    type: "Adjustment",
    productName: "Croissants",
    productId: "BK-CRO-013",
    category: "Bakery",
    quantity: -2,
    unitPrice: 1.99,
    totalAmount: -3.98,
    storeId: "store_003",
    storeName: "Uptown Branch",
    userId: "emp_003",
    userName: "Emma Wilson",
    timestamp: "2024-01-14T19:30:00Z",
    referenceNumber: "ADJ-2024-013",
    notes: "Day-old bakery items removed",
  },
  {
    id: "TXN-2024-014",
    type: "Adjustment",
    productName: "Mixed Nuts",
    productId: "SN-NUT-017",
    category: "Snacks",
    quantity: -1,
    unitPrice: 7.99,
    totalAmount: -7.99,
    storeId: "store_004",
    storeName: "Westside Market",
    userId: "emp_004",
    userName: "Tom Brown",
    timestamp: "2024-01-14T17:15:00Z",
    referenceNumber: "ADJ-2024-014",
    notes: "Damaged packaging - customer return",
  },

  // Additional Sales from Previous Days
  {
    id: "TXN-2024-015",
    type: "Sale",
    productName: "Red Apples",
    productId: "FV-APP-002",
    category: "Fruits & Vegetables",
    quantity: 10,
    unitPrice: 2.49,
    totalAmount: 24.9,
    storeId: "store_001",
    storeName: "Downtown Store",
    userId: "emp_001",
    userName: "John Smith",
    timestamp: "2024-01-14T16:45:00Z",
    referenceNumber: "SALE-2024-015",
    notes: "Healthy fruit selection",
  },
  {
    id: "TXN-2024-016",
    type: "Sale",
    productName: "Greek Yogurt",
    productId: "DA-YOG-007",
    category: "Dairy",
    quantity: 3,
    unitPrice: 4.99,
    totalAmount: 14.97,
    storeId: "store_002",
    storeName: "Mall Location",
    userId: "emp_002",
    userName: "Sarah Johnson",
    timestamp: "2024-01-14T14:20:00Z",
    referenceNumber: "SALE-2024-016",
    notes: "Health-conscious customer",
  },
  {
    id: "TXN-2024-017",
    type: "Sale",
    productName: "Beef Steak",
    productId: "MP-STE-014",
    category: "Meat & Poultry",
    quantity: 1.5,
    unitPrice: 24.99,
    totalAmount: 37.49,
    storeId: "store_004",
    storeName: "Westside Market",
    userId: "emp_004",
    userName: "Tom Brown",
    timestamp: "2024-01-14T17:30:00Z",
    referenceNumber: "SALE-2024-017",
    notes: "Premium cut for dinner",
  },
  {
    id: "TXN-2024-018",
    type: "Sale",
    productName: "Ice Cream",
    productId: "DA-ICE-016",
    category: "Dairy",
    quantity: 2,
    unitPrice: 6.99,
    totalAmount: 13.98,
    storeId: "store_004",
    storeName: "Westside Market",
    userId: "emp_004",
    userName: "Tom Brown",
    timestamp: "2024-01-14T15:00:00Z",
    referenceNumber: "SALE-2024-018",
    notes: "Family dessert purchase",
  },

  // More Restocks from Previous Week
  {
    id: "TXN-2024-019",
    type: "Restock",
    productName: "Potato Chips",
    productId: "SN-CHI-012",
    category: "Snacks",
    quantity: 100,
    unitPrice: 2.5,
    totalAmount: 250.0,
    storeId: "store_003",
    storeName: "Uptown Branch",
    userId: "mgr_003",
    userName: "Anna Garcia",
    timestamp: "2024-01-13T09:00:00Z",
    referenceNumber: "RST-2024-019",
    notes: "Large shipment from Snack Masters",
  },
  {
    id: "TXN-2024-020",
    type: "Restock",
    productName: "Pasta",
    productId: "GR-PAS-018",
    category: "Grains",
    quantity: 60,
    unitPrice: 1.2,
    totalAmount: 72.0,
    storeId: "store_004",
    storeName: "Westside Market",
    userId: "mgr_004",
    userName: "David Chen",
    timestamp: "2024-01-13T10:30:00Z",
    referenceNumber: "RST-2024-020",
    notes: "Italian Foods weekly delivery",
  },
];

export default function Transactions() {
  const navigate = useNavigate();
  const [selectedStore, setSelectedStore] = useState("all");
  const [transactions, setTransactions] = useState(mockTransactions);
  const [filteredTransactions, setFilteredTransactions] =
    useState(mockTransactions);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedDateRange, setSelectedDateRange] = useState("today");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // AWS Cognito Authentication & Store Access Control
  // Upon component mount, verify user authentication via Cognito JWT token
  // Extract user attributes: sub (user ID), custom:role, custom:store_access
  // Validate user's permission to view transactions for selected store(s)
  // Store managers can only view transactions for their assigned stores
  // Admin users have access to all stores and cross-store analytics

  // AWS Lambda Analytics Integration
  // Real-time transaction analytics powered by Lambda functions:
  // - Lambda function: 'invencare-transaction-analytics'
  // - Processes transaction data from RDS 'inventory_transactions' table
  // - Calculates store-specific metrics: sales volume, restock frequency, transfer patterns
  // - Generates automated alerts for unusual transaction patterns
  // - Cross-store comparison analytics for multi-location insights

  const [formData, setFormData] = useState({
    type: "",
    productName: "",
    productId: "",
    category: "",
    quantity: "",
    unitPrice: "",
    storeId: "",
    transferToStoreId: "",
    notes: "",
  });

  useEffect(() => {
    // Check authentication
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
  }, [navigate]);

  // Filter transactions based on store, search, type, and date
  useEffect(() => {
    let filtered = transactions;

    // Filter by store
    if (selectedStore !== "all") {
      filtered = filtered.filter((txn) => txn.storeId === selectedStore);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (txn) =>
          txn.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          txn.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          txn.referenceNumber
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          txn.userName.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by transaction type
    if (selectedType !== "all") {
      filtered = filtered.filter((txn) => txn.type === selectedType);
    }

    // Filter by date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    filtered = filtered.filter((txn) => {
      const txnDate = new Date(txn.timestamp);

      switch (selectedDateRange) {
        case "today":
          return txnDate >= today;
        case "week":
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return txnDate >= weekAgo;
        case "month":
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          return txnDate >= monthAgo;
        default:
          return true;
      }
    });

    setFilteredTransactions(filtered);
  }, [
    transactions,
    selectedStore,
    searchTerm,
    selectedType,
    selectedDateRange,
  ]);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  const handleAddTransaction = (e) => {
    e.preventDefault();
    setIsLoading(true);

    // AWS Cognito User Validation
    // Verify user has permission to create transactions for selected store
    // Extract userId from Cognito JWT token stored in localStorage
    // Validate user role permissions:
    // - Employees: Can only create transactions for their assigned store
    // - Managers: Can create transactions for stores they manage
    // - Admins: Can create transactions for any store

    // AWS Lambda Transaction Processing
    // Invoke Lambda function: 'invencare-transaction-processor'
    // Lambda will:
    // 1. Validate transaction data and business rules
    // 2. Update RDS inventory_transactions table
    // 3. Update product quantities in RDS products table
    // 4. Handle store-to-store transfers (update both stores)
    // 5. Trigger automatic reorder alerts if stock falls below minimum
    // 6. Send real-time notifications via SNS for critical stock levels

    const newTransaction = {
      id: `TXN-2024-${Date.now()}`,
      type: formData.type,
      productName: formData.productName,
      productId: formData.productId,
      category: formData.category,
      quantity: parseInt(formData.quantity),
      unitPrice: parseFloat(formData.unitPrice),
      totalAmount: parseInt(formData.quantity) * parseFloat(formData.unitPrice),
      storeId: formData.storeId,
      storeName: stores.find((s) => s.id === formData.storeId)?.name || "",
      transferToStoreId: formData.transferToStoreId || null,
      transferToStoreName: formData.transferToStoreId
        ? stores.find((s) => s.id === formData.transferToStoreId)?.name
        : null,
      userId: "current_user", // In production: Extract from Cognito JWT
      userName: "Current User", // In production: Get from Cognito user attributes
      timestamp: new Date().toISOString(),
      referenceNumber: `${formData.type.toUpperCase().substring(0, 3)}-2024-${Date.now()}`,
      notes: formData.notes,
    };

    // In production, replace setTimeout with actual Lambda invocation:
    // await invoke('invencare-transaction-processor', { transaction: newTransaction })
    setTimeout(() => {
      setTransactions([newTransaction, ...transactions]);
      setFormData({
        type: "",
        productName: "",
        productId: "",
        category: "",
        quantity: "",
        unitPrice: "",
        storeId: "",
        transferToStoreId: "",
        notes: "",
      });
      setIsAddModalOpen(false);
      setIsLoading(false);
    }, 1000);
  };

  const getTransactionTypeIcon = (type) => {
    switch (type) {
      case "Sale":
        return <TrendingDown className="h-4 w-4 text-green-600" />;
      case "Restock":
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case "Adjustment":
        return <RefreshCw className="h-4 w-4 text-orange-600" />;
      case "Transfer":
        return <ArrowRightLeft className="h-4 w-4 text-purple-600" />;
      default:
        return <Receipt className="h-4 w-4" />;
    }
  };

  const getTransactionTypeBadge = (type) => {
    const variants = {
      Sale: "default",
      Restock: "secondary",
      Adjustment: "secondary",
      Transfer: "outline",
    };
    return <Badge variant={variants[type]}>{type}</Badge>;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDateTime = (timestamp) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate summary stats
  const summaryStats = {
    totalTransactions: filteredTransactions.length,
    totalSales: filteredTransactions
      .filter((txn) => txn.type === "Sale")
      .reduce((sum, txn) => sum + txn.totalAmount, 0),
    totalRestocks: filteredTransactions.filter((txn) => txn.type === "Restock")
      .length,
    totalTransfers: filteredTransactions.filter(
      (txn) => txn.type === "Transfer",
    ).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      <Navigation onLogout={handleLogout} />

      <div className="lg:pl-64">
        <main className="p-6 lg:p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  Transaction History
                </h1>
              </div>
              <p className="text-muted-foreground">
                Track all inventory movements and sales across your stores
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
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
              <CardContent className="p-6">
                <div className="text-2xl font-bold">
                  {summaryStats.totalTransactions}
                </div>
                <div className="text-green-100">Total Transactions</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0">
              <CardContent className="p-6">
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryStats.totalSales)}
                </div>
                <div className="text-blue-100">Total Sales</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0">
              <CardContent className="p-6">
                <div className="text-2xl font-bold">
                  {summaryStats.totalRestocks}
                </div>
                <div className="text-purple-100">Restocks</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
              <CardContent className="p-6">
                <div className="text-2xl font-bold">
                  {summaryStats.totalTransfers}
                </div>
                <div className="text-orange-100">Transfers</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search transactions, products, or reference numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Types</option>
              <option value="Sale">Sales</option>
              <option value="Restock">Restocks</option>
              <option value="Adjustment">Adjustments</option>
              <option value="Transfer">Transfers</option>
            </select>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Showing {filteredTransactions.length} transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">Reference</th>
                      <th className="text-left p-4 font-semibold">Type</th>
                      <th className="text-left p-4 font-semibold">Product</th>
                      <th className="text-left p-4 font-semibold">Category</th>
                      <th className="text-left p-4 font-semibold">Quantity</th>
                      <th className="text-left p-4 font-semibold">Amount</th>
                      <th className="text-left p-4 font-semibold">Store</th>
                      <th className="text-left p-4 font-semibold">User</th>
                      <th className="text-left p-4 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="border-b hover:bg-slate-50/50"
                      >
                        <td className="p-4">
                          <div className="font-mono text-sm text-blue-600">
                            {transaction.referenceNumber}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {getTransactionTypeIcon(transaction.type)}
                            {getTransactionTypeBadge(transaction.type)}
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <div className="font-medium">
                              {transaction.productName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {transaction.productId}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <CategoryBadge category={transaction.category} />
                        </td>
                        <td className="p-4">
                          <span
                            className={`font-semibold ${
                              transaction.quantity > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {transaction.quantity > 0 ? "+" : ""}
                            {transaction.quantity}
                          </span>
                        </td>
                        <td className="p-4 font-semibold">
                          {formatCurrency(transaction.totalAmount)}
                        </td>
                        <td className="p-4">
                          <div>
                            <div className="text-sm font-medium">
                              {transaction.storeName}
                            </div>
                            {transaction.transferToStoreName && (
                              <div className="text-xs text-muted-foreground">
                                → {transaction.transferToStoreName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">{transaction.userName}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            {formatDateTime(transaction.timestamp)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Add Transaction Modal */}
          {isAddModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Add New Transaction</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <form onSubmit={handleAddTransaction} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="type">Transaction Type</Label>
                      <select
                        id="type"
                        value={formData.type}
                        onChange={(e) =>
                          setFormData({ ...formData, type: e.target.value })
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Select type</option>
                        <option value="Sale">Sale</option>
                        <option value="Restock">Restock</option>
                        <option value="Adjustment">Adjustment</option>
                        <option value="Transfer">Transfer</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="storeId">Store</Label>
                      <select
                        id="storeId"
                        value={formData.storeId}
                        onChange={(e) =>
                          setFormData({ ...formData, storeId: e.target.value })
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Select store</option>
                        {stores
                          .filter((s) => s.id !== "all")
                          .map((store) => (
                            <option key={store.id} value={store.id}>
                              {store.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="productName">Product Name</Label>
                      <Input
                        id="productName"
                        value={formData.productName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            productName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="productId">Product ID</Label>
                      <Input
                        id="productId"
                        value={formData.productId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            productId: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="category">Category</Label>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select category</option>
                      <option value="Fruits & Vegetables">
                        Fruits & Vegetables
                      </option>
                      <option value="Dairy">Dairy</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Meat & Poultry">Meat & Poultry</option>
                      <option value="Seafood">Seafood</option>
                      <option value="Beverages">Beverages</option>
                      <option value="Snacks">Snacks</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData({ ...formData, quantity: e.target.value })
                        }
                        placeholder="Use negative for adjustments"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="unitPrice">Unit Price</Label>
                      <Input
                        id="unitPrice"
                        type="number"
                        step="0.01"
                        value={formData.unitPrice}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            unitPrice: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  {formData.type === "Transfer" && (
                    <div>
                      <Label htmlFor="transferToStoreId">
                        Transfer To Store
                      </Label>
                      <select
                        id="transferToStoreId"
                        value={formData.transferToStoreId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            transferToStoreId: e.target.value,
                          })
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required={formData.type === "Transfer"}
                      >
                        <option value="">Select destination store</option>
                        {stores
                          .filter(
                            // (s) => s.id !== "all" && s.id !== formData.storeId,
                            (s) => 1==1,
                          )
                          .map((store) => (
                            <option key={store.id} value={store.id}>
                              {store.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder="Optional notes about this transaction"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddModalOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isLoading}
                    >
                      {isLoading ? "Adding..." : "Add Transaction"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
