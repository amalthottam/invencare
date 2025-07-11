#!/usr/bin/env python3
"""
SageMaker Database Connector for InvenCare

This script provides a standalone connector for SageMaker to connect to your RDS database
using your existing pymysql setup. Can be used in SageMaker notebooks, processing jobs,
or as a standalone script.
"""

import pymysql
import pandas as pd
import numpy as np
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SageMakerDatabaseConnector:
    def __init__(self):
        """Initialize with your existing database configuration"""
        self.config = {
            'user': 'admin',
            'password': 'InvenCare123',  # 🔒 Your existing password
            'host': 'invencaredb.cihe2wg8etco.us-east-1.rds.amazonaws.com',
            'database': 'invencare',
            'port': 3306
        }
        
    def get_connection(self):
        """Get database connection using pymysql"""
        try:
            connection = pymysql.connect(**self.config)
            logger.info("✅ Connected to MySQL database!")
            return connection
        except Exception as e:
            logger.error(f"❌ Connection failed: {e}")
            return None
    
    def test_connection(self):
        """Test database connection and show basic info"""
        connection = self.get_connection()
        if not connection:
            return False
        
        try:
            with connection.cursor() as cursor:
                # Test basic queries
                cursor.execute("SELECT COUNT(*) FROM stores WHERE status = 'active'")
                store_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM products WHERE status = 'active'")
                product_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM inventory_transactions")
                transaction_count = cursor.fetchone()[0]
                
                logger.info(f"🏪 Active Stores: {store_count}")
                logger.info(f"📦 Active Products: {product_count}")
                logger.info(f"💼 Total Transactions: {transaction_count}")
                
                return True
                
        except Exception as e:
            logger.error(f"❌ Test query failed: {e}")
            return False
        
        finally:
            if connection and connection.open:
                connection.close()
    
    def load_products_data(self) -> pd.DataFrame:
        """Load products data as DataFrame"""
        connection = self.get_connection()
        if not connection:
            return pd.DataFrame()
        
        try:
            query = """
            SELECT p.id, p.name, p.category, p.price, p.quantity, p.minimum_stock,
                   p.store_id, s.name as store_name, p.status
            FROM products p
            JOIN stores s ON p.store_id = s.id
            WHERE p.status = 'active' AND s.status = 'active'
            """
            
            df = pd.read_sql(query, connection)
            logger.info(f"📦 Loaded {len(df)} products")
            return df
            
        except Exception as e:
            logger.error(f"❌ Error loading products: {e}")
            return pd.DataFrame()
        
        finally:
            if connection and connection.open:
                connection.close()
    
    def load_transactions_data(self, days: int = 90) -> pd.DataFrame:
        """Load transaction data for specified number of days"""
        connection = self.get_connection()
        if not connection:
            return pd.DataFrame()
        
        try:
            query = """
            SELECT it.product_id, it.store_id, it.transaction_type, it.quantity,
                   it.total_amount, it.created_at, p.name as product_name, 
                   p.category, s.name as store_name
            FROM inventory_transactions it
            JOIN products p ON it.product_id = p.id
            JOIN stores s ON it.store_id = s.id
            WHERE it.created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
            ORDER BY it.created_at DESC
            """
            
            df = pd.read_sql(query, connection, params=(days,))
            logger.info(f"💼 Loaded {len(df)} transactions from last {days} days")
            return df
            
        except Exception as e:
            logger.error(f"❌ Error loading transactions: {e}")
            return pd.DataFrame()
        
        finally:
            if connection and connection.open:
                connection.close()
    
    def create_forecasting_tables(self) -> bool:
        """Create forecasting tables if they don't exist"""
        connection = self.get_connection()
        if not connection:
            return False
        
        try:
            with connection.cursor() as cursor:
                # Create demand_forecasting_models table
                models_table = """
                CREATE TABLE IF NOT EXISTS demand_forecasting_models (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    model_name VARCHAR(255) NOT NULL UNIQUE,
                    model_type ENUM('arima', 'lstm', 'prophet', 'linear_regression') NOT NULL,
                    sagemaker_endpoint VARCHAR(255),
                    model_accuracy DECIMAL(5,4),
                    training_status ENUM('training', 'deployed', 'failed') DEFAULT 'training',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """
                cursor.execute(models_table)
                logger.info("✅ Created/verified demand_forecasting_models table")
                
                # Create demand_predictions table
                predictions_table = """
                CREATE TABLE IF NOT EXISTS demand_predictions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    product_id INT NOT NULL,
                    store_id VARCHAR(50) NOT NULL,
                    model_id INT NOT NULL,
                    prediction_date DATE NOT NULL,
                    predicted_demand DECIMAL(10,2) NOT NULL,
                    confidence_interval_lower DECIMAL(10,2),
                    confidence_interval_upper DECIMAL(10,2),
                    factors JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_id) REFERENCES products(id),
                    FOREIGN KEY (store_id) REFERENCES stores(id),
                    UNIQUE KEY unique_prediction (product_id, store_id, model_id, prediction_date)
                )
                """
                cursor.execute(predictions_table)
                logger.info("✅ Created/verified demand_predictions table")
                
            connection.commit()
            return True
            
        except Exception as e:
            logger.error(f"❌ Error creating tables: {e}")
            connection.rollback()
            return False
        
        finally:
            if connection and connection.open:
                connection.close()
    
    def insert_predictions(self, predictions: List[Dict], product_id: int, store_id: str, model_id: int = 1) -> int:
        """Insert demand predictions into database"""
        if not predictions:
            return 0
        
        connection = self.get_connection()
        if not connection:
            return 0
        
        try:
            with connection.cursor() as cursor:
                query = """
                INSERT INTO demand_predictions 
                (product_id, store_id, model_id, prediction_date, predicted_demand,
                 confidence_interval_lower, confidence_interval_upper, factors)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                predicted_demand = VALUES(predicted_demand),
                confidence_interval_lower = VALUES(confidence_interval_lower),
                confidence_interval_upper = VALUES(confidence_interval_upper),
                factors = VALUES(factors)
                """
                
                for pred in predictions:
                    cursor.execute(query, (
                        product_id,
                        store_id,
                        model_id,
                        pred['prediction_date'],
                        pred['predicted_demand'],
                        pred['confidence_interval_lower'],
                        pred['confidence_interval_upper'],
                        json.dumps(pred['factors'])
                    ))
                
                connection.commit()
                logger.info(f"✅ Inserted {len(predictions)} predictions for product {product_id}")
                return len(predictions)
                
        except Exception as e:
            logger.error(f"❌ Error inserting predictions: {e}")
            connection.rollback()
            return 0
        
        finally:
            if connection and connection.open:
                connection.close()
    
    def get_product_sales_history(self, product_id: int, store_id: str, days: int = 60) -> pd.DataFrame:
        """Get sales history for a specific product and store"""
        connection = self.get_connection()
        if not connection:
            return pd.DataFrame()
        
        try:
            with connection.cursor() as cursor:
                query = """
                SELECT DATE(created_at) as date, 
                       SUM(CASE WHEN transaction_type = 'sale' THEN ABS(quantity) ELSE 0 END) as demand
                FROM inventory_transactions 
                WHERE product_id = %s AND store_id = %s 
                AND created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
                GROUP BY DATE(created_at)
                ORDER BY date
                """
                
                cursor.execute(query, (product_id, store_id, days))
                results = cursor.fetchall()
                
                if not results:
                    return pd.DataFrame()
                
                # Create DataFrame
                df = pd.DataFrame(results, columns=['date', 'demand'])
                df['date'] = pd.to_datetime(df['date'])
                
                # Add time features
                df['day_of_week'] = df['date'].dt.dayofweek
                df['day_of_month'] = df['date'].dt.day
                df['month'] = df['date'].dt.month
                df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
                
                return df
                
        except Exception as e:
            logger.error(f"❌ Error getting sales history: {e}")
            return pd.DataFrame()
        
        finally:
            if connection and connection.open:
                connection.close()
    
    def register_forecasting_model(self, model_name: str, model_type: str, accuracy: float = 0.75) -> bool:
        """Register a forecasting model in the database"""
        connection = self.get_connection()
        if not connection:
            return False
        
        try:
            with connection.cursor() as cursor:
                query = """
                INSERT IGNORE INTO demand_forecasting_models 
                (model_name, model_type, model_accuracy, training_status)
                VALUES (%s, %s, %s, 'deployed')
                """
                
                cursor.execute(query, (model_name, model_type, accuracy))
                connection.commit()
                
                logger.info(f"✅ Registered model: {model_name}")
                return True
                
        except Exception as e:
            logger.error(f"❌ Error registering model: {e}")
            connection.rollback()
            return False
        
        finally:
            if connection and connection.open:
                connection.close()
    
    def get_current_predictions(self, days_ahead: int = 14) -> pd.DataFrame:
        """Get current predictions from database"""
        connection = self.get_connection()
        if not connection:
            return pd.DataFrame()
        
        try:
            query = """
            SELECT dp.prediction_date, dp.predicted_demand, 
                   dp.confidence_interval_lower, dp.confidence_interval_upper,
                   p.name as product_name, s.name as store_name,
                   p.category, dp.factors
            FROM demand_predictions dp
            JOIN products p ON dp.product_id = p.id
            JOIN stores s ON dp.store_id = s.id
            WHERE dp.prediction_date >= CURDATE()
            AND dp.prediction_date <= DATE_ADD(CURDATE(), INTERVAL %s DAY)
            ORDER BY dp.prediction_date, p.name
            """
            
            df = pd.read_sql(query, connection, params=(days_ahead,))
            logger.info(f"📊 Loaded {len(df)} current predictions")
            return df
            
        except Exception as e:
            logger.error(f"❌ Error loading predictions: {e}")
            return pd.DataFrame()
        
        finally:
            if connection and connection.open:
                connection.close()

