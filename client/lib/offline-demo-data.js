const SESSION_KEY = "invencare-offline-demo-session";
const PRODUCTS_KEY = "invencare-offline-demo-products";
const TRANSACTIONS_KEY = "invencare-offline-demo-transactions";

export const isDemoBuild =
  import.meta.env.DEV || import.meta.env.MODE === "demo";

const stores = [
  { id: "store_001", name: "Downtown Store", location: "123 Main St" },
  { id: "store_002", name: "Mall Location", location: "456 Shopping Center" },
  { id: "store_003", name: "Uptown Branch", location: "789 North Ave" },
  { id: "store_004", name: "Westside Market", location: "321 West Blvd" },
];

const sampleProducts = [
  [
    "FV-BAN-001",
    "Organic Bananas",
    "Fruits & Vegetables",
    1.99,
    100,
    "store_001",
  ],
  ["DA-MLK-003", "Whole Milk", "Dairy", 3.79, 8, "store_001"],
  ["MP-CHI-008", "Chicken Breast", "Meat & Poultry", 12.99, 25, "store_002"],
  ["BV-ENE-015", "Energy Drinks", "Beverages", 2.99, 75, "store_004"],
  ["SN-CHI-012", "Potato Chips", "Snacks", 3.99, 60, "store_003"],
  ["BV-COF-009", "Ground Coffee", "Beverages", 8.99, 30, "store_002"],
  ["DA-CHE-004", "Cheddar Cheese", "Dairy", 5.99, 40, "store_002"],
  ["SF-SAL-010", "Fresh Salmon", "Seafood", 18.99, 15, "store_003"],
  ["BK-CRO-013", "Croissants", "Bakery", 1.99, 35, "store_003"],
  ["SN-NUT-017", "Mixed Nuts", "Snacks", 7.99, 45, "store_004"],
].map(([productId, productName, category, price, stock, storeId], index) => {
  const store = stores.find((item) => item.id === storeId);
  return {
    id: String(index + 1),
    productId,
    productName,
    category,
    category_id: category,
    price,
    stock,
    unit: "unit",
    storeId,
    storeName: store.name,
    status:
      stock === 0 ? "Out of Stock" : stock <= 10 ? "Low Stock" : "Available",
    minimumStock: 10,
    maximumStock: 100,
    supplier: "Local Demo Supplier",
    description: `${productName} sample inventory item`,
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
});

const makeSampleTransactions = () => {
  const now = Date.now();
  const samples = [
    [
      "DEMO-1001",
      "Sale",
      "FV-BAN-001",
      "Organic Bananas",
      "Fruits & Vegetables",
      15,
      1.99,
      "store_001",
      "John Smith",
      "Customer purchase",
    ],
    [
      "DEMO-1002",
      "Sale",
      "DA-MLK-003",
      "Whole Milk",
      "Dairy",
      4,
      3.79,
      "store_001",
      "John Smith",
      "Family shopping",
    ],
    [
      "DEMO-1003",
      "Restock",
      "MP-CHI-008",
      "Chicken Breast",
      "Meat & Poultry",
      20,
      12.99,
      "store_002",
      "Sarah Johnson",
      "Weekly supplier delivery",
    ],
    [
      "DEMO-1004",
      "Transfer",
      "DA-CHE-004",
      "Cheddar Cheese",
      "Dairy",
      12,
      5.99,
      "store_002",
      "Mike Wilson",
      "Transfer to Downtown Store",
    ],
    [
      "DEMO-1005",
      "Adjustment",
      "SF-SAL-010",
      "Fresh Salmon",
      "Seafood",
      -2,
      18.99,
      "store_003",
      "Anna Garcia",
      "Damaged stock write-off",
    ],
    [
      "DEMO-1006",
      "Sale",
      "BV-COF-009",
      "Ground Coffee",
      "Beverages",
      3,
      8.99,
      "store_002",
      "Sarah Johnson",
      "Customer purchase",
    ],
    [
      "DEMO-1007",
      "Restock",
      "SN-NUT-017",
      "Mixed Nuts",
      "Snacks",
      15,
      7.99,
      "store_004",
      "Lisa Davis",
      "Supplier delivery",
    ],
    [
      "DEMO-1008",
      "Sale",
      "SN-CHI-012",
      "Potato Chips",
      "Snacks",
      6,
      3.99,
      "store_003",
      "Anna Garcia",
      "Customer purchase",
    ],
  ];

  return samples.map(
    (
      [
        reference_number,
        type,
        product_id,
        product_name,
        category,
        quantity,
        unit_price,
        store_id,
        user_name,
        notes,
      ],
      index,
    ) => {
      const store = stores.find((item) => item.id === store_id);
      const total = Math.abs(quantity) * unit_price;
      return {
        id: String(index + 1),
        reference_number,
        type,
        product_id,
        product_name,
        category,
        quantity,
        unit_price,
        total_amount: type === "Adjustment" ? -total : total,
        store_id,
        store_name: store.name,
        transfer_to_store_id: type === "Transfer" ? "store_001" : null,
        transfer_to_store_name: type === "Transfer" ? "Downtown Store" : null,
        user_id: "offline-demo",
        user_name,
        notes,
        timestamp: new Date(now - index * 3_600_000).toISOString(),
        created_at: new Date(now - index * 3_600_000).toISOString(),
      };
    },
  );
};

export function isOfflineDemoMode() {
  return isDemoBuild && Boolean(localStorage.getItem(SESSION_KEY));
}

export function initializeOfflineDemoData() {
  if (!isDemoBuild) return;
  if (!localStorage.getItem(PRODUCTS_KEY)) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(sampleProducts));
  }
  if (!localStorage.getItem(TRANSACTIONS_KEY)) {
    localStorage.setItem(
      TRANSACTIONS_KEY,
      JSON.stringify(makeSampleTransactions()),
    );
  }
}

