-- ============================================================================
-- MySQL Migration Script for InvenCare Inventory Management System
-- ============================================================================
-- This script creates all database tables and populates them with sample data
-- Run this script on your new MySQL database to migrate all existing data
-- ============================================================================

-- Set SQL mode for better compatibility
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

-- ============================================================================
-- CORE BUSINESS TABLES
-- ============================================================================

-- Create stores table
CREATE TABLE IF NOT EXISTS `stores` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `location` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(50) DEFAULT NULL,
  `status` ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create categories table
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create suppliers table
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `contact_email` VARCHAR(255),
  `contact_phone` VARCHAR(50),
  `address` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create products table
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `price` DECIMAL(10, 2) DEFAULT NULL,
  `quantity` INT DEFAULT 0,
  `barcode` VARCHAR(100) DEFAULT NULL,
  `location_in_store` VARCHAR(100) DEFAULT NULL,
  `category` VARCHAR(100) DEFAULT NULL,
  `category_id` INT DEFAULT NULL,
  `unit_price` DECIMAL(10, 2) DEFAULT NULL,
  `current_stock` INT DEFAULT 0,
  `minimum_stock` INT DEFAULT 10,
  `maximum_stock` INT DEFAULT 100,
  `store_id` VARCHAR(50) NOT NULL,
  `supplier_id` INT DEFAULT NULL,
  `status` ENUM('active', 'inactive', 'discontinued') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL,
  INDEX `idx_products_store` (`store_id`),
  INDEX `idx_products_category` (`category_id`),
  INDEX `idx_products_status` (`status`),
  INDEX `idx_products_barcode` (`barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create inventory_transactions table
CREATE TABLE IF NOT EXISTS `inventory_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `reference_number` VARCHAR(100) UNIQUE NOT NULL,
  `transaction_type` ENUM('Sale', 'Restock', 'Adjustment', 'Transfer') NOT NULL,
  `product_id` VARCHAR(50) DEFAULT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) DEFAULT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(10, 2) NOT NULL,
  `total_amount` DECIMAL(10, 2) NOT NULL,
  `store_id` VARCHAR(50) NOT NULL,
  `store_name` VARCHAR(255) NOT NULL,
  `transfer_to_store_id` VARCHAR(50) DEFAULT NULL,
  `transfer_to_store_name` VARCHAR(255) DEFAULT NULL,
  `user_id` VARCHAR(100) NOT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`transfer_to_store_id`) REFERENCES `stores`(`id`) ON DELETE SET NULL,
  INDEX `idx_transactions_type` (`transaction_type`),
  INDEX `idx_transactions_store` (`store_id`),
  INDEX `idx_transactions_date` (`created_at`),
  INDEX `idx_transactions_reference` (`reference_number`),
  INDEX `idx_transactions_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create user_store_access table
CREATE TABLE IF NOT EXISTS `user_store_access` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` VARCHAR(100) NOT NULL,
  `store_id` VARCHAR(50) NOT NULL,
  `access_level` ENUM('read', 'write', 'admin') DEFAULT 'read',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_user_store` (`user_id`, `store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- AI & ANALYTICS TABLES
-- ============================================================================

-- Create demand_forecasting_models table
CREATE TABLE IF NOT EXISTS `demand_forecasting_models` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `model_name` VARCHAR(100) NOT NULL,
  `model_type` ENUM('linear_regression', 'arima', 'lstm', 'prophet', 'ensemble') NOT NULL,
  `sagemaker_endpoint` VARCHAR(255),
  `model_accuracy` DECIMAL(5,2) DEFAULT 0.00,
  `training_status` ENUM('pending', 'training', 'completed', 'failed') DEFAULT 'pending',
  `store_id` VARCHAR(50) NOT NULL,
  `category_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL,
  INDEX `idx_models_type` (`model_type`),
  INDEX `idx_models_store` (`store_id`),
  INDEX `idx_models_status` (`training_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create demand_predictions table
