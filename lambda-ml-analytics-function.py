import json
import boto3
import pymysql
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from decimal import Decimal
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS Clients
sagemaker_runtime = boto3.client('sagemaker-runtime')
s3_client = boto3.client('s3')

# Database configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST'),
    'user': os.environ.get('DB_USER'), 
    'password': os.environ.get('DB_PASSWORD'),
    'database': os.environ.get('DB_NAME', 'inventory_management'),
    'port': int(os.environ.get('DB_PORT', 3306))
}

# SageMaker endpoint names
ENDPOINTS = {
    'lstm': os.environ.get('LSTM_ENDPOINT_NAME', 'lstm-demand-forecasting'),
    'arima': os.environ.get('ARIMA_ENDPOINT_NAME', 'arima-seasonal-forecasting'),
    'prophet': os.environ.get('PROPHET_ENDPOINT_NAME', 'prophet-forecasting'),
    'classification': os.environ.get('CLASSIFICATION_ENDPOINT_NAME', 'product-abc-classification')
}

def decimal_default(obj):
    """JSON serializer for Decimal objects"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

def get_db_connection():
    """Create database connection"""
    return pymysql.connect(**DB_CONFIG)

def fetch_training_data(product_id, store_id, days_back=90):
    """Fetch historical transaction data for training/prediction"""
    try:
        conn = get_db_connection()
        
        query = """
        SELECT 
            DATE(created_at) as date,
            SUM(CASE WHEN transaction_type = 'Sale' THEN quantity ELSE 0 END) as sales_quantity,
            SUM(CASE WHEN transaction_type = 'Sale' THEN total_amount ELSE 0 END) as sales_amount,
            AVG(unit_price) as avg_price,
            COUNT(*) as transaction_count
        FROM inventory_transactions 
        WHERE product_id = %s 
          AND store_id = %s
          AND created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
        """
        
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(query, (product_id, store_id, days_back))
            results = cursor.fetchall()
        
        conn.close()
        return results
        
    except Exception as e:
        logger.error(f"Error fetching training data: {str(e)}")
        raise e

def get_product_features(product_id, store_id):
    """Get product features for classification"""
    try:
        conn = get_db_connection()
        
        query = """
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.category,
            p.unit_price,
            p.current_stock,
            
            -- Sales metrics (last 90 days)
            COALESCE(SUM(CASE WHEN t.transaction_type = 'Sale' THEN t.quantity END), 0) as total_sales_quantity,
            COALESCE(SUM(CASE WHEN t.transaction_type = 'Sale' THEN t.total_amount END), 0) as total_sales_amount,
            COALESCE(AVG(CASE WHEN t.transaction_type = 'Sale' THEN t.quantity END), 0) as avg_sales_quantity,
            COALESCE(COUNT(CASE WHEN t.transaction_type = 'Sale' THEN 1 END), 0) as total_transactions,
            
            -- Price metrics
            COALESCE(AVG(t.unit_price), p.unit_price) as avg_unit_price,
            COALESCE(STDDEV(t.unit_price), 0) as price_volatility,
            
            -- Demand volatility
            COALESCE(STDDEV(CASE WHEN t.transaction_type = 'Sale' THEN t.quantity END), 0) as demand_volatility
            
        FROM products p
        LEFT JOIN inventory_transactions t ON p.id = t.product_id 
          AND t.store_id = p.store_id 
          AND t.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        WHERE p.id = %s AND p.store_id = %s
        GROUP BY p.id, p.name, p.category, p.unit_price, p.current_stock
        """
        
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(query, (product_id, store_id))
            result = cursor.fetchone()
        
        conn.close()
        
        if not result:
            raise ValueError(f"Product {product_id} not found in store {store_id}")
        
        # Calculate derived features
        features = {
            'quantity_sum': result['total_sales_quantity'],
            'quantity_mean': result['avg_sales_quantity'],
            'quantity_std': result['demand_volatility'],
            'quantity_count': result['total_transactions'],
            'total_amount_sum': result['total_sales_amount'],
            'total_amount_mean': result['total_sales_amount'] / max(result['total_transactions'], 1),
            'unit_price_mean': result['avg_unit_price'],
            'unit_price_std': result['price_volatility'],
            'revenue_per_transaction': result['total_sales_amount'] / max(result['total_transactions'], 1),
            'price_volatility': result['price_volatility'] / max(result['avg_unit_price'], 1),
            'demand_volatility': result['demand_volatility'] / max(result['avg_sales_quantity'], 1),
            'total_transactions': result['total_transactions']
        }
        
        return features
        
    except Exception as e:
        logger.error(f"Error fetching product features: {str(e)}")
        raise e

def invoke_sagemaker_endpoint(endpoint_name, payload):
    """Invoke SageMaker endpoint for prediction"""
    try:
        response = sagemaker_runtime.invoke_endpoint(
            EndpointName=endpoint_name,
            ContentType='application/json',
            Body=json.dumps(payload)
        )
        
        result = json.loads(response['Body'].read().decode())
        return result
        
    except Exception as e:
        logger.error(f"Error invoking SageMaker endpoint {endpoint_name}: {str(e)}")
        raise e

def store_prediction_in_db(product_id, store_id, model_type, prediction_data):
    """Store prediction results in database"""
    try:
        conn = get_db_connection()
        
        # Create predictions table if not exists
        create_table_query = """
        CREATE TABLE IF NOT EXISTS demand_predictions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id VARCHAR(50) NOT NULL,
            store_id VARCHAR(50) NOT NULL,
            model_type VARCHAR(50) NOT NULL,
            forecast_days INT NOT NULL,
            predictions JSON NOT NULL,
            confidence_lower JSON,
            confidence_upper JSON,
            model_accuracy DECIMAL(5,4),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_product_store (product_id, store_id),
            INDEX idx_created_at (created_at)
        )
        """
        
        with conn.cursor() as cursor:
            cursor.execute(create_table_query)
            
            # Insert prediction
            insert_query = """
            INSERT INTO demand_predictions 
            (product_id, store_id, model_type, forecast_days, predictions, confidence_lower, confidence_upper, model_accuracy)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            values = (
                product_id,
                store_id,
                model_type,
                prediction_data.get('forecast_horizon', 30),
                json.dumps(prediction_data.get('predictions', [])),
                json.dumps(prediction_data.get('confidence_lower', [])),
                json.dumps(prediction_data.get('confidence_upper', [])),
                prediction_data.get('model_accuracy')
            )
            
            cursor.execute(insert_query, values)
            conn.commit()
        
        conn.close()
        logger.info(f"Stored prediction for {product_id} in {store_id}")
        
    except Exception as e:
        logger.error(f"Error storing prediction: {str(e)}")
        raise e

