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

// Comprehensive Sample Product Data for Multi-Store Inventory System
const products = [
  // Downtown Store Products
  {
    id: "1",
    productName: "Organic Bananas",
    productId: "FV-BAN-001",
    category: "Fruits & Vegetables",
    stock: 120,
    price: 1.99,
    storeName: "Downtown Store",
    storeId: "store_001",
    unit: "kg",
    status: "Available",
    minimumStock: 20,
    supplier: "Fresh Farm Co",
    lastUpdated: "2024-01-15",
    barcode: "123456789012",
    location: "Aisle 1-A",
  },
  {
    id: "2",
    productName: "Red Apples",
    productId: "FV-APP-002",
    category: "Fruits & Vegetables",
    stock: 85,
    price: 2.49,
    storeName: "Downtown Store",
    storeId: "store_001",
    unit: "kg",
    status: "Available",
    minimumStock: 15,
    supplier: "Fresh Farm Co",
    lastUpdated: "2024-01-15",
    barcode: "123456789013",
    location: "Aisle 1-A",
  },
  {
    id: "3",
    productName: "Whole Milk",
    productId: "DA-MLK-003",
    category: "Dairy",
    stock: 42,
    price: 3.79,
    storeName: "Downtown Store",
    storeId: "store_001",
    unit: "liter",
    status: "Available",
    minimumStock: 10,
    supplier: "Pure Dairy Ltd",
    lastUpdated: "2024-01-15",
    barcode: "123456789014",
    location: "Aisle 3-B",
  },
  {
    id: "4",
    productName: "Cheddar Cheese",
    productId: "DA-CHE-004",
    category: "Dairy",
    stock: 7,
    price: 5.99,
    storeName: "Downtown Store",
    storeId: "store_001",
    unit: "pack",
    status: "Low Stock",
    minimumStock: 8,
    supplier: "Pure Dairy Ltd",
    lastUpdated: "2024-01-14",
    barcode: "123456789015",
    location: "Aisle 3-B",
  },
  {
    id: "5",
    productName: "Brown Bread",
    productId: "BK-BRD-005",
    category: "Bakery",
    stock: 24,
    price: 2.49,
    storeName: "Downtown Store",
    storeId: "store_001",
    unit: "loaf",
    status: "Available",
    minimumStock: 5,
    supplier: "City Bakery",
    lastUpdated: "2024-01-15",
    barcode: "123456789016",
    location: "Aisle 2-C",
  },

  // Mall Location Products
  {
    id: "6",
    productName: "Organic Carrots",
    productId: "FV-CAR-006",
    category: "Fruits & Vegetables",
    stock: 65,
    price: 1.89,
    storeName: "Mall Location",
    storeId: "store_002",
    unit: "kg",
    status: "Available",
    minimumStock: 20,
    supplier: "Fresh Farm Co",
    lastUpdated: "2024-01-15",
    barcode: "123456789017",
    location: "Aisle 1-A",
  },
  {
    id: "7",
    productName: "Greek Yogurt",
    productId: "DA-YOG-007",
    category: "Dairy",
    stock: 8,
    price: 4.99,
    storeName: "Mall Location",
    storeId: "store_002",
    unit: "pack",
    status: "Low Stock",
    minimumStock: 10,
    supplier: "Pure Dairy Ltd",
    lastUpdated: "2024-01-14",
    barcode: "123456789018",
    location: "Aisle 3-B",
  },
  {
    id: "8",
    productName: "Chicken Breast",
    productId: "MP-CHI-008",
    category: "Meat & Poultry",
    stock: 15,
    price: 12.99,
    storeName: "Mall Location",
    storeId: "store_002",
    unit: "kg",
    status: "Available",
    minimumStock: 5,
    supplier: "Premium Meats",
    lastUpdated: "2024-01-15",
    barcode: "123456789019",
    location: "Aisle 4-D",
  },
  {
    id: "9",
    productName: "Ground Coffee",
    productId: "BV-COF-009",
    category: "Beverages",
    stock: 32,
    price: 8.99,
    storeName: "Mall Location",
    storeId: "store_002",
    unit: "pack",
    status: "Available",
    minimumStock: 8,
    supplier: "Coffee Roasters Inc",
    lastUpdated: "2024-01-15",
    barcode: "123456789020",
    location: "Aisle 5-E",
  },

  // Uptown Branch Products
  {
    id: "10",
    productName: "Fresh Salmon",
    productId: "SF-SAL-010",
    category: "Seafood",
    stock: 0,
    price: 18.99,
    storeName: "Uptown Branch",
    storeId: "store_003",
    unit: "kg",
    status: "Out of Stock",
    minimumStock: 3,
    supplier: "Ocean Fresh Co",
    lastUpdated: "2024-01-13",
    barcode: "123456789021",
    location: "Aisle 4-F",
  },
  {
    id: "11",
    productName: "Orange Juice",
    productId: "BV-JUI-011",
    category: "Beverages",
    stock: 28,
    price: 4.49,
    storeName: "Uptown Branch",
    storeId: "store_003",
    unit: "liter",
    status: "Available",
    minimumStock: 12,
    supplier: "Fresh Juice Co",
    lastUpdated: "2024-01-15",
    barcode: "123456789022",
    location: "Aisle 5-E",
  },
  {
    id: "12",
    productName: "Potato Chips",
    productId: "SN-CHI-012",
    category: "Snacks",
    stock: 156,
    price: 3.99,
    storeName: "Uptown Branch",
    storeId: "store_003",
    unit: "bag",
    status: "Available",
    minimumStock: 25,
    supplier: "Snack Masters",
    lastUpdated: "2024-01-15",
    barcode: "123456789023",
    location: "Aisle 6-G",
  },
  {
    id: "13",
    productName: "Croissants",
    productId: "BK-CRO-013",
    category: "Bakery",
    stock: 5,
    price: 1.99,
    storeName: "Uptown Branch",
    storeId: "store_003",
    unit: "piece",
    status: "Low Stock",
    minimumStock: 10,
    supplier: "French Bakery",
    lastUpdated: "2024-01-14",
    barcode: "123456789024",
    location: "Aisle 2-C",
  },

  // Westside Market Products
  {
    id: "14",
    productName: "Beef Steak",
    productId: "MP-STE-014",
    category: "Meat & Poultry",
    stock: 12,
    price: 24.99,
    storeName: "Westside Market",
    storeId: "store_004",
    unit: "kg",
    status: "Available",
    minimumStock: 3,
    supplier: "Premium Meats",
    lastUpdated: "2024-01-15",
    barcode: "123456789025",
    location: "Aisle 4-D",
  },
  {
    id: "15",
    productName: "Energy Drinks",
    productId: "BV-ENE-015",
    category: "Beverages",
    stock: 48,
    price: 2.99,
    storeName: "Westside Market",
    storeId: "store_004",
    unit: "can",
    status: "Available",
    minimumStock: 20,
    supplier: "Energy Corp",
    lastUpdated: "2024-01-15",
    barcode: "123456789026",
    location: "Aisle 5-E",
  },
  {
    id: "16",
    productName: "Ice Cream",
    productId: "DA-ICE-016",
    category: "Dairy",
    stock: 22,
    price: 6.99,
    storeName: "Westside Market",
    storeId: "store_004",
    unit: "tub",
    status: "Available",
    minimumStock: 8,
    supplier: "Cool Treats Ltd",
    lastUpdated: "2024-01-15",
    barcode: "123456789027",
    location: "Freezer A-1",
  },
  {
    id: "17",
    productName: "Mixed Nuts",
    productId: "SN-NUT-017",
    category: "Snacks",
    stock: 3,
    price: 7.99,
    storeName: "Westside Market",
    storeId: "store_004",
    unit: "pack",
    status: "Low Stock",
    minimumStock: 5,
    supplier: "Nut Company",
    lastUpdated: "2024-01-13",
    barcode: "123456789028",
    location: "Aisle 6-G",
  },
  {
    id: "18",
    productName: "Pasta",
    productId: "GR-PAS-018",
    category: "Grains",
    stock: 67,
    price: 1.79,
    storeName: "Westside Market",
    storeId: "store_004",
    unit: "pack",
    status: "Available",
    minimumStock: 15,
    supplier: "Italian Foods",
    lastUpdated: "2024-01-15",
    barcode: "123456789029",
    location: "Aisle 7-H",
  },
];