export function resetOfflineDemoData() {
  if (!isDemoBuild) return;
  localStorage.removeItem(PRODUCTS_KEY);
  localStorage.removeItem(TRANSACTIONS_KEY);
  initializeOfflineDemoData();
}

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error("Failed to read offline demo data:", error);
    return [];
  }
}

export function getOfflineStores() {
  return stores;
}

export function getOfflineProducts(storeId) {
  const products = readList(PRODUCTS_KEY);
  return storeId && storeId !== "all"
    ? products.filter((product) => product.storeId === storeId)
    : products;
}

export function getOfflineProduct(id) {
  return readList(PRODUCTS_KEY).find((product) => product.id === String(id));
}

export function createOfflineProduct(data) {
  const products = readList(PRODUCTS_KEY);
  const store = stores.find((item) => item.name === data.storeName);
  if (!store) throw new Error("Select a valid store for this product.");

  const stock = Number(data.stock);
  const product = {
    id: `demo-${Date.now()}`,
    productId: data.productId,
    productName: data.productName,
    category: data.category || data.category_id || "Other",
    category_id: data.category_id || data.category || "Other",
    price: Number(data.price || 0),
    stock,
    unit: data.unit || "unit",
    storeId: store.id,
    storeName: store.name,
    status:
      stock === 0 ? "Out of Stock" : stock <= 10 ? "Low Stock" : "Available",
    minimumStock: 10,
    maximumStock: 100,
    supplier: "Local Demo Supplier",
    description: data.description || "",
    lastUpdated: new Date().toISOString().slice(0, 10),
  };

  localStorage.setItem(PRODUCTS_KEY, JSON.stringify([product, ...products]));
  return product;
}

export function updateOfflineProduct(id, data) {
  const products = readList(PRODUCTS_KEY);
  const product = products.find((item) => item.id === String(id));
  if (!product) throw new Error("Product not found.");

  const stock = data.stock === undefined ? product.stock : Number(data.stock);
  Object.assign(product, {
    productName: data.productName ?? product.productName,
    productId: data.productId ?? product.productId,
    category: data.category ?? product.category,
    category_id: data.category_id ?? product.category_id,
    stock,
    price: data.price === undefined ? product.price : Number(data.price),
    description: data.description ?? product.description,
    minimumStock:
      data.minimumStock === undefined
        ? product.minimumStock
        : Number(data.minimumStock),
    maximumStock:
      data.maximumStock === undefined
        ? product.maximumStock
        : Number(data.maximumStock),
    status:
      stock === 0 ? "Out of Stock" : stock <= 10 ? "Low Stock" : "Available",
    lastUpdated: new Date().toISOString().slice(0, 10),
  });
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  return product;
}

export function deleteOfflineProduct(id) {
  const products = readList(PRODUCTS_KEY);
  const remaining = products.filter((product) => product.id !== String(id));
  if (remaining.length === products.length) {
    throw new Error("Product not found.");
  }
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(remaining));
}

export function getOfflineTransactions({ storeId, type, search } = {}) {
  const term = search?.toLowerCase();
  return readList(TRANSACTIONS_KEY)
    .filter(
      (transaction) =>
        !storeId || storeId === "all" || transaction.store_id === storeId,
    )
    .filter(
      (transaction) => !type || type === "all" || transaction.type === type,
    )
    .filter((transaction) => {
      if (!term) return true;
      return [
        transaction.product_name,
        transaction.product_id,
        transaction.reference_number,
        transaction.user_name,
      ].some((value) => value?.toLowerCase().includes(term));
    })
    .sort(
      (left, right) => new Date(right.timestamp) - new Date(left.timestamp),
    );
}

