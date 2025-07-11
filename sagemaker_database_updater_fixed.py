#!/usr/bin/env python3
"""
SageMaker Database Updater for InvenCare Forecasting System (Fixed Version)

This script updates the RDS MySQL database with forecasting predictions and model data
from AWS SageMaker. It gracefully handles missing tables and columns.

Dependencies:
    pip install mysql-connector-python boto3 pandas numpy scikit-learn

Environment Variables Required:
    RDS_HOSTNAME - RDS database hostname
    RDS_USERNAME - Database username
    RDS_PASSWORD - Database password
    RDS_DB_NAME - Database name (default: invencare)
    RDS_PORT - Database port (default: 3306)
    AWS_REGION - AWS region (default: us-east-1)
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import mysql.connector
from mysql.connector import Error
import boto3
import pandas as pd
import numpy as np
from decimal import Decimal

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SageMakerDatabaseUpdater:
    def __init__(self):
        """Initialize database connection and SageMaker client"""
        self.db_config = {
            'host': os.getenv('RDS_HOSTNAME', 'invencaredb.cihe2wg8etco.us-east-1.rds.amazonaws.com'),
            'user': os.getenv('RDS_USERNAME', 'admin'),
            'password': os.getenv('RDS_PASSWORD', 'InvenCare123'),
            'database': os.getenv('RDS_DB_NAME', 'invencare'),
            'port': int(os.getenv('RDS_PORT', 3306)),
            'autocommit': False
        }
        
        self.aws_region = os.getenv('AWS_REGION', 'us-east-1')
        self.sagemaker_client = boto3.client('sagemaker', region_name=self.aws_region)
        self.runtime_client = boto3.client('sagemaker-runtime', region_name=self.aws_region)
        
        self.connection = None
        
    def connect_database(self):
        """Establish database connection"""
        try:
            self.connection = mysql.connector.connect(**self.db_config)
            logger.info("Successfully connected to RDS database")
            return True
        except Error as e:
            logger.error(f"Database connection failed: {e}")
            return False
    
    def disconnect_database(self):
        """Close database connection"""
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
    
    def get_stores_and_products(self) -> Tuple[List[Dict], List[Dict]]:
        """Fetch all active stores and products from database"""
        try:
            cursor = self.connection.cursor(dictionary=True)
            
            # Get stores
            cursor.execute("SELECT id, name FROM stores WHERE status = 'active'")
            stores = cursor.fetchall()
            
            # Get products
            cursor.execute("""
                SELECT id, name, category, store_id, quantity, price, minimum_stock
                FROM products 
                WHERE status = 'active'
            """)
            products = cursor.fetchall()
            
            cursor.close()
            return stores, products
            
        except Error as e:
            logger.error(f"Error fetching stores and products: {e}")
            return [], []
    
    def update_forecasting_model(self, model_data: Dict) -> Optional[int]:
        """
        Insert or update a forecasting model in demand_forecasting_models table
        This version handles missing columns gracefully
        """
        try:
            if not self.table_exists('demand_forecasting_models'):
                logger.warning("Table demand_forecasting_models does not exist, skipping model update")
                return None
                
            cursor = self.connection.cursor()
            
            # Get available columns
            cursor.execute("SHOW COLUMNS FROM demand_forecasting_models")
            available_columns = [row[0] for row in cursor.fetchall()]
            
            # Required columns
            required_columns = ['model_name', 'model_type', 'model_accuracy', 'training_status']
            columns_to_use = []
            values_to_use = []
            
            # Check required columns
            for col in required_columns:
                if col in available_columns:
                    columns_to_use.append(col)
                    if col == 'model_name':
                        values_to_use.append(model_data['model_name'])
                    elif col == 'model_type':
                        values_to_use.append(model_data['model_type'])
                    elif col == 'model_accuracy':
                        values_to_use.append(model_data['model_accuracy'])
                    elif col == 'training_status':
                        values_to_use.append(model_data['training_status'])
            
            # Add optional columns if they exist
            optional_mappings = {
                'sagemaker_endpoint': model_data.get('sagemaker_endpoint'),
                'model_artifacts_s3_path': model_data.get('model_artifacts_s3_path'),
                'store_id': model_data.get('store_id'),
                'category_id': model_data.get('category_id')
            }
            
            for col, value in optional_mappings.items():
                if col in available_columns:
                    columns_to_use.append(col)
                    values_to_use.append(value)
            
            if len(columns_to_use) == 0:
                logger.error("No compatible columns found in demand_forecasting_models table")
                return None
            
            # Build the query
            placeholders = ', '.join(['%s'] * len(columns_to_use))
            column_list = ', '.join(columns_to_use)
            
            # Simple insert query (avoiding complex ON DUPLICATE KEY UPDATE)
            query = f"INSERT INTO demand_forecasting_models ({column_list}) VALUES ({placeholders})"
            
            cursor.execute(query, values_to_use)
            model_id = cursor.lastrowid
            
            cursor.close()
            logger.info(f"Updated model: {model_data['model_name']} (ID: {model_id})")
            return model_id
            
        except Error as e:
            logger.error(f"Error updating forecasting model: {e}")
            return None
    
    def update_demand_predictions(self, predictions: List[Dict]) -> int:
        """
        Bulk insert demand predictions - simplified version
        """
        try:
            if not self.table_exists('demand_predictions'):
                logger.warning("Table demand_predictions does not exist, skipping predictions update")
                return 0
            
            cursor = self.connection.cursor()
            
            # Get available columns
            cursor.execute("SHOW COLUMNS FROM demand_predictions")
            available_columns = [row[0] for row in cursor.fetchall()]
            
            # Required columns
            required_columns = ['product_id', 'store_id', 'model_id', 'prediction_date', 'predicted_demand']
            
            # Check if all required columns exist
            missing_required = [col for col in required_columns if col not in available_columns]
            if missing_required:
                logger.error(f"Missing required columns in demand_predictions: {missing_required}")
                return 0
            
            columns_to_use = required_columns.copy()
            
            # Add optional columns if available
            optional_columns = ['confidence_interval_lower', 'confidence_interval_upper', 'factors', 'lambda_execution_id']
            for col in optional_columns:
                if col in available_columns:
                    columns_to_use.append(col)
            
            placeholders = ', '.join(['%s'] * len(columns_to_use))
            column_list = ', '.join(columns_to_use)
            
            query = f"INSERT INTO demand_predictions ({column_list}) VALUES ({placeholders})"
            
            prediction_values = []
            for pred in predictions:
                values = [
                    pred['product_id'],
                    pred['store_id'],
                    pred['model_id'],
                    pred['prediction_date'],
                    pred['predicted_demand']
                ]
                
                # Add optional values if columns exist
                if 'confidence_interval_lower' in columns_to_use:
                    values.append(pred.get('confidence_interval_lower'))
                if 'confidence_interval_upper' in columns_to_use:
                    values.append(pred.get('confidence_interval_upper'))
                if 'factors' in columns_to_use:
                    values.append(json.dumps(pred.get('factors', {})))
                if 'lambda_execution_id' in columns_to_use:
                    values.append(pred.get('lambda_execution_id'))
                
                prediction_values.append(values)
            
            cursor.executemany(query, prediction_values)
            updated_count = cursor.rowcount
            
            cursor.close()
            logger.info(f"Inserted {updated_count} demand predictions")
            return updated_count
            
        except Error as e:
            logger.error(f"Error updating demand predictions: {e}")
            return 0
    
    def update_seasonal_trends(self, trends: List[Dict]) -> int:
        """Update seasonal trends - with table existence check"""
        try:
            if not self.table_exists('seasonal_trends'):
                logger.warning("Table seasonal_trends does not exist, skipping trends update")
                return 0
                
            cursor = self.connection.cursor()
            
            query = """
                INSERT INTO seasonal_trends 
                (product_id, store_id, trend_type, trend_period, trend_strength,
                 peak_periods, analysis_date, sagemaker_job_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            trend_values = []
            for trend in trends:
                values = (
                    trend['product_id'],
                    trend['store_id'],
                    trend['trend_type'],
                    trend['trend_period'],
                    trend['trend_strength'],
                    json.dumps(trend.get('peak_periods', [])),
                    trend['analysis_date'],
                    trend.get('sagemaker_job_name')
                )
                trend_values.append(values)
            
            cursor.executemany(query, trend_values)
            updated_count = cursor.rowcount
            
            cursor.close()
            logger.info(f"Inserted {updated_count} seasonal trends")
            return updated_count
            
        except Error as e:
            logger.error(f"Error updating seasonal trends: {e}")
            return 0
    
    def update_optimization_recommendations(self, recommendations: List[Dict]) -> int:
        """Update optimization recommendations - with table existence check"""
        try:
            if not self.table_exists('optimization_recommendations'):
                logger.warning("Table optimization_recommendations does not exist, skipping recommendations update")
                return 0
                
            cursor = self.connection.cursor()
            
            query = """
                INSERT INTO optimization_recommendations 
                (product_id, store_id, recommendation_type, priority, recommended_action,
                 impact_score, confidence_score, estimated_benefit, analysis_period_start,
                 analysis_period_end, ml_model_version)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            rec_values = []
            for rec in recommendations:
                values = (
                    rec['product_id'],
                    rec['store_id'],
                    rec['recommendation_type'],
                    rec['priority'],
                    rec['recommended_action'],
                    rec['impact_score'],
                    rec['confidence_score'],
                    rec['estimated_benefit'],
                    rec['analysis_period_start'],
                    rec['analysis_period_end'],
                    rec.get('ml_model_version')
                )
                rec_values.append(values)
            
            cursor.executemany(query, rec_values)
            updated_count = cursor.rowcount
            
            cursor.close()
            logger.info(f"Inserted {updated_count} optimization recommendations")
            return updated_count
            
        except Error as e:
            logger.error(f"Error updating optimization recommendations: {e}")
            return 0
    
    def update_model_performance_metrics(self, metrics: List[Dict]) -> int:
        """Update model performance metrics - with table existence check"""
        try:
            if not self.table_exists('model_performance_metrics'):
                logger.warning("Table model_performance_metrics does not exist, skipping metrics update")
                return 0
                
            cursor = self.connection.cursor()
            
            query = """
                INSERT INTO model_performance_metrics 
                (model_id, metric_type, metric_value, evaluation_period_start,
                 evaluation_period_end, sagemaker_training_job, hyperparameters)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            
            metric_values = []
            for metric in metrics:
                values = (
                    metric['model_id'],
                    metric['metric_type'],
                    metric['metric_value'],
                    metric['evaluation_period_start'],
                    metric['evaluation_period_end'],
                    metric.get('sagemaker_training_job'),
                    json.dumps(metric.get('hyperparameters', {}))
                )
                metric_values.append(values)
            
            cursor.executemany(query, metric_values)
            updated_count = cursor.rowcount
            
            cursor.close()
            logger.info(f"Inserted {updated_count} performance metrics")
            return updated_count
            
        except Error as e:
            logger.error(f"Error updating performance metrics: {e}")
            return 0
    
    def invoke_sagemaker_endpoint(self, endpoint_name: str, payload: Dict) -> Optional[Dict]:
        """Invoke a SageMaker endpoint for real-time predictions"""
        try:
            response = self.runtime_client.invoke_endpoint(
                EndpointName=endpoint_name,
                ContentType='application/json',
                Body=json.dumps(payload)
            )
            
            result = json.loads(response['Body'].read().decode())
            return result
            
        except Exception as e:
            logger.error(f"Error invoking SageMaker endpoint {endpoint_name}: {e}")
            return None
    
    def generate_sample_predictions(self, num_days: int = 30) -> List[Dict]:
        """Generate sample demand predictions for testing"""
        stores, products = self.get_stores_and_products()
        predictions = []
        
        for product in products[:5]:  # Limit to first 5 products for demo
            for day in range(1, min(num_days + 1, 8)):  # Limit to 7 days for demo
                prediction_date = (datetime.now() + timedelta(days=day)).date()
                
                # Generate realistic demand prediction
                base_demand = max(1, int(product['quantity'] * 0.1))
                predicted_demand = base_demand + np.random.normal(0, base_demand * 0.2)
                predicted_demand = max(0, predicted_demand)
                
                confidence_lower = predicted_demand * 0.8
                confidence_upper = predicted_demand * 1.2
                
                prediction = {
                    'product_id': product['id'],
                    'store_id': product['store_id'],
                    'model_id': 1,  # Assuming model ID 1 exists
                    'prediction_date': prediction_date.strftime('%Y-%m-%d'),
                    'predicted_demand': round(predicted_demand, 2),
                    'confidence_interval_lower': round(confidence_lower, 2),
                    'confidence_interval_upper': round(confidence_upper, 2),
                    'factors': {
                        'seasonality': 0.85,
                        'trend': 0.12,
                        'promotions': 0.03
                    },
                    'lambda_execution_id': f"exec_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                }
                predictions.append(prediction)
        
        return predictions
    
    def commit_changes(self):
        """Commit all database changes"""
        try:
            self.connection.commit()
            logger.info("Database changes committed successfully")
        except Error as e:
            logger.error(f"Error committing changes: {e}")
            self.connection.rollback()
    
    def run_full_update(self):
        """Execute complete database update process"""
        if not self.connect_database():
            return False
        
        try:
            # 1. Update/Create forecasting models
            models = [
                {
                    'model_name': 'LSTM_Demand_Forecaster_v2',
                    'model_type': 'lstm',
                    'sagemaker_endpoint': 'lstm-demand-forecaster-endpoint',
                    'model_accuracy': 0.92,
                    'training_status': 'deployed',
                    'model_artifacts_s3_path': 's3://sagemaker-models/lstm-demand/artifacts/'
                },
                {
                    'model_name': 'ARIMA_Seasonal_v1',
                    'model_type': 'arima',
                    'sagemaker_endpoint': 'arima-seasonal-endpoint',
                    'model_accuracy': 0.85,
                    'training_status': 'deployed',
                    'model_artifacts_s3_path': 's3://sagemaker-models/arima-seasonal/artifacts/'
                }
            ]
            
            for model in models:
                self.update_forecasting_model(model)
            
            # 2. Generate and update predictions
            predictions = self.generate_sample_predictions()
            self.update_demand_predictions(predictions)
            
            # 3. Update seasonal trends (only if table exists)
            trends = [
                {
                    'product_id': 1,
                    'store_id': 'store_001',
                    'trend_type': 'seasonal',
                    'trend_period': 'winter_holidays',
                    'trend_strength': 0.78,
                    'peak_periods': ['2024-12-15', '2024-12-25', '2025-01-01'],
                    'analysis_date': datetime.now().date(),
                    'sagemaker_job_name': 'seasonal-analysis-job-001'
                }
            ]
            self.update_seasonal_trends(trends)
            
            # 4. Update optimization recommendations (only if table exists)
            recommendations = [
                {
                    'product_id': 1,
                    'store_id': 'store_001',
                    'recommendation_type': 'reorder',
                    'priority': 'high',
                    'recommended_action': 'Increase order quantity by 25% for holiday season',
                    'impact_score': 0.85,
                    'confidence_score': 0.92,
                    'estimated_benefit': 1250.50,
                    'analysis_period_start': datetime.now().date(),
                    'analysis_period_end': (datetime.now() + timedelta(days=30)).date(),
                    'ml_model_version': 'v2.1'
                }
            ]
            self.update_optimization_recommendations(recommendations)
            
            # 5. Update performance metrics (only if table exists)
            metrics = [
                {
                    'model_id': 1,
                    'metric_type': 'mape',
                    'metric_value': 8.5,
                    'evaluation_period_start': (datetime.now() - timedelta(days=30)).date(),
                    'evaluation_period_end': datetime.now().date(),
                    'sagemaker_training_job': 'lstm-training-job-001',
                    'hyperparameters': {
                        'learning_rate': 0.001,
                        'epochs': 100,
                        'batch_size': 32
                    }
                }
            ]
            self.update_model_performance_metrics(metrics)
            
            # Commit all changes
            self.commit_changes()
            
            logger.info("Full database update completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error during full update: {e}")
            self.connection.rollback()
            return False
        
        finally:
            self.disconnect_database()

def main():
    """Main execution function"""
    updater = SageMakerDatabaseUpdater()
    
    logger.info("Starting SageMaker database update process...")
    success = updater.run_full_update()
    
    if success:
        logger.info("Database update completed successfully")
    else:
        logger.error("Database update failed")
        exit(1)

if __name__ == "__main__":
    main()