export default function Products() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [filteredProducts, setFilteredProducts] = useState(products);
  const [allProducts, setAllProducts] = useState(products);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    productName: "",
    productId: "",
    category: "",
    storeName: "",
    stock: "",
    unit: "",
  });

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

  useEffect(() => {
    const filtered = allProducts.filter((product) => {
      const matchesSearch =
        product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.storeName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
    setFilteredProducts(filtered);
  }, [searchTerm, categoryFilter, allProducts]);

  const categories = [...new Set(allProducts.map((p) => p.category))];

  const handleAddProduct = (e) => {
    e.preventDefault();
    const newProduct = {
      id: Date.now().toString(),
      productName: formData.productName,
      productId: formData.productId,
      category: formData.category,
      storeName: formData.storeName,
      stock: parseInt(formData.stock),
      unit: formData.unit,
      status:
        parseInt(formData.stock) === 0
          ? "Out of Stock"
          : parseInt(formData.stock) < 10
            ? "Low Stock"
            : "Available",
      lastUpdated: new Date().toISOString().split("T")[0],
    };

    setAllProducts([...allProducts, newProduct]);
    setFormData({
      productName: "",
      productId: "",
      category: "",
      storeName: "",
      stock: "",
      unit: "",
    });
    setIsAddModalOpen(false);
  };

  const handleDeleteProduct = (id) => {
    setAllProducts(allProducts.filter((p) => p.id !== id));
  };

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

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
              <CardContent className="p-6">
                <div className="text-2xl font-bold">
                  {
                    filteredProducts.filter((p) => p.status === "Available")
                      .length
                  }
                </div>
                <div className="text-green-100">Available Products</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white border-0">
              <CardContent className="p-6">
                <div className="text-2xl font-bold">
                  {
                    filteredProducts.filter((p) => p.status === "Low Stock")
                      .length
                  }
                </div>
                <div className="text-yellow-100">Low Stock Items</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-red-500 to-pink-600 text-white border-0">
              <CardContent className="p-6">
                <div className="text-2xl font-bold">
                  {
                    filteredProducts.filter((p) => p.status === "Out of Stock")
                      .length
                  }
                </div>
                <div className="text-red-100">Out of Stock</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0">
              <CardContent className="p-6">
                <div className="text-2xl font-bold">
                  {filteredProducts.length}
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
            <div className="flex gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
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
                      <th className="text-left p-4 font-semibold">Category</th>
                      <th className="text-left p-4 font-semibold">
                        Store Name
                      </th>
                      <th className="text-left p-4 font-semibold">Stock</th>
                      <th className="text-left p-4 font-semibold">Unit</th>
                      <th className="text-left p-4 font-semibold">Status</th>
                      <th className="text-left p-4 font-semibold">
                        Last Updated
                      </th>
                      <th className="text-left p-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b hover:bg-slate-50/50"
                      >
                        <td className="p-4 font-medium">
                          {product.productName}
                        </td>
                        <td className="p-4 font-mono text-sm text-blue-600">
                          {product.productId}
                        </td>
                        <td className="p-4">
                          <CategoryBadge category={product.category} />
                        </td>
                        <td className="p-4">{product.storeName}</td>
                        <td className="p-4 font-semibold">{product.stock}</td>
                        <td className="p-4">{product.unit}</td>
                        <td className="p-4">
                          <StatusBadge status={product.status} />
                        </td>
                        <td className="p-4">{product.lastUpdated}</td>
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

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
