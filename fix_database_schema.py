#!/usr/bin/env python3
"""
Database Schema Fix for InvenCare Forecasting System

This script fixes the existing database schema to support forecasting functionality
by creating missing tables and adding missing columns to existing tables.
"""

import os
import logging
import mysql.connector
from mysql.connector import Error

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DatabaseSchemaFixer:
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
    
    def add_missing_columns(self):
        """Add missing columns to existing tables"""
        try:
            cursor = self.connection.cursor()
            
            # Check and add missing columns to demand_forecasting_models
            if self.table_exists('demand_forecasting_models'):
                if not self.column_exists('demand_forecasting_models', 'last_training_date'):
                    logger.info("Adding last_training_date column to demand_forecasting_models")
                    cursor.execute("""
                        ALTER TABLE demand_forecasting_models 
                        ADD COLUMN last_training_date TIMESTAMP NULL
                    """)
                
                if not self.column_exists('demand_forecasting_models', 'updated_at'):
                    logger.info("Adding updated_at column to demand_forecasting_models")
                    cursor.execute("""
                        ALTER TABLE demand_forecasting_models 
                        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    """)
            
            # Check and add missing columns to demand_predictions
            if self.table_exists('demand_predictions'):
                if not self.column_exists('demand_predictions', 'updated_at'):
                    logger.info("Adding updated_at column to demand_predictions")
                    cursor.execute("""
                        ALTER TABLE demand_predictions 
                        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    """)
            
            self.connection.commit()
            cursor.close()
            logger.info("Missing columns added successfully")
            return True
            
        except Error as e:
            logger.error(f"Error adding missing columns: {e}")
            self.connection.rollback()
            return False
    
    def create_missing_tables(self):
        """Create missing tables for forecasting functionality"""
        create_statements = {
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
                    INDEX idx_model_metric (model_id, metric_type),
                    INDEX idx_metric_value (metric_type, metric_value),
                    INDEX idx_evaluation_period (evaluation_period_start, evaluation_period_end)
                )
            """
        }
        
        try:
            cursor = self.connection.cursor()
            
            for table_name, create_sql in create_statements.items():
                if not self.table_exists(table_name):
                    logger.info(f"Creating table: {table_name}")
                    cursor.execute(create_sql)
                    logger.info(f"Table {table_name} created successfully")
                else:
                    logger.info(f"Table {table_name} already exists")
            
            self.connection.commit()
            cursor.close()
            logger.info("All missing tables created successfully")
            return True
            
        except Error as e:
            logger.error(f"Error creating tables: {e}")
            self.connection.rollback()
            return False
    
    def fix_schema(self):
        """Fix the complete database schema"""
        logger.info("Starting database schema fix...")
        
        # Add missing columns to existing tables
        if not self.add_missing_columns():
            return False
        
        # Create missing tables
        if not self.create_missing_tables():
            return False
        
        logger.info("Database schema fix completed successfully")
        return True

def main():
    """Main execution function"""
    fixer = DatabaseSchemaFixer()
    
    if not fixer.connect():
        return False
    
    try:
        success = fixer.fix_schema()
        return success
    finally:
        fixer.disconnect()

if __name__ == "__main__":
    if main():
        print("✓ Database schema fixed successfully")
    else:
        print("✗ Database schema fix failed")
        exit(1)
