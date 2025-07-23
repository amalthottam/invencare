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
  ShoppingCart,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  X,
} from "lucide-react";

export default function Products() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    productName: "",
    productId: "",
    category_id: "",
    storeName: "",
    stock: "",
    unit: "",
    description: "",
  });

  useEffect(() => {
    // Wait for auth loading to complete
    if (authLoading) return;

    // Check authentication
    if (!isAuthenticated) {
      console.log("User not authenticated, redirecting to login");
      navigate("/login");
      return;
    }

    console.log("User authenticated:", user?.username);

    // Fetch products, categories, and stores from API
    fetchProducts();
    fetchCategories();
    fetchStores();
  }, [navigate, isAuthenticated, authLoading, user]);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await fetch("/api/stores");
      if (response.ok) {
        const data = await response.json();
        setStores(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch stores:", err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/products");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setAllProducts(data.products || []);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      setError("Failed to load products. Please try again.");
      // Fallback to empty array if API fails
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  useEffect(() => {
    const filtered = allProducts.filter((product) => {
      const matchesSearch =
        product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.storeName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;
      const matchesStore =
        storeFilter === "all" || product.storeName === storeFilter;
      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStore && matchesStatus;
    });
    setFilteredProducts(filtered);
  }, [searchTerm, categoryFilter, storeFilter, statusFilter, allProducts]);

  const productCategories = [...new Set(allProducts.map((p) => p.category))];

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Refresh products list
      await fetchProducts();

      setFormData({
        productName: "",
        productId: "",
        category_id: "",
        storeName: "",
        stock: "",
        unit: "",
        description: "",
      });
      setIsAddModalOpen(false);
    } catch (err) {
      console.error("Failed to add product:", err);
      setError("Failed to add product. Please try again.");
    }
  };

  const handleDeleteProduct = (product) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;

    try {
      const response = await fetch(`/api/products/${productToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Refresh products list
      await fetchProducts();
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
    } catch (err) {
      console.error("Failed to delete product:", err);
      setError("Failed to delete product. Please try again.");
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmOpen(false);
    setProductToDelete(null);
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
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
                <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Grocery Products
                </h1>
              </div>
              <p className="text-muted-foreground">
                Manage your supermarket inventory and track stock levels
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate("/dashboard")}>
                <Eye className="h-4 w-4 mr-2" />
                View Dashboard
              </Button>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
              <Button
                onClick={fetchProducts}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading products...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <Card
                  className={`bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 cursor-pointer transition-transform hover:scale-105 ${statusFilter === "Available" ? "ring-4 ring-white" : ""}`}
                  onClick={() =>
                    setStatusFilter(
                      statusFilter === "Available" ? "all" : "Available",
                    )
                  }
                >
                  <CardContent className="p-6">
                    <div className="text-2xl font-bold">
                      {
                        allProducts.filter((p) => p.status === "Available")
                          .length
                      }
                    </div>
                    <div className="text-green-100">Available Products</div>
                  </CardContent>
                </Card>
                <Card
                  className={`bg-gradient-to-r from-yellow-500 to-orange-600 text-white border-0 cursor-pointer transition-transform hover:scale-105 ${statusFilter === "Low Stock" ? "ring-4 ring-white" : ""}`}
                  onClick={() =>
                    setStatusFilter(
                      statusFilter === "Low Stock" ? "all" : "Low Stock",
                    )
                  }
                >
                  <CardContent className="p-6">
                    <div className="text-2xl font-bold">
                      {
                        allProducts.filter((p) => p.status === "Low Stock")
                          .length
                      }
                    </div>
                    <div className="text-yellow-100">Low Stock Items</div>
                  </CardContent>
                </Card>
                <Card
                  className={`bg-gradient-to-r from-red-500 to-pink-600 text-white border-0 cursor-pointer transition-transform hover:scale-105 ${statusFilter === "Out of Stock" ? "ring-4 ring-white" : ""}`}
                  onClick={() =>
                    setStatusFilter(
                      statusFilter === "Out of Stock" ? "all" : "Out of Stock",
                    )
                  }
                >
                  <CardContent className="p-6">
                    <div className="text-2xl font-bold">
                      {
                        allProducts.filter((p) => p.status === "Out of Stock")
                          .length
                      }
                    </div>
                    <div className="text-red-100">Out of Stock</div>
                  </CardContent>
                </Card>
                <Card
                  className={`bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 cursor-pointer transition-transform hover:scale-105 ${statusFilter === "all" ? "ring-4 ring-white" : ""}`}
                  onClick={() => setStatusFilter("all")}
                >
                  <CardContent className="p-6">
                    <div className="text-2xl font-bold">
                      {allProducts.length}
                    </div>
                    <div className="text-blue-100">Total Products</div>
                  </CardContent>
                </Card>
              </div>

              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search products, store names, or IDs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Categories</option>
                    {productCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <select
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Stores</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.name}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="Available">Available</option>
                    <option value="Low Stock">Low Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                  </select>
                  {(statusFilter !== "all" ||
                    storeFilter !== "all" ||
                    categoryFilter !== "all") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStatusFilter("all");
                        setStoreFilter("all");
                        setCategoryFilter("all");
                        setSearchTerm("");
                      }}
                      className="h-10"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Products Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Products Inventory</CardTitle>
                  <CardDescription>
                    Complete list of products in your inventory
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-4 font-semibold">
                            Product Name
                          </th>
                          <th className="text-left p-4 font-semibold">
                            Product ID
                          </th>
                          <th className="text-left p-4 font-semibold">
                            Category
                          </th>
                          <th className="text-left p-4 font-semibold">
                            Store Name
                          </th>
                          <th className="text-left p-4 font-semibold">Stock</th>
                          <th className="text-left p-4 font-semibold">Unit</th>
                          <th className="text-left p-4 font-semibold">
                            Status
                          </th>
                          <th className="text-left p-4 font-semibold">
                            Last Updated
                          </th>
                          <th className="text-left p-4 font-semibold">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((product) => (
                          <tr
                            key={product.id}
                            className="border-b hover:bg-slate-50/50"
                          >
                            <td className="p-4 font-medium">
                              <button
                                onClick={() =>
                                  navigate(`/products/${product.id}`)
                                }
                                className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                              >
                                {product.productName}
                              </button>
                            </td>
                            <td className="p-4 font-mono text-sm text-blue-600">
                              {product.productId}
                            </td>
                            <td className="p-4">
                              <CategoryBadge category={product.category} />
                            </td>
                            <td className="p-4">{product.storeName}</td>
                            <td className="p-4 font-semibold">
                              {product.stock}
                            </td>
                            <td className="p-4">{product.unit}</td>
                            <td className="p-4">
                              <StatusBadge status={product.status} />
                            </td>
                            <td className="p-4">{product.lastUpdated}</td>
                            <td className="p-4">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    navigate(`/products/${product.id}`)
                                  }
                                  className="text-blue-600 hover:text-blue-700"
                                  title="View Product Info"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    navigate(`/products/${product.id}/edit`)
                                  }
                                  className="text-green-600 hover:text-green-700"
                                  title="Edit Product"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteProduct(product)}
                                  className="text-red-600 hover:text-red-700"
                                  title="Delete Product"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Delete Confirmation Modal */}
          {deleteConfirmOpen && productToDelete && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      Delete Product
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      This action cannot be undone
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-gray-700">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-gray-900">
                      {productToDelete.productName}
                    </span>
                    ? This will permanently remove the product from your
                    inventory.
                  </p>
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Product ID:</span>{" "}
                      {productToDelete.productId}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Current Stock:</span>{" "}
                      {productToDelete.stock} {productToDelete.unit}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={cancelDelete}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmDelete}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Product
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Add Product Modal */}
          {isAddModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Add New Product</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <form onSubmit={handleAddProduct} className="space-y-4">
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
                        setFormData({ ...formData, productId: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Category</Label>
                    <select
                      id="category"
                      value={formData.category_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category_id: e.target.value,
                        })
                      }
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="storeName">Store Name</Label>
                    <select
                      id="storeName"
                      value={formData.storeName}
                      onChange={(e) =>
                        setFormData({ ...formData, storeName: e.target.value })
                      }
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select store</option>
                      <option value="Downtown Store">Downtown Store</option>
                      <option value="Mall Location">Mall Location</option>
                      <option value="Uptown Branch">Uptown Branch</option>
                      <option value="Westside Market">Westside Market</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Enter product description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="stock">Stock</Label>
                      <Input
                        id="stock"
                        type="number"
                        value={formData.stock}
                        onChange={(e) =>
                          setFormData({ ...formData, stock: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="unit">Unit</Label>
                      <select
                        id="unit"
                        value={formData.unit}
                        onChange={(e) =>
                          setFormData({ ...formData, unit: e.target.value })
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Select unit</option>
                        <option value="kg">kg</option>
                        <option value="liter">liter</option>
                        <option value="piece">piece</option>
                        <option value="pack">pack</option>
                        <option value="bottle">bottle</option>
                        <option value="can">can</option>
                        <option value="box">box</option>
                        <option value="loaf">loaf</option>
                      </select>
                    </div>
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
                    <Button type="submit" className="flex-1">
                      Add Product
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
