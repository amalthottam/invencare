import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
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

// API helper functions
const api = {
  async getTransactions(params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, value);
      }
    });

    const response = await fetch(`/api/transactions?${queryParams}`);
    if (!response.ok) throw new Error("Failed to fetch transactions");
    return response.json();
  },

  async getTransactionSummary(params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, value);
      }
    });

    const response = await fetch(`/api/transactions/summary?${queryParams}`);
    if (!response.ok) throw new Error("Failed to fetch transaction summary");
    return response.json();
  },

  async createTransaction(transactionData) {
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transactionData),
    });
    if (!response.ok) throw new Error("Failed to create transaction");
    return response.json();
  },

  async getStores() {
    const response = await fetch("/api/stores");
    if (!response.ok) throw new Error("Failed to fetch stores");
    return response.json();
  },

  async getProducts(storeId) {
    const queryParams = storeId ? `?storeId=${storeId}` : "";
    const response = await fetch(`/api/products${queryParams}`);
    if (!response.ok) throw new Error("Failed to fetch products");
    return response.json();
  },
};

export default function Transactions() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [selectedStore, setSelectedStore] = useState("all");
  const [stores, setStores] = useState([
    { id: "all", name: "All Stores", location: "Combined View" },
  ]);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [summaryStats, setSummaryStats] = useState({
    totalTransactions: 0,
    totalSales: 0,
    totalRestocks: 0,
    totalTransfers: 0,
  });
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

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

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load stores
      const storesResponse = await api.getStores();
      const storeData = [
        { id: "all", name: "All Stores", location: "Combined View" },
        ...(storesResponse?.data || []),
      ];
      setStores(storeData);

      // Load transactions
      await loadTransactions();
    } catch (err) {
      console.error("Failed to load initial data:", err);
      setError("Failed to load data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const params = {
        storeId: selectedStore !== "all" ? selectedStore : undefined,
        type: selectedType !== "all" ? selectedType : undefined,
        search: searchTerm || undefined,
        limit: 100,
      };

      const [transactionsResponse, summaryResponse] = await Promise.all([
        api.getTransactions(params),
        api.getTransactionSummary(params),
      ]);

      setTransactions(transactionsResponse?.data?.transactions || []);
      setSummaryStats({
        totalTransactions: summaryResponse?.data?.total_transactions || 0,
        totalSales: summaryResponse?.data?.total_sales || 0,
        totalRestocks: summaryResponse?.data?.total_restocks || 0,
        totalTransfers: summaryResponse?.data?.total_transfers || 0,
      });
    } catch (err) {
      console.error("Failed to load transactions:", err);
      setError("Failed to load transactions.");
    }
  };

  // Reload transactions when filters change
  useEffect(() => {
    if (
      transactions.length > 0 ||
      selectedStore ||
      selectedType ||
      searchTerm
    ) {
      const timeoutId = setTimeout(() => {
        loadTransactions();
      }, 300); // Debounce API calls

      return () => clearTimeout(timeoutId);
    }
  }, [selectedStore, selectedType, searchTerm]);

  // Set filtered transactions to all transactions since filtering is done server-side
  useEffect(() => {
    setFilteredTransactions(transactions);
  }, [transactions]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const transactionData = {
        type: formData.type,
        productId: formData.productId,
        productName: formData.productName,
        category: formData.category,
        quantity: parseInt(formData.quantity),
        unitPrice: parseFloat(formData.unitPrice),
        storeId: formData.storeId,
        storeName: stores.find((s) => s.id === formData.storeId)?.name || "",
        transferToStoreId: formData.transferToStoreId || null,
        transferToStoreName: formData.transferToStoreId
          ? stores.find((s) => s.id === formData.transferToStoreId)?.name
          : null,
        userId: "current_user", // In production: Extract from authentication
        userName: "Current User", // In production: Get from user session
        notes: formData.notes,
      };

      await api.createTransaction(transactionData);

      // Reset form and close modal
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

      // Reload transactions to show the new one
      await loadTransactions();
    } catch (err) {
      console.error("Failed to create transaction:", err);
      setError("Failed to create transaction. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadProductsForStore = async (storeId) => {
    if (storeId && storeId !== "all") {
      try {
        const response = await api.getProducts(storeId);
        setProducts(response?.data || []);
      } catch (err) {
        console.error("Failed to load products:", err);
        setProducts([]);
      }
    } else {
      setProducts([]);
    }
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
    try {
      if (!timestamp) return "N/A";
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "N/A";
    }
  };

  if (isLoading && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
        <Navigation onLogout={handleLogout} />
        <div className="lg:pl-64">
          <main className="p-6 lg:p-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-orange-600" />
                <p className="text-muted-foreground">Loading transactions...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mt-4">
                  {error}
                </div>
              )}

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
          </div>

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Showing {filteredTransactions?.length || 0} transactions
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
                    {filteredTransactions?.length > 0 ? (
                      filteredTransactions.map((transaction) => (
                        <tr
                          key={transaction.id}
                          className="border-b hover:bg-slate-50/50"
                        >
                          <td className="p-4">
                            <div className="font-mono text-sm text-blue-600">
                              {transaction.reference_number}
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
                                {transaction.product_name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {transaction.product_id}
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
                            {formatCurrency(transaction.total_amount)}
                          </td>
                          <td className="p-4">
                            <div>
                              <div className="text-sm font-medium">
                                {transaction.store_name}
                              </div>
                              {transaction.transfer_to_store_name && (
                                <div className="text-xs text-muted-foreground">
                                  → {transaction.transfer_to_store_name}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm">{transaction.user_name}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm">
                              {formatDateTime(transaction.created_at || transaction.timestamp)}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" className="p-8 text-center text-muted-foreground">
                          No transactions found. Try adjusting your filters or add a new transaction.
                        </td>
                      </tr>
                    )}
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
                        onChange={(e) => {
                          setFormData({ ...formData, storeId: e.target.value });
                          loadProductsForStore(e.target.value);
                        }}
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

                  {formData.storeId && products.length > 0 ? (
                    <div>
                      <Label htmlFor="productSelect">Select Product</Label>
                      <select
                        id="productSelect"
                        value={formData.productId}
                        onChange={(e) => {
                          const selectedProduct = products.find(
                            (p) => p.id === e.target.value,
                          );
                          if (selectedProduct) {
                            setFormData({
                              ...formData,
                              productId: selectedProduct.id,
                              productName: selectedProduct.name,
                              category: selectedProduct.category,
                              unitPrice: selectedProduct.unit_price || "",
                            });
                          }
                        }}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} - Stock: {product.current_stock}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
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
                  )}

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
                      disabled={formData.productId && products.length > 0}
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
                      <option value="Grains">Grains</option>
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
                        disabled={formData.productId && products.length > 0}
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
                            (s) => s.id !== "all" && s.id !== formData.storeId,
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