# Simple forecasting function
def generate_simple_forecast(historical_data: pd.DataFrame, forecast_days: int = 30) -> List[Dict]:
    """Generate simple statistical forecast from historical data"""
    if historical_data is None or len(historical_data) < 5:
        return []
    
    # Calculate moving averages
    ma_7 = historical_data['demand'].rolling(window=min(7, len(historical_data)), min_periods=1).mean().iloc[-1]
    ma_14 = historical_data['demand'].rolling(window=min(14, len(historical_data)), min_periods=1).mean().iloc[-1]
    
    # Calculate trend
    if len(historical_data) >= 10:
        recent_avg = historical_data['demand'].tail(5).mean()
        older_avg = historical_data['demand'].head(5).mean()
        trend = (recent_avg - older_avg) / max(older_avg, 1)
    else:
        trend = 0
    
    # Weekly seasonality
    weekly_pattern = historical_data.groupby('day_of_week')['demand'].mean()
    weekly_avg = weekly_pattern.mean() if len(weekly_pattern) > 0 else 1
    seasonality_factors = (weekly_pattern / max(weekly_avg, 1)).to_dict()
    
    # Generate predictions
    predictions = []
    base_date = historical_data['date'].max()
    std_dev = historical_data['demand'].std()
    
    for i in range(1, forecast_days + 1):
        pred_date = base_date + timedelta(days=i)
        day_of_week = pred_date.dayofweek
        
        # Base prediction
        base_demand = 0.6 * ma_7 + 0.4 * ma_14
        
        # Apply trend
        trend_factor = 1 + (trend * i / 30)
        
        # Apply seasonality
        seasonal_factor = seasonality_factors.get(day_of_week, 1.0)
        
        # Final prediction
        predicted_demand = max(0, base_demand * trend_factor * seasonal_factor)
        
        # Confidence intervals
        confidence_lower = max(0, predicted_demand - 1.96 * std_dev)
        confidence_upper = predicted_demand + 1.96 * std_dev
        
        predictions.append({
            'prediction_date': pred_date.strftime('%Y-%m-%d'),
            'predicted_demand': round(predicted_demand, 2),
            'confidence_interval_lower': round(confidence_lower, 2),
            'confidence_interval_upper': round(confidence_upper, 2),
            'factors': {
                'base_demand': round(base_demand, 2),
                'trend_factor': round(trend_factor, 3),
                'seasonal_factor': round(seasonal_factor, 3)
            }
        })
    
    return predictions