export function getOfflineTransactionSummary(
  transactions = readList(TRANSACTIONS_KEY),
) {
  return {
    total_transactions: transactions.length,
    total_sales: transactions
      .filter((transaction) => transaction.type === "Sale")
      .reduce(
        (sum, transaction) => sum + Number(transaction.total_amount || 0),
        0,
      ),
    total_restocks: transactions.filter(
      (transaction) => transaction.type === "Restock",
    ).length,
    total_transfers: transactions.filter(
      (transaction) => transaction.type === "Transfer",
    ).length,
    total_adjustments: transactions.filter(
      (transaction) => transaction.type === "Adjustment",
    ).length,
  };
}

export function getOfflineDashboardData(storeId = "all") {
  const products = getOfflineProducts(storeId);
  const transactions = getOfflineTransactions({ storeId });
  const categoryTotals = new Map();
  for (const transaction of transactions) {
    if (transaction.type !== "Sale") continue;
    categoryTotals.set(
      transaction.category,
      (categoryTotals.get(transaction.category) || 0) +
        Number(transaction.total_amount || 0),
    );
  }

  return {
    analytics: {
      totalProducts: products.length,
      lowStockItems: products.filter(
        (product) => product.status === "Low Stock",
      ).length,
      revenueThisMonth: transactions
        .filter((transaction) => transaction.type === "Sale")
        .reduce(
          (sum, transaction) => sum + Number(transaction.total_amount || 0),
          0,
        ),
      inventoryTurnover: 6.2,
      topSellingCategories: [...categoryTotals.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((left, right) => right.value - left.value)
        .slice(0, 5),
    },
    lowStockItems: products.filter((product) => product.status === "Low Stock"),
    recentTransactions: transactions.slice(0, 6),
  };
}

export function getOfflineForecastingData() {
  const products = getOfflineProducts();
  const categories = [...new Set(products.map((product) => product.category))];
  const predictions = products.slice(0, 6).map((product, index) => {
    const predictedDemand = Math.max(
      8,
      Math.round(product.stock * (0.3 + index * 0.04)),
    );
    const predictionDate = new Date();
    predictionDate.setDate(predictionDate.getDate() + index + 1);
    return {
      product_id: product.id,
      product_name: product.productName,
      store_id: product.storeId,
      store_name: product.storeName,
      category: product.category,
      prediction_date: predictionDate.toISOString(),
      predicted_demand: predictedDemand,
      confidence_interval_lower: Math.round(predictedDemand * 0.8),
      confidence_interval_upper: Math.round(predictedDemand * 1.2),
      prediction_accuracy: 0.82 + (index % 3) * 0.04,
    };
  });

  return {
    dashboard: {
      summary: {
        totalModels: 1,
        avgAccuracy: "0.84",
        totalPredictions: predictions.length,
        highPriorityRecommendations: products.filter(
          (product) => product.status === "Low Stock",
        ).length,
      },
      categoryPerformance: categories.map((category) => ({
        category,
        product_count: products.filter(
          (product) => product.category === category,
        ).length,
        prediction_count: predictions.filter(
          (prediction) => prediction.category === category,
        ).length,
        avg_predicted_demand: Math.round(
          predictions
            .filter((prediction) => prediction.category === category)
            .reduce((sum, prediction) => sum + prediction.predicted_demand, 0) /
            Math.max(
              1,
              predictions.filter(
                (prediction) => prediction.category === category,
              ).length,
            ),
        ),
        avg_uncertainty: 8,
      })),
      accuracyTrends: [],
      recentPredictions: predictions.map((prediction) => ({
        product_id: prediction.product_id,
        product_name: prediction.product_name,
        store_name: prediction.store_name,
        total_predicted_demand: prediction.predicted_demand,
      })),
    },
    predictions,
  };
}

export function createOfflineTransaction(data) {
  const products = readList(PRODUCTS_KEY);
  const product = products.find(
    (item) =>
      item.id === String(data.productId) || item.productId === data.productId,
  );
  const quantity = Number(data.quantity);
  const unitPrice = Number(data.unitPrice);
  const transaction = {
    id: String(Date.now()),
    reference_number: `DEMO-${Date.now()}`,
    type: data.type,
    product_id: product?.productId || data.productId,
    product_name: data.productName,
    category: data.category,
    quantity,
    unit_price: unitPrice,
    total_amount: quantity * unitPrice,
    store_id: data.storeId,
    store_name: data.storeName,
    transfer_to_store_id: data.transferToStoreId || null,
    transfer_to_store_name: data.transferToStoreName || null,
    user_id: "offline-demo",
    user_name: "Offline Demo",
    notes: data.notes,
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  if (product) {
    if (data.type === "Sale" || data.type === "Adjustment") {
      product.stock -= Math.abs(quantity);
    } else if (data.type === "Restock") {
      product.stock += Math.abs(quantity);
    }
    product.status =
      product.stock === 0
        ? "Out of Stock"
        : product.stock <= product.minimumStock
          ? "Low Stock"
          : "Available";
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  }

  const transactions = [transaction, ...readList(TRANSACTIONS_KEY)];
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  return transaction;
}
