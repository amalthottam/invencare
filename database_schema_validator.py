#!/usr/bin/env python3
"""
Database Schema Validator for InvenCare Forecasting System

This script validates and ensures all required tables and columns exist
for the forecasting functionality. Run this before using the SageMaker updater.

Usage:
    python database_schema_validator.py [--create-missing]
"""

import os
import sys
import argparse
import logging
import mysql.connector
from mysql.connector import Error

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DatabaseSchemaValidator:
    def __init__(self):
        self.db_config = {
            'host': os.getenv('RDS_HOSTNAME', 'invencaredb.cihe2wg8etco.us-east-1.rds.amazonaws.com'),
            'user': os.getenv('RDS_USERNAME', 'admin'),
            'password': os.getenv('RDS_PASSWORD', 'InvenCare123'),
            'database': os.getenv('RDS_DB_NAME', 'invencare'),
            'port': int(os.getenv('RDS_PORT', 3306))
        }
        self.connection = None
    
    def connect(self):
        """Connect to database"""
        try:
            self.connection = mysql.connector.connect(**self.db_config)
            logger.info("Connected to database successfully")
            return True
        except Error as e:
            logger.error(f"Database connection failed: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from database"""
        if self.connection and self.connection.is_connected():
            self.connection.close()
            logger.info("Database connection closed")
    
    def table_exists(self, table_name):
        """Check if a table exists"""
        try:
            cursor = self.connection.cursor()
            cursor.execute(f"SHOW TABLES LIKE '{table_name}'")
            result = cursor.fetchone()
            cursor.close()
            return result is not None
        except Error as e:
            logger.error(f"Error checking table {table_name}: {e}")
            return False
    
    def column_exists(self, table_name, column_name):
        """Check if a column exists in a table"""
        try:
            cursor = self.connection.cursor()
            cursor.execute(f"SHOW COLUMNS FROM {table_name} LIKE '{column_name}'")
            result = cursor.fetchone()
            cursor.close()
            return result is not None
        except Error as e:
            logger.error(f"Error checking column {column_name} in {table_name}: {e}")
            return False
    
    def get_required_tables(self):
        """Get list of required tables and their essential columns for forecasting"""
        return {
            'stores': [
                'id', 'name', 'status', 'created_at', 'updated_at'
            ],
            'products': [
                'id', 'name', 'price', 'quantity', 'category', 'store_id', 
                'minimum_stock', 'status', 'created_at', 'updated_at'
            ],
            'demand_forecasting_models': [
                'id', 'model_name', 'model_type', 'sagemaker_endpoint',
                'model_accuracy', 'training_status', 'created_at', 'updated_at'
            ],
            'demand_predictions': [
                'id', 'product_id', 'store_id', 'model_id', 'prediction_date',
                'predicted_demand', 'confidence_interval_lower', 'confidence_interval_upper',
                'created_at', 'updated_at'
            ],
            'seasonal_trends': [
                'id', 'product_id', 'store_id', 'trend_type', 'trend_strength',
                'analysis_date', 'created_at'
            ],
            'optimization_recommendations': [
                'id', 'product_id', 'store_id', 'recommendation_type', 'priority',
                'impact_score', 'confidence_score', 'created_at'
            ],
            'model_performance_metrics': [
                'id', 'model_id', 'metric_type', 'metric_value',
                'evaluation_period_start', 'evaluation_period_end', 'created_at'
            ]
        }
    
    def validate_schema(self):
        """Validate that all required tables and columns exist"""
        required_tables = self.get_required_tables()
        validation_results = {}
        
        for table_name, required_columns in required_tables.items():
            logger.info(f"Validating table: {table_name}")
            
            table_result = {
                'exists': self.table_exists(table_name),
                'missing_columns': [],
                'existing_columns': []
            }
            
            if table_result['exists']:
                for column in required_columns:
                    if self.column_exists(table_name, column):
                        table_result['existing_columns'].append(column)
                    else:
                        table_result['missing_columns'].append(column)
            
            validation_results[table_name] = table_result
        
        return validation_results
    
    def create_missing_tables(self):
        """Create missing tables required for forecasting"""
        create_statements = {
            'demand_forecasting_models': """
                CREATE TABLE IF NOT EXISTS demand_forecasting_models (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    model_name VARCHAR(255) NOT NULL UNIQUE,
                    model_type ENUM('arima', 'lstm', 'prophet', 'linear_regression') NOT NULL,
                    sagemaker_endpoint VARCHAR(255),
                    model_artifacts_s3_path VARCHAR(500),
                    model_accuracy DECIMAL(5,4),
                    training_status ENUM('training', 'deployed', 'failed') DEFAULT 'training',
                    store_id VARCHAR(50) NULL,
                    category_id VARCHAR(100) NULL,
                    last_training_date TIMESTAMP NULL,
                    hyperparameters JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_model_type (model_type),
                    INDEX idx_training_status (training_status),
                    INDEX idx_store_category (store_id, category_id)
                )
            """,
            'demand_predictions': """
                CREATE TABLE IF NOT EXISTS demand_predictions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    product_id INT NOT NULL,
                    store_id VARCHAR(50) NOT NULL,
                    model_id INT NOT NULL,
                    prediction_date DATE NOT NULL,
                    predicted_demand DECIMAL(10,2) NOT NULL,
                    confidence_interval_lower DECIMAL(10,2),
                    confidence_interval_upper DECIMAL(10,2),
                    actual_demand DECIMAL(10,2) NULL,
                    prediction_accuracy DECIMAL(5,4) NULL,
                    factors JSON,
                    lambda_execution_id VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_id) REFERENCES products(id),
                    FOREIGN KEY (store_id) REFERENCES stores(id),
                    FOREIGN KEY (model_id) REFERENCES demand_forecasting_models(id),
                    INDEX idx_product_date (product_id, prediction_date),
                    INDEX idx_store_date (store_id, prediction_date),
                    INDEX idx_model_execution (model_id, lambda_execution_id),
                    UNIQUE KEY unique_prediction (product_id, store_id, model_id, prediction_date)
                )
            """,
            'seasonal_trends': """
                CREATE TABLE IF NOT EXISTS seasonal_trends (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    product_id INT NOT NULL,
                    store_id VARCHAR(50) NOT NULL,
                    trend_type ENUM('seasonal', 'weekly', 'monthly', 'yearly') NOT NULL,
                    trend_period VARCHAR(100),
                    trend_strength DECIMAL(5,4),
                    peak_periods JSON,
                    analysis_date DATE NOT NULL,
                    sagemaker_job_name VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_id) REFERENCES products(id),
                    FOREIGN KEY (store_id) REFERENCES stores(id),
                    INDEX idx_product_trend (product_id, trend_type),
                    INDEX idx_store_trend (store_id, trend_type),
                    INDEX idx_trend_type (trend_type, trend_period),
                    INDEX idx_sagemaker_job (sagemaker_job_name)
                )
            """,
            'optimization_recommendations': """
                CREATE TABLE IF NOT EXISTS optimization_recommendations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    product_id INT NOT NULL,
                    store_id VARCHAR(50) NOT NULL,
                    recommendation_type ENUM('reorder', 'transfer', 'markdown', 'promotion') NOT NULL,
                    priority ENUM('high', 'medium', 'low') DEFAULT 'medium',
                    recommended_action TEXT NOT NULL,
                    impact_score DECIMAL(5,4),
                    confidence_score DECIMAL(5,4),
                    estimated_benefit DECIMAL(12,2),
                    analysis_period_start DATE NOT NULL,
                    analysis_period_end DATE NOT NULL,
                    ml_model_version VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_id) REFERENCES products(id),
                    FOREIGN KEY (store_id) REFERENCES stores(id),
                    INDEX idx_product_recommendation (product_id, recommendation_type),
                    INDEX idx_store_priority (store_id, priority),
                    INDEX idx_recommendation_type (recommendation_type)
                )
            """,
            'model_performance_metrics': """
                CREATE TABLE IF NOT EXISTS model_performance_metrics (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    model_id INT NOT NULL,
                    metric_type ENUM('mse', 'mae', 'mape', 'rmse', 'r2') NOT NULL,
                    metric_value DECIMAL(10,6) NOT NULL,
                    evaluation_period_start DATE NOT NULL,
                    evaluation_period_end DATE NOT NULL,
                    sagemaker_training_job VARCHAR(100),
                    hyperparameters JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (model_id) REFERENCES demand_forecasting_models(id),
                    INDEX idx_model_metric (model_id, metric_type),
                    INDEX idx_metric_value (metric_type, metric_value),
                    INDEX idx_evaluation_period (evaluation_period_start, evaluation_period_end)
                )
            """
        }
        
        try:
            cursor = self.connection.cursor()
            
            for table_name, create_sql in create_statements.items():
                logger.info(f"Creating table: {table_name}")
                cursor.execute(create_sql)
                logger.info(f"Table {table_name} created successfully")
            
            self.connection.commit()
            cursor.close()
            logger.info("All missing tables created successfully")
            return True
            
        except Error as e:
            logger.error(f"Error creating tables: {e}")
            self.connection.rollback()
            return False
    
    def print_validation_report(self, validation_results):
        """Print a detailed validation report"""
        print("\n" + "="*60)
        print("DATABASE SCHEMA VALIDATION REPORT")
        print("="*60)
        
        all_valid = True
        
        for table_name, result in validation_results.items():
            print(f"\nTable: {table_name}")
            print("-" * 40)
            
            if result['exists']:
                print(f"✓ Table exists")
                
                if result['missing_columns']:
                    print(f"✗ Missing columns: {', '.join(result['missing_columns'])}")
                    all_valid = False
                else:
                    print(f"✓ All required columns present")
                
                if result['existing_columns']:
                    print(f"  Existing columns: {', '.join(result['existing_columns'])}")
            else:
                print(f"✗ Table does not exist")
                all_valid = False
        
        print("\n" + "="*60)
        if all_valid:
            print("✓ DATABASE SCHEMA IS VALID FOR FORECASTING")
        else:
            print("✗ DATABASE SCHEMA REQUIRES UPDATES")
        print("="*60)
        
        return all_valid

def main():
    parser = argparse.ArgumentParser(description='Validate database schema for forecasting')
    parser.add_argument('--create-missing', action='store_true',
                       help='Create missing tables and columns')
    args = parser.parse_args()
    
    validator = DatabaseSchemaValidator()
    
    if not validator.connect():
        sys.exit(1)
    
    try:
        # Validate current schema
        validation_results = validator.validate_schema()
        is_valid = validator.print_validation_report(validation_results)
        
        if not is_valid and args.create_missing:
            print("\nCreating missing tables...")
            if validator.create_missing_tables():
                print("✓ Missing tables created successfully")
                
                # Re-validate after creation
                print("\nRe-validating schema...")
                validation_results = validator.validate_schema()
                validator.print_validation_report(validation_results)
            else:
                print("✗ Failed to create missing tables")
                sys.exit(1)
        
        elif not is_valid:
            print("\nTo create missing tables, run with --create-missing flag")
            sys.exit(1)
    
    finally:
        validator.disconnect()

if __name__ == "__main__":
    main()