# Main function for standalone execution
def main():
    """Main function for standalone execution"""
    print("🚀 SageMaker Database Connector Test")
    print("=" * 40)
    
    # Initialize connector
    connector = SageMakerDatabaseConnector()
    
    # Test connection
    print("1. Testing database connection...")
    if not connector.test_connection():
        print("❌ Database connection failed - exiting")
        return
    
    # Create tables
    print("\n2. Creating forecasting tables...")
    if not connector.create_forecasting_tables():
        print("❌ Table creation failed - exiting")
        return
    
    # Register a model
    print("\n3. Registering forecasting model...")
    connector.register_forecasting_model(
        "SageMaker_Test_Model", 
        "linear_regression", 
        0.75
    )
    
    # Load some data
    print("\n4. Loading data...")
    products_df = connector.load_products_data()
    transactions_df = connector.load_transactions_data(30)
    
    if len(products_df) > 0:
        print(f"✅ Loaded {len(products_df)} products")
        print(f"✅ Loaded {len(transactions_df)} transactions")
        
        # Generate a sample forecast for the first product
        if len(products_df) > 0:
            first_product = products_df.iloc[0]
            print(f"\n5. Generating forecast for: {first_product['name']}")
            
            # Get historical data
            historical_data = connector.get_product_sales_history(
                first_product['id'], 
                first_product['store_id'],
                days=30
            )
            
            if len(historical_data) > 0:
                print(f"✅ Found {len(historical_data)} days of historical data")
                
                # Generate forecast
                predictions = generate_simple_forecast(historical_data, 7)
                
                if predictions:
                    print(f"✅ Generated {len(predictions)} predictions")
                    
                    # Insert into database
                    inserted = connector.insert_predictions(
                        predictions, 
                        first_product['id'], 
                        first_product['store_id'],
                        model_id=1
                    )
                    
                    print(f"✅ Inserted {inserted} predictions into database")
                    
                    # Show sample predictions
                    print("\n📊 Sample predictions:")
                    for pred in predictions[:3]:
                        print(f"  {pred['prediction_date']}: {pred['predicted_demand']:.1f} units")
                else:
                    print("⚠️ No predictions generated")
            else:
                print("⚠️ No historical data found")
    
    print("\n🎉 Test completed successfully!")
    print("📊 Check your /forecasting dashboard to see the results")

if __name__ == "__main__":
    main()