def store_classification_in_db(product_id, store_id, classification_data, features):
    """Store classification results in database"""
    try:
        conn = get_db_connection()
        
        # Create classifications table if not exists
        create_table_query = """
        CREATE TABLE IF NOT EXISTS product_classifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id VARCHAR(50) NOT NULL,
            store_id VARCHAR(50) NOT NULL,
            abc_class ENUM('A', 'B', 'C') NOT NULL,
            confidence DECIMAL(5,4) NOT NULL,
            class_probabilities JSON,
            features_used JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_product_store (product_id, store_id),
            INDEX idx_abc_class (abc_class),
            INDEX idx_created_at (created_at)
        )
        """
        
        with conn.cursor() as cursor:
            cursor.execute(create_table_query)
            
            # Insert classification
            insert_query = """
            INSERT INTO product_classifications 
            (product_id, store_id, abc_class, confidence, class_probabilities, features_used)
            VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            values = (
                product_id,
                store_id,
                classification_data.get('abc_classification'),
                classification_data.get('confidence'),
                json.dumps(classification_data.get('class_probabilities', {})),
                json.dumps(features)
            )
            
            cursor.execute(insert_query, values)
            conn.commit()
        
        conn.close()
        logger.info(f"Stored classification for {product_id} in {store_id}")
        
    except Exception as e:
        logger.error(f"Error storing classification: {str(e)}")
        raise e

def get_latest_predictions(product_id, store_id, prediction_type='all', limit=5):
    """Get latest predictions from database"""
    try:
        conn = get_db_connection()
        results = {}
        
        if prediction_type in ['forecast', 'all']:
            forecast_query = """
            SELECT * FROM demand_predictions 
            WHERE product_id = %s AND store_id = %s
            ORDER BY created_at DESC 
            LIMIT %s
            """
            
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(forecast_query, (product_id, store_id, limit))
                results['forecasts'] = cursor.fetchall()
        
        if prediction_type in ['classification', 'all']:
            classification_query = """
            SELECT * FROM product_classifications 
            WHERE product_id = %s AND store_id = %s
            ORDER BY created_at DESC 
            LIMIT %s
            """
            
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(classification_query, (product_id, store_id, limit))
                results['classifications'] = cursor.fetchall()
        
        conn.close()
        return results
        
    except Exception as e:
        logger.error(f"Error fetching predictions: {str(e)}")
        raise e

def check_endpoint_health(endpoint_name):
    """Check if SageMaker endpoint is healthy"""
    try:
        # Test with dummy data
        test_payload = {
            'historical_data': [10, 12, 15, 8, 20, 18, 14, 16, 11, 13],
            'forecast_days': 7
        }
        
        response = sagemaker_runtime.invoke_endpoint(
            EndpointName=endpoint_name,
            ContentType='application/json',
            Body=json.dumps(test_payload)
        )
        
        return {
            'status': 'healthy',
            'endpoint': endpoint_name,
            'response_time': response['ResponseMetadata']['HTTPHeaders'].get('date')
        }
        
    except Exception as e:
        return {
            'status': 'unhealthy',
            'endpoint': endpoint_name,
            'error': str(e)
        }

def lambda_handler(event, context):
    """Main Lambda handler for unified ML analytics"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        action = event.get('action')
        
        if action == 'forecast':
            return handle_forecast(event)
        elif action == 'classify':
            return handle_classify(event)
        elif action == 'batch_predict':
            return handle_batch_predict(event)
        elif action == 'get_predictions':
            return handle_get_predictions(event)
        elif action == 'training_data':
            return handle_training_data(event)
        elif action == 'dashboard':
            return handle_dashboard(event)
        elif action == 'health_check':
            return handle_health_check(event)
        elif action == 'realtime_predict':
            return handle_realtime_predict(event)
        elif action == 'model_management':
            return handle_model_management(event)
        else:
            raise ValueError(f"Unknown action: {action}")
            
    except Exception as e:
        logger.error(f"Lambda execution error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
        }

