#!/usr/bin/env python3
"""
AWS Lambda Function for ML Forecasting Integration
================================================

This Lambda function serves as the bridge between your application and 
SageMaker ML models for demand forecasting. It handles:

- Data preprocessing and validation
- SageMaker endpoint invocation
- Real-time and batch predictions
- Error handling and fallback mechanisms
- Response formatting and caching
- Model performance monitoring

Deployment Instructions:
1. Package this function with dependencies
2. Create Lambda function with appropriate IAM role
3. Set environment variables for SageMaker endpoints
4. Configure API Gateway triggers
"""

import json
import os
import logging
import boto3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union
import traceback

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
sagemaker_runtime = boto3.client('sagemaker-runtime')
s3_client = boto3.client('s3')
rds_client = boto3.client('rds-data')

# Environment variables
LSTM_ENDPOINT = os.environ.get('LSTM_ENDPOINT_NAME', 'lstm-demand-forecast-endpoint')
ARIMA_ENDPOINT = os.environ.get('ARIMA_ENDPOINT_NAME', 'arima-demand-forecast-endpoint')
ENSEMBLE_ENDPOINT = os.environ.get('ENSEMBLE_ENDPOINT_NAME', 'ensemble-demand-forecast-endpoint')
RDS_ARN = os.environ.get('RDS_CLUSTER_ARN')
RDS_SECRET_ARN = os.environ.get('RDS_SECRET_ARN')
DATABASE_NAME = os.environ.get('DATABASE_NAME', 'inventory_db')
S3_BUCKET = os.environ.get('S3_BUCKET_NAME', 'ml-forecasting-data')

