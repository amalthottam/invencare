-- Product Analytics Tables
-- These tables support comprehensive product analytics including sales trends, inventory analytics, and performance metrics

-- Product Performance Analytics
CREATE TABLE IF NOT EXISTS product_performance_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id VARCHAR(50) NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly'
    
    -- Sales Metrics
    total_sales_volume INTEGER DEFAULT 0,
    total_sales_revenue DECIMAL(10,2) DEFAULT 0.00,
    average_sale_price DECIMAL(10,2) DEFAULT 0.00,
    sales_velocity DECIMAL(8,2) DEFAULT 0.00, -- units per day
    
    -- Inventory Metrics
    average_inventory DECIMAL(10,2) DEFAULT 0.00,
    inventory_turnover DECIMAL(8,2) DEFAULT 0.00,
    days_inventory_outstanding INTEGER DEFAULT 0,
    stockout_occurrences INTEGER DEFAULT 0,
    stockout_duration_hours INTEGER DEFAULT 0,
    
    -- Profitability Metrics  
    gross_profit DECIMAL(10,2) DEFAULT 0.00,
    profit_margin DECIMAL(5,2) DEFAULT 0.00,
    roi DECIMAL(5,2) DEFAULT 0.00,
    
    -- Demand Metrics
    demand_variance DECIMAL(8,2) DEFAULT 0.00,
    forecast_accuracy DECIMAL(5,2) DEFAULT 0.00,
    seasonal_index DECIMAL(5,2) DEFAULT 1.00,
    
    -- Rankings and Scores
    abc_classification VARCHAR(1), -- 'A', 'B', 'C'
    performance_score DECIMAL(5,2) DEFAULT 0.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(product_id, store_id, analysis_date, period_type)
);

-- Product Sales Trends  
CREATE TABLE IF NOT EXISTS product_sales_trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id VARCHAR(50) NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    trend_date DATE NOT NULL,
    
    -- Daily Metrics
    units_sold INTEGER DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0.00,
    average_price DECIMAL(10,2) DEFAULT 0.00,
    
    -- Inventory at end of day
    ending_inventory INTEGER DEFAULT 0,
    
    -- Customer metrics
    unique_customers INTEGER DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    
    -- Comparative metrics
    previous_day_sales INTEGER DEFAULT 0,
    week_over_week_growth DECIMAL(5,2) DEFAULT 0.00,
    month_over_month_growth DECIMAL(5,2) DEFAULT 0.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(product_id, store_id, trend_date)
);

-- Product Category Analytics
CREATE TABLE IF NOT EXISTS product_category_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_type VARCHAR(20) NOT NULL, -- 'weekly', 'monthly', 'quarterly'
    
    -- Category Performance
    total_products INTEGER DEFAULT 0,
    active_products INTEGER DEFAULT 0,
    total_sales_volume INTEGER DEFAULT 0,
    total_sales_revenue DECIMAL(12,2) DEFAULT 0.00,
    average_margin DECIMAL(5,2) DEFAULT 0.00,
    
    -- Top Performers
    top_product_id VARCHAR(50),
    top_product_sales INTEGER DEFAULT 0,
    worst_product_id VARCHAR(50),
    worst_product_sales INTEGER DEFAULT 0,
    
    -- Inventory Health
    average_inventory_turnover DECIMAL(8,2) DEFAULT 0.00,
    stockout_incidents INTEGER DEFAULT 0,
    overstock_incidents INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(category_id, store_id, analysis_date, period_type)
);

-- Product Demand Forecasting Data
CREATE TABLE IF NOT EXISTS product_demand_forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id VARCHAR(50) NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    forecast_date DATE NOT NULL,
    forecast_period INTEGER NOT NULL, -- days ahead
    
    -- Forecast Models
    linear_forecast DECIMAL(10,2) DEFAULT 0.00,
    seasonal_forecast DECIMAL(10,2) DEFAULT 0.00,
    arima_forecast DECIMAL(10,2) DEFAULT 0.00,
    lstm_forecast DECIMAL(10,2) DEFAULT 0.00,
    ensemble_forecast DECIMAL(10,2) DEFAULT 0.00,
    
    -- Confidence Intervals
    confidence_interval_lower DECIMAL(10,2) DEFAULT 0.00,
    confidence_interval_upper DECIMAL(10,2) DEFAULT 0.00,
    forecast_accuracy_score DECIMAL(5,2) DEFAULT 0.00,
    
    -- Actual vs Forecast (filled when actual data becomes available)
    actual_sales INTEGER DEFAULT NULL,
    forecast_error DECIMAL(10,2) DEFAULT NULL,
    absolute_percentage_error DECIMAL(5,2) DEFAULT NULL,
    
    model_version VARCHAR(50) DEFAULT 'v1.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(product_id, store_id, forecast_date, forecast_period)
);

-- Product Reorder Recommendations
CREATE TABLE IF NOT EXISTS product_reorder_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id VARCHAR(50) NOT NULL,
    store_id VARCHAR(50) NOT NULL,
    recommendation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Current State
    current_stock INTEGER NOT NULL,
    minimum_stock INTEGER NOT NULL,
    maximum_stock INTEGER NOT NULL,
    
    -- Demand Projections
    projected_demand_7_days INTEGER DEFAULT 0,
    projected_demand_14_days INTEGER DEFAULT 0,
    projected_demand_30_days INTEGER DEFAULT 0,
    
    -- Recommendations
    recommended_order_quantity INTEGER DEFAULT 0,
    recommended_order_date DATE,
    urgency_level VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
    
    -- Economics
    estimated_stockout_cost DECIMAL(10,2) DEFAULT 0.00,
    estimated_carrying_cost DECIMAL(10,2) DEFAULT 0.00,
    potential_lost_sales DECIMAL(10,2) DEFAULT 0.00,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'ordered', 'completed'
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(product_id, store_id, recommendation_date)
);

-- Product Analytics Events (for tracking analytics events)
CREATE TABLE IF NOT EXISTS product_analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type VARCHAR(50) NOT NULL, -- 'forecast_generated', 'analysis_completed', 'alert_triggered'
    product_id VARCHAR(50),
    store_id VARCHAR(50),
    event_data TEXT, -- JSON data
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_performance_product_store ON product_performance_analytics(product_id, store_id);
CREATE INDEX IF NOT EXISTS idx_product_performance_date ON product_performance_analytics(analysis_date);
CREATE INDEX IF NOT EXISTS idx_product_sales_trends_product_store ON product_sales_trends(product_id, store_id);
CREATE INDEX IF NOT EXISTS idx_product_sales_trends_date ON product_sales_trends(trend_date);
CREATE INDEX IF NOT EXISTS idx_product_category_analytics_category ON product_category_analytics(category_id, store_id);
CREATE INDEX IF NOT EXISTS idx_product_demand_forecasts_product_store ON product_demand_forecasts(product_id, store_id);
CREATE INDEX IF NOT EXISTS idx_product_demand_forecasts_date ON product_demand_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_product_reorder_recommendations_product_store ON product_reorder_recommendations(product_id, store_id);
CREATE INDEX IF NOT EXISTS idx_product_reorder_recommendations_status ON product_reorder_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_product_analytics_events_type ON product_analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_product_analytics_events_date ON product_analytics_events(created_at);