def handle_forecast(event):
    """Handle demand forecasting"""
    product_id = event.get('product_id')
    store_id = event.get('store_id')
    model_type = event.get('model_type', 'lstm')
    forecast_days = event.get('forecast_days', 30)
    
    if not product_id or not store_id:
        raise ValueError("product_id and store_id are required")
    
    # Fetch historical data
    historical_data = fetch_training_data(product_id, store_id, 90)
    
    if len(historical_data) < 30:
        raise ValueError("Insufficient historical data for forecasting")
    
    # Prepare data for model
    sales_data = [row['sales_quantity'] for row in historical_data]
    
    input_data = {
        'historical_data': sales_data,
        'forecast_days': forecast_days,
        'product_id': product_id,
        'store_id': store_id
    }
    
    # Get prediction from SageMaker
    endpoint_name = ENDPOINTS.get(model_type)
    if not endpoint_name:
        raise ValueError(f"No endpoint configured for model type: {model_type}")
    
    prediction = invoke_sagemaker_endpoint(endpoint_name, input_data)
    
    # Store prediction in database
    store_prediction_in_db(product_id, store_id, model_type, prediction)
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'data': {
                'product_id': product_id,
                'store_id': store_id,
                'model_type': model_type,
                'prediction': prediction,
                'historical_data_points': len(historical_data)
            },
            'timestamp': datetime.now().isoformat()
        }, default=decimal_default)
    }

def handle_classify(event):
    """Handle product classification"""
    product_id = event.get('product_id')
    store_id = event.get('store_id')
    
    if not product_id or not store_id:
        raise ValueError("product_id and store_id are required")
    
    # Get product features
    features = get_product_features(product_id, store_id)
    
    input_data = {'features': features}
    
    # Get classification from SageMaker
    endpoint_name = ENDPOINTS.get('classification')
    if not endpoint_name:
        raise ValueError("No classification endpoint configured")
    
    classification = invoke_sagemaker_endpoint(endpoint_name, input_data)
    
    # Store classification in database
    store_classification_in_db(product_id, store_id, classification, features)
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'data': {
                'product_id': product_id,
                'store_id': store_id,
                'classification': classification,
                'features': features
            },
            'timestamp': datetime.now().isoformat()
        }, default=decimal_default)
    }