CREATE TABLE IF NOT EXISTS `demand_predictions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` VARCHAR(50) NOT NULL,
  `store_id` VARCHAR(50) NOT NULL,
  `model_id` INT NOT NULL,
  `prediction_date` DATE NOT NULL,
  `predicted_demand` DECIMAL(10,2) NOT NULL,
  `confidence_interval_lower` DECIMAL(10,2) DEFAULT 0.00,
  `confidence_interval_upper` DECIMAL(10,2) DEFAULT 0.00,
  `prediction_accuracy` DECIMAL(5,2) DEFAULT 0.00,
  `actual_demand` DECIMAL(10,2) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`model_id`) REFERENCES `demand_forecasting_models`(`id`) ON DELETE CASCADE,
  INDEX `idx_predictions_product_date` (`product_id`, `prediction_date`),
  INDEX `idx_predictions_store` (`store_id`),
  INDEX `idx_predictions_date` (`prediction_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create market_trends table
CREATE TABLE IF NOT EXISTS `market_trends` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT NOT NULL,
  `store_id` VARCHAR(50) NOT NULL,
  `trend_date` DATE NOT NULL,
  `demand_trend` ENUM('increasing', 'stable', 'decreasing') NOT NULL,
  `seasonality_factor` DECIMAL(5,2) DEFAULT 1.00,
  `market_growth_rate` DECIMAL(5,2) DEFAULT 0.00,
  `external_factors` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  INDEX `idx_trends_category_date` (`category_id`, `trend_date`),
  INDEX `idx_trends_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create customer_behavior_analytics table
CREATE TABLE IF NOT EXISTS `customer_behavior_analytics` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `store_id` VARCHAR(50) NOT NULL,
  `category_id` INT NOT NULL,
  `analysis_date` DATE NOT NULL,
  `customer_segment` VARCHAR(50) NOT NULL,
  `avg_purchase_frequency` DECIMAL(5,2) DEFAULT 0.00,
  `avg_basket_size` DECIMAL(10,2) DEFAULT 0.00,
  `customer_retention_rate` DECIMAL(5,2) DEFAULT 0.00,
  `price_sensitivity` DECIMAL(5,2) DEFAULT 0.00,
  `seasonal_preference` DECIMAL(5,2) DEFAULT 1.00,
  `lifetime_value` DECIMAL(10,2) DEFAULT 0.00,
  `churn_probability` DECIMAL(5,2) DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE,
  INDEX `idx_behavior_segment_store` (`customer_segment`, `store_id`),
  INDEX `idx_behavior_date` (`analysis_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create inventory_optimization table
CREATE TABLE IF NOT EXISTS `inventory_optimization` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` VARCHAR(50) NOT NULL,
  `store_id` VARCHAR(50) NOT NULL,
  `current_stock` INT NOT NULL,
  `recommended_stock` INT NOT NULL,
  `reorder_point` INT NOT NULL,
  `economic_order_quantity` INT DEFAULT 0,
  `safety_stock` INT DEFAULT 0,
  `holding_cost_per_unit` DECIMAL(10,2) DEFAULT 0.00,
  `ordering_cost` DECIMAL(10,2) DEFAULT 0.00,
  `stockout_cost` DECIMAL(10,2) DEFAULT 0.00,
  `optimization_score` DECIMAL(5,2) DEFAULT 0.00,
  `recommendations` TEXT,
  `urgency_level` ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  `estimated_savings` DECIMAL(10,2) DEFAULT 0.00,
  `implementation_status` ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  INDEX `idx_optimization_product_store` (`product_id`, `store_id`),
  INDEX `idx_optimization_urgency` (`urgency_level`),
  INDEX `idx_optimization_status` (`implementation_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create ai_model_metrics table
CREATE TABLE IF NOT EXISTS `ai_model_metrics` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `model_id` INT NOT NULL,
  `metric_type` VARCHAR(50) NOT NULL,
  `metric_value` DECIMAL(10,4) NOT NULL,
  `evaluation_date` DATE NOT NULL,
  `dataset_size` INT DEFAULT 0,
  `training_duration_minutes` INT DEFAULT 0,
  `hyperparameters` TEXT,
  `validation_method` VARCHAR(50) DEFAULT 'holdout',
  `notes` TEXT,
  `is_production_ready` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`model_id`) REFERENCES `demand_forecasting_models`(`id`) ON DELETE CASCADE,
  INDEX `idx_metrics_model_metric` (`model_id`, `metric_type`),
  INDEX `idx_metrics_date` (`evaluation_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PRODUCT ANALYTICS TABLES (Advanced Analytics)
-- ============================================================================

-- Create product_performance_analytics table
CREATE TABLE IF NOT EXISTS `product_performance_analytics` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` VARCHAR(50) NOT NULL,
  `store_id` VARCHAR(50) NOT NULL,
  `analysis_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `period_type` ENUM('daily', 'weekly', 'monthly', 'quarterly') NOT NULL,
  
  -- Sales Metrics
  `total_sales_volume` INT DEFAULT 0,
  `total_sales_revenue` DECIMAL(10,2) DEFAULT 0.00,
  `average_sale_price` DECIMAL(10,2) DEFAULT 0.00,
  `sales_velocity` DECIMAL(8,2) DEFAULT 0.00,
  
  -- Inventory Metrics
  `average_inventory` DECIMAL(10,2) DEFAULT 0.00,
  `inventory_turnover` DECIMAL(8,2) DEFAULT 0.00,
  `days_inventory_outstanding` INT DEFAULT 0,
  `stockout_occurrences` INT DEFAULT 0,
  `stockout_duration_hours` INT DEFAULT 0,
  
  -- Profitability Metrics
  `gross_profit` DECIMAL(10,2) DEFAULT 0.00,
  `profit_margin` DECIMAL(5,2) DEFAULT 0.00,
  `roi` DECIMAL(5,2) DEFAULT 0.00,
  
  -- Demand Metrics
  `demand_variance` DECIMAL(8,2) DEFAULT 0.00,
  `forecast_accuracy` DECIMAL(5,2) DEFAULT 0.00,
  `seasonal_index` DECIMAL(5,2) DEFAULT 1.00,
  
  -- Rankings and Scores
  `abc_classification` ENUM('A', 'B', 'C') DEFAULT NULL,
  `performance_score` DECIMAL(5,2) DEFAULT 0.00,
  
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY `unique_product_store_date_period` (`product_id`, `store_id`, `analysis_date`, `period_type`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  INDEX `idx_performance_product_store` (`product_id`, `store_id`),
  INDEX `idx_performance_date` (`analysis_date`),
  INDEX `idx_performance_classification` (`abc_classification`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create product_sales_trends table
CREATE TABLE IF NOT EXISTS `product_sales_trends` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` VARCHAR(50) NOT NULL,
  `store_id` VARCHAR(50) NOT NULL,
  `trend_date` DATE NOT NULL,
  
  -- Daily Metrics
  `units_sold` INT DEFAULT 0,
  `revenue` DECIMAL(10,2) DEFAULT 0.00,
  `average_price` DECIMAL(10,2) DEFAULT 0.00,
  
  -- Inventory at end of day
  `ending_inventory` INT DEFAULT 0,
  
  -- Customer metrics
  `unique_customers` INT DEFAULT 0,
  `transaction_count` INT DEFAULT 0,
  
  -- Comparative metrics
  `previous_day_sales` INT DEFAULT 0,
  `week_over_week_growth` DECIMAL(5,2) DEFAULT 0.00,
  `month_over_month_growth` DECIMAL(5,2) DEFAULT 0.00,
  
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY `unique_product_store_date` (`product_id`, `store_id`, `trend_date`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  INDEX `idx_sales_trends_product_store` (`product_id`, `store_id`),
  INDEX `idx_sales_trends_date` (`trend_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create product_demand_forecasts table
CREATE TABLE IF NOT EXISTS `product_demand_forecasts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` VARCHAR(50) NOT NULL,
  `store_id` VARCHAR(50) NOT NULL,
  `forecast_date` DATE NOT NULL,
  `forecast_period` INT NOT NULL,
  
  -- Forecast Models
  `linear_forecast` DECIMAL(10,2) DEFAULT 0.00,
  `seasonal_forecast` DECIMAL(10,2) DEFAULT 0.00,
  `arima_forecast` DECIMAL(10,2) DEFAULT 0.00,
  `lstm_forecast` DECIMAL(10,2) DEFAULT 0.00,
  `ensemble_forecast` DECIMAL(10,2) DEFAULT 0.00,
  
  -- Confidence Intervals
  `confidence_interval_lower` DECIMAL(10,2) DEFAULT 0.00,
  `confidence_interval_upper` DECIMAL(10,2) DEFAULT 0.00,
  `forecast_accuracy_score` DECIMAL(5,2) DEFAULT 0.00,
  
  -- Actual vs Forecast
  `actual_sales` INT DEFAULT NULL,
  `forecast_error` DECIMAL(10,2) DEFAULT NULL,
  `absolute_percentage_error` DECIMAL(5,2) DEFAULT NULL,
  
  `model_version` VARCHAR(50) DEFAULT 'v1.0',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY `unique_product_store_forecast` (`product_id`, `store_id`, `forecast_date`, `forecast_period`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  INDEX `idx_demand_forecasts_product_store` (`product_id`, `store_id`),
  INDEX `idx_demand_forecasts_date` (`forecast_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create product_reorder_recommendations table
CREATE TABLE IF NOT EXISTS `product_reorder_recommendations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` VARCHAR(50) NOT NULL,
  `store_id` VARCHAR(50) NOT NULL,
  `recommendation_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
  
  -- Current State
  `current_stock` INT NOT NULL,
  `minimum_stock` INT NOT NULL,
  `maximum_stock` INT NOT NULL,
  
  -- Demand Projections
  `projected_demand_7_days` INT DEFAULT 0,
  `projected_demand_14_days` INT DEFAULT 0,
  `projected_demand_30_days` INT DEFAULT 0,
  
  -- Recommendations
  `recommended_order_quantity` INT DEFAULT 0,
  `recommended_order_date` DATE DEFAULT NULL,
  `urgency_level` ENUM('low', 'normal', 'high', 'critical') DEFAULT 'normal',
  
  -- Economics
  `estimated_stockout_cost` DECIMAL(10,2) DEFAULT 0.00,
  `estimated_carrying_cost` DECIMAL(10,2) DEFAULT 0.00,
  `potential_lost_sales` DECIMAL(10,2) DEFAULT 0.00,
  
  -- Status
  `status` ENUM('pending', 'approved', 'ordered', 'completed') DEFAULT 'pending',
  `notes` TEXT,
  
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY `unique_product_store_recommendation` (`product_id`, `store_id`, `recommendation_date`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE,
  INDEX `idx_reorder_product_store` (`product_id`, `store_id`),
  INDEX `idx_reorder_status` (`status`),
  INDEX `idx_reorder_urgency` (`urgency_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create product_analytics_events table
CREATE TABLE IF NOT EXISTS `product_analytics_events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `event_type` VARCHAR(50) NOT NULL,
  `product_id` VARCHAR(50) DEFAULT NULL,
  `store_id` VARCHAR(50) DEFAULT NULL,
  `event_data` TEXT,
  `severity` ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE SET NULL,
  INDEX `idx_analytics_events_type` (`event_type`),
  INDEX `idx_analytics_events_date` (`created_at`),
  INDEX `idx_analytics_events_severity` (`severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- AUDIT TABLES
-- ============================================================================

-- Create transaction_audit_log table
CREATE TABLE IF NOT EXISTS `transaction_audit_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_id` INT NOT NULL,
  `action_type` ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
  `old_values` TEXT,
  `new_values` TEXT,
  `changed_by` VARCHAR(100) NOT NULL,
  `change_reason` TEXT,
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`transaction_id`) REFERENCES `inventory_transactions`(`id`) ON DELETE CASCADE,
  INDEX `idx_audit_transaction` (`transaction_id`),
  INDEX `idx_audit_date` (`created_at`),
  INDEX `idx_audit_user` (`changed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SAMPLE DATA INSERTION
-- ============================================================================

-- Insert sample stores
INSERT IGNORE INTO `stores` (`id`, `name`, `location`, `city`, `state`, `status`) VALUES
('store_001', 'Downtown Fresh Market', '123 Main Street, Financial District', 'New York', 'NY', 'active'),
('store_002', 'Manhattan Mall Supermarket', '456 Broadway, Herald Square', 'New York', 'NY', 'active'),
('store_003', 'Brooklyn Heights Grocery', '789 Atlantic Avenue, Brooklyn Heights', 'Brooklyn', 'NY', 'active');

-- Insert sample categories
INSERT IGNORE INTO `categories` (`name`, `description`) VALUES
('Fruits & Vegetables', 'Fresh produce including fruits and vegetables'),
('Dairy', 'Milk products, cheese, yogurt, and dairy items'),
('Meat & Poultry', 'Fresh and frozen meat and poultry products'),
('Beverages', 'Soft drinks, juices, coffee, tea, and other beverages'),
('Snacks', 'Chips, nuts, crackers, and other snack foods'),
('Seafood', 'Fresh and frozen fish and seafood products'),
('Bakery', 'Bread, pastries, cakes, and baked goods'),
('Frozen Foods', 'Frozen meals, vegetables, and other frozen items'),
('Household Items', 'Cleaning supplies, toiletries, and household goods'),
('Electronics', 'Small electronics and accessories');

-- Insert sample suppliers
INSERT IGNORE INTO `suppliers` (`name`, `contact_email`, `contact_phone`, `address`) VALUES
('Fresh Farm Co', 'orders@freshfarm.com', '555-0101', '100 Farm Road, Rural County'),
('Dairy Best Inc', 'supply@dairybest.com', '555-0102', '200 Milk Lane, Dairy Town'),
('Ocean Fresh Seafood', 'sales@oceanfresh.com', '555-0103', '300 Harbor St, Coastal City'),
('Global Beverages Ltd', 'orders@globalbev.com', '555-0104', '400 Distribution Ave, Metro City'),
('Premium Meats Co', 'sales@premiummeats.com', '555-0105', '500 Butcher Block, Meat District');

-- Insert sample products
INSERT IGNORE INTO `products` (`id`, `name`, `description`, `price`, `quantity`, `barcode`, `location_in_store`, `category`, `category_id`, `unit_price`, `current_stock`, `minimum_stock`, `maximum_stock`, `store_id`, `supplier_id`) VALUES
-- Downtown Fresh Market Products
('FV-BAN-001', 'Organic Bananas', 'Fresh organic bananas from Ecuador farms, pesticide-free and naturally ripened', 1.99, 120, '123456789012', 'Aisle 1-A', 'Fruits & Vegetables', 1, 1.99, 120, 20, 200, 'store_001', 1),
('FV-APP-002', 'Red Delicious Apples', 'Crispy red apples from Washington state orchards, perfect for snacking or baking', 2.49, 85, '123456789013', 'Aisle 1-A', 'Fruits & Vegetables', 1, 2.49, 85, 15, 150, 'store_001', 1),
('FV-CAR-003', 'Organic Carrots', 'Fresh bunched carrots grown organically, rich in beta-carotene and vitamins', 1.89, 65, '123456789017', 'Aisle 1-B', 'Fruits & Vegetables', 1, 1.89, 65, 20, 100, 'store_001', 1),
('FV-TOM-004', 'Roma Tomatoes', 'Vine-ripened Roma tomatoes, ideal for sauces and cooking', 3.29, 40, '123456789030', 'Aisle 1-B', 'Fruits & Vegetables', 1, 3.29, 40, 10, 80, 'store_001', 1),
('DA-MLK-005', 'Whole Milk', 'Fresh whole milk, 3.25% fat content, from local dairy farms', 3.79, 50, '123456789014', 'Aisle 3-A', 'Dairy', 2, 3.79, 50, 10, 100, 'store_001', 2),
('DA-CHE-006', 'Sharp Cheddar Cheese', 'Aged sharp cheddar cheese, 8oz block, perfect for sandwiches and cooking', 5.99, 30, '123456789015', 'Aisle 3-A', 'Dairy', 2, 5.99, 30, 8, 60, 'store_001', 2),
('DA-YOG-007', 'Greek Yogurt', 'Thick and creamy Greek-style yogurt, high protein, vanilla flavor', 4.99, 25, '123456789018', 'Aisle 3-B', 'Dairy', 2, 4.99, 25, 10, 50, 'store_001', 2),
('BK-BRD-008', 'Artisan Sourdough Bread', 'Hand-crafted sourdough bread, slow-fermented for 24 hours', 4.49, 18, '123456789016', 'Bakery Counter', 'Bakery', 7, 4.49, 18, 5, 40, 'store_001', NULL),
('BK-CRO-009', 'Butter Croissants', 'Fresh French butter croissants, flaky and buttery pastry', 1.99, 24, '123456789024', 'Bakery Counter', 'Bakery', 7, 1.99, 24, 8, 50, 'store_001', NULL),
('BV-COF-010', 'Colombian Coffee Beans', 'Premium Colombian coffee beans, medium roast, single origin', 12.99, 22, '123456789020', 'Aisle 5-A', 'Beverages', 4, 12.99, 22, 8, 40, 'store_001', 4),

-- Manhattan Mall Supermarket Products
('MP-CHI-011', 'Chicken Breast', 'Fresh boneless, skinless chicken breast, antibiotic-free', 12.99, 35, '123456789019', 'Meat Counter', 'Meat & Poultry', 3, 12.99, 35, 10, 80, 'store_002', 5),
('MP-GRB-012', 'Ground Beef 85/15', 'Fresh ground beef, 85% lean, perfect for burgers and meatballs', 8.99, 28, '123456789031', 'Meat Counter', 'Meat & Poultry', 3, 8.99, 28, 8, 50, 'store_002', 5),
('MP-SAL-013', 'Atlantic Salmon Fillet', 'Fresh Atlantic salmon fillet, wild-caught, rich in omega-3', 18.99, 12, '123456789021', 'Seafood Counter', 'Seafood', 6, 18.99, 12, 3, 25, 'store_002', 3),
('MP-SHR-014', 'Jumbo Shrimp', 'Fresh jumbo shrimp, peeled and deveined, ready to cook', 16.99, 20, '123456789032', 'Seafood Counter', 'Seafood', 6, 16.99, 20, 5, 40, 'store_002', 3),
('BV-ENE-015', 'Energy Drinks', 'High caffeine energy drinks, assorted flavors, 16oz cans', 2.99, 75, '123456789026', 'Aisle 6-A', 'Beverages', 4, 2.99, 75, 20, 150, 'store_002', 4),
('BV-SOD-016', 'Coca-Cola Classic', 'Classic Coca-Cola soda, 12-pack cans, refreshing cola taste', 5.99, 48, '123456789033', 'Aisle 6-B', 'Beverages', 4, 5.99, 48, 15, 100, 'store_002', 4),
('BV-JUI-017', 'Fresh Orange Juice', 'Freshly squeezed orange juice, no pulp, vitamin C enriched', 4.49, 32, '123456789022', 'Aisle 6-A', 'Beverages', 4, 4.49, 32, 12, 60, 'store_002', 4),
('SN-CHI-018', 'Kettle Cooked Chips', 'Artisan kettle cooked potato chips, sea salt flavor, thick cut', 3.99, 45, '123456789023', 'Aisle 7-A', 'Snacks', 5, 3.99, 45, 15, 90, 'store_002', NULL),
('SN-NUT-019', 'Mixed Premium Nuts', 'Deluxe mixed nuts, roasted and salted, almonds, cashews, pecans', 7.99, 38, '123456789028', 'Aisle 7-B', 'Snacks', 5, 7.99, 38, 10, 80, 'store_002', NULL),
('FZ-ICE-020', 'Vanilla Ice Cream', 'Premium vanilla ice cream, made with real vanilla beans, half gallon', 6.99, 15, '123456789027', 'Freezer A-1', 'Frozen Foods', 8, 6.99, 15, 5, 30, 'store_002', NULL),

-- Brooklyn Heights Grocery Products
('FV-LET-021', 'Romaine Lettuce', 'Fresh romaine lettuce heads, crisp leaves perfect for Caesar salads', 2.79, 42, '123456789034', 'Produce Section', 'Fruits & Vegetables', 1, 2.79, 42, 12, 80, 'store_003', 1),
('FV-BRO-022', 'Fresh Broccoli', 'Fresh broccoli crowns, rich in vitamins and fiber, steam ready', 3.49, 35, '123456789035', 'Produce Section', 'Fruits & Vegetables', 1, 3.49, 35, 10, 60, 'store_003', 1),
('FV-ONI-023', 'Yellow Onions', 'Fresh yellow onions, 3lb bag, essential cooking ingredient', 2.99, 28, '123456789036', 'Produce Section', 'Fruits & Vegetables', 1, 2.99, 28, 8, 50, 'store_003', 1),
('FV-POT-024', 'Russet Potatoes', 'Idaho russet potatoes, 5lb bag, perfect for baking and frying', 4.99, 25, '123456789037', 'Produce Section', 'Fruits & Vegetables', 1, 4.99, 25, 6, 40, 'store_003', 1),
('DA-BUT-025', 'Organic Butter', 'Organic unsalted butter, grass-fed cows, European style', 6.49, 20, '123456789038', 'Dairy Cooler', 'Dairy', 2, 6.49, 20, 5, 40, 'store_003', 2),
('DA-EGG-026', 'Free Range Eggs', 'Free range chicken eggs, large size, dozen pack', 4.99, 30, '123456789039', 'Dairy Cooler', 'Dairy', 2, 4.99, 30, 8, 60, 'store_003', 2),
('BK-BAG-027', 'Everything Bagels', 'Fresh everything bagels, 6-pack, topped with sesame, poppy seeds', 3.99, 16, '123456789040', 'Bakery Section', 'Bakery', 7, 3.99, 16, 4, 30, 'store_003', NULL),
('BK-MUF-028', 'Blueberry Muffins', 'Fresh baked blueberry muffins, 4-pack, bursting with real blueberries', 5.99, 12, '123456789041', 'Bakery Section', 'Bakery', 7, 5.99, 12, 3, 25, 'store_003', NULL),
('GR-RIC-029', 'Jasmine Rice', 'Premium jasmine rice, 5lb bag, aromatic long grain rice', 8.99, 18, '123456789042', 'Aisle 8-A', 'Grains', NULL, 8.99, 18, 4, 35, 'store_003', NULL),
('GR-PAS-030', 'Italian Pasta', 'Authentic Italian durum wheat pasta, penne shape, 1lb box', 2.49, 40, '123456789029', 'Aisle 8-B', 'Grains', NULL, 2.49, 40, 12, 80, 'store_003', NULL),
('HH-DET-031', 'Laundry Detergent', 'Concentrated laundry detergent, fresh scent, 64 loads', 12.99, 8, '123456789043', 'Aisle 9-A', 'Household Items', 9, 12.99, 8, 2, 20, 'store_003', NULL),
('HH-SHP-032', 'Dish Soap', 'Ultra concentrated dish soap, grease cutting formula, 24oz bottle', 3.49, 15, '123456789044', 'Aisle 9-A', 'Household Items', 9, 3.49, 15, 4, 30, 'store_003', NULL);

-- Insert sample inventory transactions
INSERT IGNORE INTO `inventory_transactions`
(`reference_number`, `transaction_type`, `product_id`, `product_name`, `category`, `quantity`, `unit_price`, `total_amount`, `store_id`, `store_name`, `transfer_to_store_id`, `transfer_to_store_name`, `user_id`, `user_name`, `notes`) VALUES
('SALE-2024-001', 'Sale', 'FV-BAN-001', 'Organic Bananas', 'Fruits & Vegetables', 15, 1.99, 29.85, 'store_001', 'Downtown Fresh Market', NULL, NULL, 'emp_001', 'John Smith', 'Regular customer purchase'),
('SALE-2024-002', 'Sale', 'DA-MLK-005', 'Whole Milk', 'Dairy', 4, 3.79, 15.16, 'store_001', 'Downtown Fresh Market', NULL, NULL, 'emp_001', 'John Smith', 'Family weekly shopping'),
('SALE-2024-003', 'Sale', 'MP-CHI-011', 'Chicken Breast', 'Meat & Poultry', 2, 12.99, 25.98, 'store_002', 'Manhattan Mall Supermarket', NULL, NULL, 'emp_002', 'Sarah Johnson', 'Premium meat selection'),
('SALE-2024-004', 'Sale', 'BV-ENE-015', 'Energy Drinks', 'Beverages', 8, 2.99, 23.92, 'store_002', 'Manhattan Mall Supermarket', NULL, NULL, 'emp_002', 'Sarah Johnson', 'Bulk energy drink purchase'),
('SALE-2024-005', 'Sale', 'SN-CHI-018', 'Kettle Cooked Chips', 'Snacks', 6, 3.99, 23.94, 'store_002', 'Manhattan Mall Supermarket', NULL, NULL, 'emp_002', 'Sarah Johnson', 'Snack variety pack'),
('SALE-2024-006', 'Sale', 'BK-CRO-009', 'Butter Croissants', 'Bakery', 10, 1.99, 19.90, 'store_001', 'Downtown Fresh Market', NULL, NULL, 'emp_001', 'John Smith', 'Fresh bakery items'),
('SALE-2024-007', 'Sale', 'FV-LET-021', 'Romaine Lettuce', 'Fruits & Vegetables', 5, 2.79, 13.95, 'store_003', 'Brooklyn Heights Grocery', NULL, NULL, 'emp_003', 'Emma Davis', 'Salad ingredients'),
('SALE-2024-008', 'Sale', 'DA-EGG-026', 'Free Range Eggs', 'Dairy', 3, 4.99, 14.97, 'store_003', 'Brooklyn Heights Grocery', NULL, NULL, 'emp_003', 'Emma Davis', 'Breakfast essentials'),
('RST-2024-009', 'Restock', 'FV-BAN-001', 'Organic Bananas', 'Fruits & Vegetables', 50, 1.20, 60.00, 'store_001', 'Downtown Fresh Market', NULL, NULL, 'mgr_001', 'Lisa Davis', 'Weekly delivery from Fresh Farm Co'),
('RST-2024-010', 'Restock', 'MP-CHI-011', 'Chicken Breast', 'Meat & Poultry', 25, 8.50, 212.50, 'store_002', 'Manhattan Mall Supermarket', NULL, NULL, 'mgr_002', 'Mike Wilson', 'Fresh meat delivery'),
('RST-2024-011', 'Restock', 'BV-COF-010', 'Colombian Coffee Beans', 'Beverages', 15, 9.50, 142.50, 'store_001', 'Downtown Fresh Market', NULL, NULL, 'mgr_001', 'Lisa Davis', 'Premium coffee restock'),
('TRF-2024-012', 'Transfer', 'DA-CHE-006', 'Sharp Cheddar Cheese', 'Dairy', 8, 5.99, 47.92, 'store_001', 'Downtown Fresh Market', 'store_003', 'Brooklyn Heights Grocery', 'mgr_001', 'Lisa Davis', 'Stock redistribution'),
('ADJ-2024-013', 'Adjustment', 'MP-SAL-013', 'Atlantic Salmon Fillet', 'Seafood', -2, 18.99, -37.98, 'store_002', 'Manhattan Mall Supermarket', NULL, NULL, 'mgr_002', 'Mike Wilson', 'Expired seafood disposal'),
('SALE-2024-014', 'Sale', 'BK-MUF-028', 'Blueberry Muffins', 'Bakery', 4, 5.99, 23.96, 'store_003', 'Brooklyn Heights Grocery', NULL, NULL, 'emp_003', 'Emma Davis', 'Fresh baked goods'),
('SALE-2024-015', 'Sale', 'GR-PAS-030', 'Italian Pasta', 'Grains', 12, 2.49, 29.88, 'store_003', 'Brooklyn Heights Grocery', NULL, NULL, 'emp_003', 'Emma Davis', 'Bulk pasta purchase');

-- Insert sample user store access
INSERT IGNORE INTO `user_store_access` (`user_id`, `store_id`, `access_level`) VALUES
('emp_001', 'store_001', 'write'),
('emp_002', 'store_002', 'write'),
('emp_003', 'store_003', 'write'),
('mgr_001', 'store_001', 'admin'),
('mgr_002', 'store_002', 'admin'),
('mgr_003', 'store_003', 'admin'),
('admin_001', 'store_001', 'admin'),
('admin_001', 'store_002', 'admin'),
('admin_001', 'store_003', 'admin');

-- Insert sample demand forecasting models
INSERT IGNORE INTO `demand_forecasting_models` (`model_name`, `model_type`, `model_accuracy`, `training_status`, `store_id`, `category_id`) VALUES
('Linear Regression Model v1', 'linear_regression', 78.50, 'completed', 'store_001', 1),
('ARIMA Model v1', 'arima', 82.30, 'completed', 'store_001', 2),
('LSTM Deep Learning Model', 'lstm', 85.70, 'completed', 'store_002', 3),
('Prophet Seasonal Model', 'prophet', 79.20, 'completed', 'store_002', 4),
('Ensemble Model v1', 'ensemble', 87.10, 'completed', 'store_003', 5);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Additional performance indexes for analytics tables
CREATE INDEX `idx_performance_analytics_abc` ON `product_performance_analytics` (`abc_classification`, `store_id`);
CREATE INDEX `idx_sales_trends_revenue` ON `product_sales_trends` (`revenue` DESC);
CREATE INDEX `idx_demand_forecasts_accuracy` ON `product_demand_forecasts` (`forecast_accuracy_score` DESC);
CREATE INDEX `idx_reorder_recommendations_urgency_date` ON `product_reorder_recommendations` (`urgency_level`, `recommendation_date`);
CREATE INDEX `idx_inventory_optimization_score` ON `inventory_optimization` (`optimization_score` DESC);

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Create view for product performance summary
CREATE OR REPLACE VIEW `product_performance_summary` AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.category,
    s.name as store_name,
    p.current_stock,
    p.minimum_stock,
    p.unit_price,
    COALESCE(pa.abc_classification, 'C') as abc_classification,
    COALESCE(pa.performance_score, 0) as performance_score,
    COALESCE(pa.sales_velocity, 0) as sales_velocity,
    COALESCE(pa.inventory_turnover, 0) as inventory_turnover,
    CASE 
        WHEN p.current_stock <= 0 THEN 'Out of Stock'
        WHEN p.current_stock <= p.minimum_stock * 0.5 THEN 'Critical Low'
        WHEN p.current_stock <= p.minimum_stock THEN 'Low Stock'
        ELSE 'Normal'
    END as stock_status
FROM products p
JOIN stores s ON p.store_id = s.id
LEFT JOIN product_performance_analytics pa ON p.id = pa.product_id AND p.store_id = pa.store_id
WHERE p.status = 'active';

-- Create view for sales trends summary
CREATE OR REPLACE VIEW `sales_trends_summary` AS
SELECT 
    product_id,
    store_id,
    DATE_FORMAT(trend_date, '%Y-%m') as month,
    SUM(units_sold) as monthly_units_sold,
    SUM(revenue) as monthly_revenue,
    AVG(average_price) as avg_monthly_price,
    COUNT(*) as days_with_sales
FROM product_sales_trends
WHERE trend_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
GROUP BY product_id, store_id, DATE_FORMAT(trend_date, '%Y-%m')
ORDER BY product_id, store_id, month DESC;

-- Commit the transaction
COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Display migration summary
SELECT 
    'Migration completed successfully!' as status,
    (SELECT COUNT(*) FROM stores) as stores_count,
    (SELECT COUNT(*) FROM categories) as categories_count,
    (SELECT COUNT(*) FROM products) as products_count,
    (SELECT COUNT(*) FROM inventory_transactions) as transactions_count,
    (SELECT COUNT(*) FROM demand_forecasting_models) as models_count,
    NOW() as migration_timestamp;

-- Show table status
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'Size_MB'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;