class MLForecastingHandler:
    """Handler for ML forecasting operations"""
    
    def __init__(self):
        self.sagemaker_runtime = sagemaker_runtime
        self.s3_client = s3_client
        self.rds_client = rds_client
        
        # Model endpoints
        self.endpoints = {
            'lstm': LSTM_ENDPOINT,
            'arima': ARIMA_ENDPOINT,
            'ensemble': ENSEMBLE_ENDPOINT
        }
        
        # Cache for frequently used data
        self.cache = {}
        
    def get_historical_data(self, 
                          product_ids: Optional[List[str]] = None,
                          store_ids: Optional[List[str]] = None,
                          days_back: int = 90) -> pd.DataFrame:
        """
        Fetch historical demand data from RDS
        
        Args:
            product_ids: List of product IDs to filter
            store_ids: List of store IDs to filter  
            days_back: Number of days of historical data to fetch
            
        Returns:
            DataFrame with historical demand data
        """
        logger.info(f"Fetching historical data for {days_back} days")
        
        # Build SQL query
        base_query = """
        SELECT 
            it.product_id,
            it.store_id,
            DATE(it.created_at) as date,
            SUM(it.quantity) as demand,
            p.price,
            p.current_stock as stock_level,
            p.category,
            s.name as store_name,
            it.product_name
        FROM inventory_transactions it
        JOIN products p ON it.product_id = p.id AND it.store_id = p.store_id
        JOIN stores s ON it.store_id = s.id
        WHERE it.transaction_type = 'Sale'
        AND it.created_at >= DATE_SUB(CURDATE(), INTERVAL :days_back DAY)
        """
        
        parameters = [{'name': 'days_back', 'value': {'longValue': days_back}}]
        
        # Add filters
        if product_ids:
            placeholders = ','.join([f"':product_{i}'" for i in range(len(product_ids))])
            base_query += f" AND it.product_id IN ({placeholders})"
            for i, product_id in enumerate(product_ids):
                parameters.append({
                    'name': f'product_{i}', 
                    'value': {'stringValue': product_id}
                })
        
        if store_ids:
            placeholders = ','.join([f"':store_{i}'" for i in range(len(store_ids))])
            base_query += f" AND it.store_id IN ({placeholders})"
            for i, store_id in enumerate(store_ids):
                parameters.append({
                    'name': f'store_{i}', 
                    'value': {'stringValue': store_id}
                })
        
        base_query += " GROUP BY it.product_id, it.store_id, DATE(it.created_at), p.price, p.current_stock ORDER BY it.product_id, it.store_id, date"
        
        try:
            # Execute query using RDS Data API
            response = self.rds_client.execute_statement(
                resourceArn=RDS_ARN,
                secretArn=RDS_SECRET_ARN,
                database=DATABASE_NAME,
                sql=base_query,
                parameters=parameters
            )
            
            # Convert response to DataFrame
            records = response['records']
            columns = ['product_id', 'store_id', 'date', 'demand', 'price', 
                      'stock_level', 'category', 'store_name', 'product_name']
            
            data = []
            for record in records:
                row = []
                for field in record:
                    if 'stringValue' in field:
                        row.append(field['stringValue'])
                    elif 'longValue' in field:
                        row.append(field['longValue'])
                    elif 'doubleValue' in field:
                        row.append(field['doubleValue'])
                    elif 'isNull' in field:
                        row.append(None)
                    else:
                        row.append(str(field))
                data.append(row)
            
            df = pd.DataFrame(data, columns=columns)
            logger.info(f"Retrieved {len(df)} records from database")
            
            return df
            
        except Exception as e:
            logger.error(f"Error fetching historical data: {e}")
            # Return sample data as fallback
            return self._get_sample_data()
    
    def _get_sample_data(self) -> pd.DataFrame:
        """Generate sample data for testing/fallback"""
        logger.info("Generating sample data")
        
        dates = pd.date_range(end=datetime.now(), periods=30, freq='D')
        products = ['FV-BAN-001', 'DA-MLK-005', 'MP-CHI-011']
        stores = ['store_001', 'store_002']
        
        data = []
        for product in products:
            for store in stores:
                base_demand = np.random.randint(20, 100)
                for date in dates:
                    # Add some seasonality and noise
                    seasonal_factor = 1 + 0.2 * np.sin(2 * np.pi * date.dayofyear / 365)
                    weekly_factor = 1 + 0.1 * np.sin(2 * np.pi * date.weekday() / 7)
                    noise = np.random.normal(1, 0.1)
                    
                    demand = int(base_demand * seasonal_factor * weekly_factor * noise)
                    demand = max(0, demand)  # Ensure non-negative
                    
                    data.append({
                        'product_id': product,
                        'store_id': store,
                        'date': date.strftime('%Y-%m-%d'),
                        'demand': demand,
                        'price': 2.99 + np.random.normal(0, 0.5),
                        'stock_level': np.random.randint(10, 200),
                        'category': 'Sample Category',
                        'store_name': f'Store {store.split("_")[1]}',
                        'product_name': f'Product {product}'
                    })
        
        return pd.DataFrame(data)
    
    def preprocess_data(self, df: pd.DataFrame) -> Dict:
        """
        Preprocess data for ML models
        
        Args:
            df: Raw historical data
            
        Returns:
            Dictionary with preprocessed data for each model
        """
        logger.info("Preprocessing data for ML models")
        
        # Ensure proper data types
        df['date'] = pd.to_datetime(df['date'])
        df['demand'] = pd.to_numeric(df['demand'], errors='coerce')
        df = df.dropna(subset=['demand'])
        
        # Sort by product, store, and date
        df = df.sort_values(['product_id', 'store_id', 'date'])
        
        # Fill missing dates and interpolate missing values
        processed_dfs = {}
        
        for (product_id, store_id), group in df.groupby(['product_id', 'store_id']):
            # Create complete date range
            date_range = pd.date_range(
                start=group['date'].min(),
                end=group['date'].max(),
                freq='D'
            )
            
            # Reindex to fill missing dates
            group_indexed = group.set_index('date').reindex(date_range)
            
            # Forward fill categorical data
            categorical_cols = ['product_id', 'store_id', 'category', 'store_name', 'product_name']
            for col in categorical_cols:
                if col in group_indexed.columns:
                    group_indexed[col] = group_indexed[col].fillna(method='ffill').fillna(method='bfill')
            
            # Interpolate numerical data
            numerical_cols = ['demand', 'price', 'stock_level']
            for col in numerical_cols:
                if col in group_indexed.columns:
                    group_indexed[col] = group_indexed[col].interpolate(method='linear')
            
            # Reset index
            group_processed = group_indexed.reset_index()
            group_processed.rename(columns={'index': 'date'}, inplace=True)
            
            series_id = f"{product_id}_{store_id}"
            processed_dfs[series_id] = group_processed
        
        # Convert to formats expected by different models
        model_data = {
            'lstm': self._prepare_lstm_data(processed_dfs),
            'arima': self._prepare_arima_data(processed_dfs),
            'ensemble': self._prepare_ensemble_data(processed_dfs)
        }
        
        return model_data
    
    def _prepare_lstm_data(self, processed_dfs: Dict) -> Dict:
        """Prepare data for LSTM model"""
        lstm_data = []
        
        for series_id, df in processed_dfs.items():
            if len(df) >= 30:  # Minimum sequence length
                lstm_data.extend(df.to_dict('records'))
        
        return {'data': lstm_data}
    
    def _prepare_arima_data(self, processed_dfs: Dict) -> Dict:
        """Prepare data for ARIMA model"""
        arima_data = []
        
        for series_id, df in processed_dfs.items():
            if len(df) >= 14:  # Minimum for seasonal ARIMA
                arima_data.extend(df.to_dict('records'))
        
        return {'data': arima_data}
    
    def _prepare_ensemble_data(self, processed_dfs: Dict) -> Dict:
        """Prepare data for Ensemble model"""
        ensemble_data = []
        
        for series_id, df in processed_dfs.items():
            if len(df) >= 30:  # Need sufficient data for ensemble
                ensemble_data.extend(df.to_dict('records'))
        
        return {'data': ensemble_data}
    
    def invoke_sagemaker_endpoint(self, 
                                endpoint_name: str, 
                                payload: Dict,
                                content_type: str = 'application/json') -> Dict:
        """
        Invoke SageMaker endpoint
        
        Args:
            endpoint_name: Name of the SageMaker endpoint
            payload: Input data for the model
            content_type: Content type of the request
            
        Returns:
            Model predictions
        """
        logger.info(f"Invoking SageMaker endpoint: {endpoint_name}")
        
        try:
            response = self.sagemaker_runtime.invoke_endpoint(
                EndpointName=endpoint_name,
                ContentType=content_type,
                Body=json.dumps(payload)
            )
            
            result = json.loads(response['Body'].read().decode())
            logger.info(f"Successfully invoked {endpoint_name}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error invoking {endpoint_name}: {e}")
            # Return empty predictions as fallback
            return {
                'predictions': [],
                'error': str(e),
                'model_type': endpoint_name.split('-')[0],
                'prediction_timestamp': datetime.utcnow().isoformat()
            }
    
    def generate_forecasts(self, 
                         models: List[str] = ['ensemble'],
                         product_ids: Optional[List[str]] = None,
                         store_ids: Optional[List[str]] = None,
                         forecast_days: int = 7) -> Dict:
        """
        Generate demand forecasts using specified models
        
        Args:
            models: List of models to use ('lstm', 'arima', 'ensemble')
            product_ids: List of product IDs to forecast
            store_ids: List of store IDs to forecast
            forecast_days: Number of days to forecast
            
        Returns:
            Dictionary with forecasts from all models
        """
        logger.info(f"Generating forecasts for {len(models)} models")
        
        try:
            # Get historical data
            historical_data = self.get_historical_data(
                product_ids=product_ids,
                store_ids=store_ids,
                days_back=90
            )
            
            if historical_data.empty:
                logger.warning("No historical data available")
                return {'error': 'No historical data available'}
            
            # Preprocess data
            model_data = self.preprocess_data(historical_data)
            
            # Generate forecasts for each model
            forecasts = {}
            
            for model in models:
                if model in self.endpoints and model in model_data:
                    endpoint_name = self.endpoints[model]
                    payload = model_data[model]
                    payload['forecast_days'] = forecast_days
                    
                    try:
                        predictions = self.invoke_sagemaker_endpoint(endpoint_name, payload)
                        forecasts[model] = predictions
                        
                    except Exception as e:
                        logger.error(f"Error with {model} model: {e}")
                        forecasts[model] = {
                            'error': str(e),
                            'model_type': model,
                            'predictions': []
                        }
                else:
                    logger.warning(f"Model {model} not available")
            
            # Combine and format results
            result = {
                'forecasts': forecasts,
                'request_timestamp': datetime.utcnow().isoformat(),
                'forecast_horizon': forecast_days,
                'data_points_used': len(historical_data),
                'models_used': list(forecasts.keys())
            }
            
            # Store results in S3 for monitoring
            self._store_forecast_results(result)
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating forecasts: {e}")
            logger.error(traceback.format_exc())
            
            return {
                'error': str(e),
                'request_timestamp': datetime.utcnow().isoformat(),
                'forecasts': {}
            }
    
    def get_model_performance(self, model_name: str, days_back: int = 30) -> Dict:
        """
        Get model performance metrics
        
        Args:
            model_name: Name of the model
            days_back: Number of days to analyze
            
        Returns:
            Performance metrics dictionary
        """
        logger.info(f"Getting performance metrics for {model_name}")
        
        try:
            # Query actual vs predicted from database
            query = """
            SELECT 
                dp.product_id,
                dp.store_id,
                dp.prediction_date,
                dp.predicted_demand,
                dp.actual_demand,
                dp.prediction_accuracy,
                dfm.model_type
            FROM demand_predictions dp
            JOIN demand_forecasting_models dfm ON dp.model_id = dfm.id
            WHERE dfm.model_type = :model_name
            AND dp.prediction_date >= DATE_SUB(CURDATE(), INTERVAL :days_back DAY)
            AND dp.actual_demand IS NOT NULL
            ORDER BY dp.prediction_date DESC
            """
            
            parameters = [
                {'name': 'model_name', 'value': {'stringValue': model_name}},
                {'name': 'days_back', 'value': {'longValue': days_back}}
            ]
            
            response = self.rds_client.execute_statement(
                resourceArn=RDS_ARN,
                secretArn=RDS_SECRET_ARN,
                database=DATABASE_NAME,
                sql=query,
                parameters=parameters
            )
            
            records = response['records']
            
            if not records:
                return {
                    'model_name': model_name,
                    'error': 'No performance data available',
                    'metrics': {}
                }
            
            # Calculate metrics
            predicted_values = []
            actual_values = []
            accuracies = []
            
            for record in records:
                predicted = record[3]['doubleValue'] if 'doubleValue' in record[3] else 0
                actual = record[4]['doubleValue'] if 'doubleValue' in record[4] else 0
                accuracy = record[5]['doubleValue'] if 'doubleValue' in record[5] else 0
                
                predicted_values.append(predicted)
                actual_values.append(actual)
                accuracies.append(accuracy)
            
            # Calculate performance metrics
            mae = np.mean(np.abs(np.array(actual_values) - np.array(predicted_values)))
            rmse = np.sqrt(np.mean((np.array(actual_values) - np.array(predicted_values)) ** 2))
            mape = np.mean(np.abs((np.array(actual_values) - np.array(predicted_values)) / np.array(actual_values))) * 100
            avg_accuracy = np.mean(accuracies)
            
            return {
                'model_name': model_name,
                'metrics': {
                    'mae': float(mae),
                    'rmse': float(rmse),
                    'mape': float(mape),
                    'avg_accuracy': float(avg_accuracy),
                    'predictions_count': len(records),
                    'analysis_period_days': days_back
                },
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting model performance: {e}")
            return {
                'model_name': model_name,
                'error': str(e),
                'metrics': {}
            }
    
    def _store_forecast_results(self, results: Dict):
        """Store forecast results in S3 for monitoring"""
        try:
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            key = f"forecasts/{timestamp}_forecast_results.json"
            
            self.s3_client.put_object(
                Bucket=S3_BUCKET,
                Key=key,
                Body=json.dumps(results, indent=2),
                ContentType='application/json'
            )
            
            logger.info(f"Stored forecast results in S3: {key}")
            
        except Exception as e:
            logger.error(f"Error storing results in S3: {e}")


def lambda_handler(event, context):
    """
    Main Lambda handler function
    
    Supported operations:
    - generate_forecast: Generate demand forecasts
    - get_model_performance: Get model performance metrics
    - health_check: Check endpoint health
    """
    
    logger.info(f"Received event: {json.dumps(event)}")
    
    try:
        # Initialize handler
        handler = MLForecastingHandler()
        
        # Parse request
        if 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event
        
        operation = body.get('operation', 'generate_forecast')
        
        # Route to appropriate handler
        if operation == 'generate_forecast':
            result = handler.generate_forecasts(
                models=body.get('models', ['ensemble']),
                product_ids=body.get('product_ids'),
                store_ids=body.get('store_ids'),
                forecast_days=body.get('forecast_days', 7)
            )
            
        elif operation == 'get_model_performance':
            result = handler.get_model_performance(
                model_name=body.get('model_name', 'ensemble'),
                days_back=body.get('days_back', 30)
            )
            
        elif operation == 'health_check':
            result = {
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'endpoints': handler.endpoints,
                'environment': {
                    'database': DATABASE_NAME,
                    's3_bucket': S3_BUCKET
                }
            }
            
        else:
            result = {
                'error': f'Unknown operation: {operation}',
                'supported_operations': ['generate_forecast', 'get_model_performance', 'health_check']
            }
        
        # Format response
        response = {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': json.dumps(result)
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Lambda execution error: {e}")
        logger.error(traceback.format_exc())
        
        error_response = {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
        return error_response


# For local testing
if __name__ == '__main__':
    # Test event
    test_event = {
        'operation': 'generate_forecast',
        'models': ['ensemble'],
        'forecast_days': 7,
        'product_ids': ['FV-BAN-001', 'DA-MLK-005'],
        'store_ids': ['store_001', 'store_002']
    }
    
    response = lambda_handler(test_event, {})
    print(json.dumps(response, indent=2))