def handle_get_predictions(event):
    """Handle getting stored predictions"""
    product_id = event.get('product_id')
    store_id = event.get('store_id')
    prediction_type = event.get('prediction_type', 'all')
    limit = event.get('limit', 5)
    
    predictions = get_latest_predictions(product_id, store_id, prediction_type, limit)
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'data': predictions,
            'timestamp': datetime.now().isoformat()
        }, default=decimal_default)
    }

def handle_health_check(event):
    """Handle health check for all ML services"""
    health_results = {
        'overall_status': 'healthy',
        'endpoints': {},
        'database': {},
        'models': {}
    }
    
    # Check SageMaker endpoints
    for model_type, endpoint_name in ENDPOINTS.items():
        if endpoint_name:
            health_results['endpoints'][model_type] = check_endpoint_health(endpoint_name)
    
    # Check database connection
    try:
        conn = get_db_connection()
        conn.close()
        health_results['database'] = {'status': 'healthy', 'connection': 'success'}
    except Exception as e:
        health_results['database'] = {'status': 'unhealthy', 'error': str(e)}
        health_results['overall_status'] = 'degraded'
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'data': health_results,
            'timestamp': datetime.now().isoformat()
        })
    }

def handle_realtime_predict(event):
    """Handle real-time prediction with priority"""
    # Similar to forecast but with immediate processing
    return handle_forecast(event)

def handle_batch_predict(event):
    """Handle batch predictions for multiple products"""
    store_id = event.get('store_id')
    model_type = event.get('model_type', 'lstm')
    batch_size = event.get('batch_size', 10)
    
    # Get products for batch processing
    conn = get_db_connection()
    
    query = """
    SELECT DISTINCT product_id FROM inventory_transactions 
    WHERE store_id = %s 
    AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    GROUP BY product_id 
    HAVING COUNT(*) >= 10
    LIMIT %s
    """
    
    with conn.cursor(pymysql.cursors.DictCursor) as cursor:
        cursor.execute(query, (store_id, batch_size))
        products = cursor.fetchall()
    
    conn.close()
    
    results = []
    for product in products:
        try:
            forecast_event = {
                'action': 'forecast',
                'product_id': product['product_id'],
                'store_id': store_id,
                'model_type': model_type,
                'forecast_days': 30
            }
            
            result = handle_forecast(forecast_event)
            results.append({
                'product_id': product['product_id'],
                'status': 'success',
                'result': json.loads(result['body'])
            })
        except Exception as e:
            results.append({
                'product_id': product['product_id'],
                'status': 'failed',
                'error': str(e)
            })
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'data': {
                'store_id': store_id,
                'total_products': len(products),
                'successful': len([r for r in results if r['status'] == 'success']),
                'failed': len([r for r in results if r['status'] == 'failed']),
                'results': results
            },
            'timestamp': datetime.now().isoformat()
        })
    }

def handle_dashboard(event):
    """Handle ML dashboard data aggregation"""
    store_id = event.get('store_id')
    
    # Get summary statistics
    conn = get_db_connection()
    
    # Recent predictions count
    pred_query = """
    SELECT 
        COUNT(*) as total_predictions,
        COUNT(DISTINCT product_id) as products_with_predictions
    FROM demand_predictions 
    WHERE store_id = %s AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    """
    
    with conn.cursor(pymysql.cursors.DictCursor) as cursor:
        cursor.execute(pred_query, (store_id,))
        pred_stats = cursor.fetchone()
    
    # Classification distribution
    class_query = """
    SELECT abc_class, COUNT(*) as count
    FROM product_classifications 
    WHERE store_id = %s AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY abc_class
    """
    
    with conn.cursor(pymysql.cursors.DictCursor) as cursor:
        cursor.execute(class_query, (store_id,))
        class_dist = cursor.fetchall()
    
    conn.close()
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'data': {
                'store_id': store_id,
                'prediction_stats': pred_stats,
                'classification_distribution': class_dist,
                'last_updated': datetime.now().isoformat()
            },
            'timestamp': datetime.now().isoformat()
        }, default=decimal_default)
    }

def handle_training_data(event):
    """Handle training data extraction"""
    # Implementation for training data export
    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'message': 'Training data export not implemented',
            'timestamp': datetime.now().isoformat()
        })
    }

def handle_model_management(event):
    """Handle model management operations"""
    # Implementation for model deployment/management
    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'message': 'Model management not implemented',
            'timestamp': datetime.now().isoformat()
        })
    }
