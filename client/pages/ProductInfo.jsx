import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
  ArrowLeft,
  Edit,
  Package,
  MapPin,
  Building,
  Calendar,
  Barcode,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

export default function ProductInfo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const isEditMode = location.pathname.includes("/edit");

  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [tempPrice, setTempPrice] = useState("");
  const [formData, setFormData] = useState({
    productName: "",
    productId: "",
    category_id: "",
    stock: "",
    price: "",
    description: "",
    minimumStock: "",
    maximumStock: "",
  });

  useEffect(() => {
    fetchProduct();
    if (isEditMode) {
      fetchCategories();
    }
  }, [id, isEditMode]);

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

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Product not found");
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setProduct(data.product);

      // Populate form data in edit mode
      if (isEditMode) {
        setFormData({
          productName: data.product.productName,
          productId: data.product.productId,
          category_id: data.product.category_id || "",
          stock: data.product.stock.toString(),
          price: data.product.price.toString(),
          description: data.product.description || "",
          minimumStock: data.product.minimumStock?.toString() || "",
          maximumStock: data.product.maximumStock?.toString() || "",
        });
      }

      setError(null);
    } catch (err) {
      console.error("Failed to fetch product:", err);
      setError(err.message);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleEdit = () => {
    navigate(`/products/${id}/edit`);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Refresh product data and exit edit mode
      await fetchProduct();
      navigate(`/products/${id}`);
    } catch (err) {
      console.error("Failed to save product:", err);
      setError("Failed to save product. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/products/${id}`);
  };

  const getStockStatusIcon = (status) => {
    switch (status) {
      case "Available":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "Low Stock":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "Out of Stock":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Package className="h-5 w-5 text-gray-600" />;
    }
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
                <p className="text-muted-foreground">Loading product...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Navigation onLogout={handleLogout} />
        <div className="lg:pl-64">
          <main className="p-6 lg:p-8">
            <div className="mb-6">
              <Button variant="ghost" onClick={() => navigate("/products")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Products
              </Button>
            </div>
            <div className="text-center py-12">
              <div className="text-red-600 mb-4">
                <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
                <p className="text-muted-foreground">{error}</p>
              </div>
              <Button onClick={() => navigate("/products")}>
                Return to Products
              </Button>
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
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/products")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Products
              </Button>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {isEditMode ? "Edit Product" : product.productName}
                  </h1>
                </div>
                <p className="text-muted-foreground">
                  Product ID: {product.productId}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {isEditMode ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              ) : (
                <Button onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Product
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Product Info */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {isEditMode ? "Edit Product" : "Product Details"}
                  </CardTitle>
                  <CardDescription>
                    {isEditMode
                      ? "Update product information"
                      : "Comprehensive information about this product"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isEditMode ? (
                    // Edit Form
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
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
                          <Label htmlFor="price">Price</Label>
                          <Input
                            id="price"
                            type="number"
                            step="0.01"
                            value={formData.price}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                price: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="stock">Stock Quantity</Label>
                          <Input
                            id="stock"
                            type="number"
                            value={formData.stock}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                stock: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="minimumStock">Minimum Stock</Label>
                          <Input
                            id="minimumStock"
                            type="number"
                            value={formData.minimumStock}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                minimumStock: e.target.value,
                              })
                            }
                            placeholder="Enter minimum stock level"
                          />
                        </div>
                        <div>
                          <Label htmlFor="maximumStock">Maximum Stock</Label>
                          <Input
                            id="maximumStock"
                            type="number"
                            value={formData.maximumStock}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                maximumStock: e.target.value,
                              })
                            }
                            placeholder="Enter maximum stock level"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="description">Description</Label>
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
                    </div>
                  ) : (
                    // View Mode Content
                    <>
                      {/* Basic Info */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Product Name
                          </label>
                          <p className="text-lg font-semibold">
                            {product.productName}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Product ID
                          </label>
                          <p className="text-lg font-mono text-blue-600">
                            {product.productId}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Category
                          </label>
                          <div className="mt-1">
                            <CategoryBadge category={product.category} />
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Price
                          </label>
                          <p className="text-lg font-semibold text-green-600">
                            ${product.price}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      {product.description && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Description
                          </label>
                          <p className="mt-1 text-base">
                            {product.description}
                          </p>
                        </div>
                      )}

                      {/* Location Info */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Store
                          </label>
                          <div className="flex items-center gap-2 mt-1">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <p className="text-base">{product.storeName}</p>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Location
                          </label>
                          <div className="flex items-center gap-2 mt-1">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <p className="text-base">
                              {product.location || "Not specified"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Additional Info */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Barcode
                          </label>
                          <div className="flex items-center gap-2 mt-1">
                            <Barcode className="h-4 w-4 text-muted-foreground" />
                            <p className="text-base font-mono">
                              {product.barcode || "Not specified"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Supplier
                          </label>
                          <p className="text-base mt-1">
                            {product.supplier || "Not specified"}
                          </p>
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Created Date
                          </label>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <p className="text-base">
                              {product.createdAt || "Not available"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Last Updated
                          </label>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <p className="text-base">{product.lastUpdated}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Inventory Status */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Inventory Status</CardTitle>
                  <CardDescription>Current stock information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStockStatusIcon(product.status)}
                      <span className="font-medium">Status</span>
                    </div>
                    <StatusBadge status={product.status} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Current Stock
                      </span>
                      <span className="text-2xl font-bold text-blue-600">
                        {product.stock}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Minimum Stock
                      </span>
                      <span className="text-sm font-medium">
                        {product.minimumStock}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Maximum Stock
                      </span>
                      <span className="text-sm font-medium">
                        {product.maximumStock || "Not set"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Unit
                      </span>
                      <span className="text-sm font-medium">
                        {product.unit}
                      </span>
                    </div>
                  </div>

                  {/* Stock Level Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>Stock Level</span>
                      <span>
                        {Math.round(
                          (product.stock / (product.maximumStock || 100)) * 100,
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          product.status === "Out of Stock"
                            ? "bg-red-500"
                            : product.status === "Low Stock"
                              ? "bg-yellow-500"
                              : "bg-green-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            (product.stock / (product.maximumStock || 100)) *
                              100,
                            100,
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              {!isEditMode && (
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button onClick={handleEdit} className="w-full">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Product
                    </Button>
                    <Button variant="outline" className="w-full">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      View Analytics
                    </Button>
                    <Button variant="outline" className="w-full">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Update Price
                    </Button>
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
