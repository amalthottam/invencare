import json
import boto3
import pymysql
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Database configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST'),
    'user': os.environ.get('DB_USER'), 
    'password': os.environ.get('DB_PASSWORD'),
    'database': os.environ.get('DB_NAME', 'inventory_management'),
    'port': int(os.environ.get('DB_PORT', 3306))
}

def get_db_connection():
    """Create database connection"""
    return pymysql.connect(**DB_CONFIG)

def get_current_stock_and_sales(product_id=None, store_id=None, days_back=90):
    """Get current stock and sales history from database"""
    try:
        conn = get_db_connection()
        
        # Base query for stock and sales
        where_clause = "WHERE p.status = 'active'"
        params = []
        
        if product_id:
            where_clause += " AND p.id = %s"
            params.append(product_id)
        if store_id:
            where_clause += " AND p.store_id = %s"
            params.append(store_id)
        
        # Get current stock with recent sales
        stock_query = f"""
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.category,
            p.current_stock,
            p.store_id,
            s.name as store_name,
            p.minimum_stock,
            p.unit_price,
            CASE 
                WHEN p.current_stock <= p.minimum_stock THEN 'CRITICAL'
                WHEN p.current_stock <= p.minimum_stock * 1.5 THEN 'LOW'
                ELSE 'NORMAL'
            END as stock_status
        FROM products p
        JOIN stores s ON p.store_id = s.id
        {where_clause}
        ORDER BY p.current_stock ASC, p.minimum_stock DESC
        """
        
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(stock_query, params)
            stock_data = cursor.fetchall()
        
        # Get sales history for each product
        sales_data = {}
        for product in stock_data:
            sales_query = """
            SELECT 
                DATE(created_at) as sale_date,
                SUM(quantity) as daily_sales,
                COUNT(*) as transaction_count
            FROM inventory_transactions 
            WHERE product_id = %s 
            AND store_id = %s
            AND transaction_type = 'Sale'
            AND created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
            GROUP BY DATE(created_at)
            ORDER BY sale_date
            """
            
            cursor.execute(sales_query, (product['product_id'], product['store_id'], days_back))
            sales_history = cursor.fetchall()
            
            sales_data[f"{product['product_id']}_{product['store_id']}"] = sales_history
        
        conn.close()
        return stock_data, sales_data
        
    except Exception as e:
        logger.error(f"Error getting stock and sales data: {str(e)}")
        raise e

def calculate_demand_forecast_simple(sales_history, forecast_days=30):
    """Calculate demand forecast using simple statistical methods"""
    if not sales_history or len(sales_history) < 3:
        return None
    
    # Convert to pandas for easier manipulation
    df = pd.DataFrame(sales_history)
    df['sale_date'] = pd.to_datetime(df['sale_date'])
    df = df.sort_values('sale_date')
    
    # Fill missing dates with 0 sales
    date_range = pd.date_range(start=df['sale_date'].min(), end=df['sale_date'].max(), freq='D')
    df_complete = pd.DataFrame({'sale_date': date_range})
    df_complete = df_complete.merge(df, on='sale_date', how='left')
    df_complete['daily_sales'] = df_complete['daily_sales'].fillna(0)
    
    # Calculate moving averages
    df_complete['ma_7'] = df_complete['daily_sales'].rolling(window=min(7, len(df_complete)), min_periods=1).mean()
    df_complete['ma_14'] = df_complete['daily_sales'].rolling(window=min(14, len(df_complete)), min_periods=1).mean()
    
    # Calculate trend
    recent_sales = df_complete['daily_sales'].tail(7).mean()
    older_sales = df_complete['daily_sales'].head(7).mean() if len(df_complete) >= 14 else recent_sales
    trend_factor = recent_sales / max(older_sales, 1) if older_sales > 0 else 1.0
    
    # Base prediction
    base_demand = df_complete['ma_7'].iloc[-1] if len(df_complete) > 0 else 0
    
    # Generate predictions
    predictions = []
    for day in range(forecast_days):
        # Simple weekly pattern (higher on weekends)
        day_of_week = (len(df_complete) + day) % 7
        seasonal_factor = 1.2 if day_of_week in [5, 6] else 0.9
        
        # Apply trend with decay
        trend_decay = 0.95 ** (day / 7)
        adjusted_trend = 1 + (trend_factor - 1) * trend_decay
        
        daily_prediction = base_demand * seasonal_factor * adjusted_trend
        predictions.append(max(0, daily_prediction))
    
    # Calculate confidence intervals
    std_dev = df_complete['daily_sales'].std()
    confidence_lower = [max(0, p - std_dev * 0.5) for p in predictions]
    confidence_upper = [p + std_dev * 0.5 for p in predictions]
    
    return {
        'predictions': predictions,
        'confidence_lower': confidence_lower,
        'confidence_upper': confidence_upper,
        'base_demand': float(base_demand),
        'trend_factor': float(trend_factor),
        'total_forecast': float(sum(predictions)),
        'avg_daily_forecast': float(np.mean(predictions)),
        'model_accuracy': float(min(0.95, max(0.6, 1 - (std_dev / max(base_demand, 1)))))
    }

def generate_stock_recommendations(current_stock, forecast_data, minimum_stock):
    """Generate reorder recommendations"""
    if not forecast_data:
        return None
    
    # Calculate recommendations
    weekly_demand = sum(forecast_data['predictions'][:7])
    monthly_demand = forecast_data['total_forecast']
    
    # Safety stock (3 days of average demand)
    safety_stock = forecast_data['avg_daily_forecast'] * 3
    
    # Reorder point (lead time + safety stock)
    lead_time_days = 7  # Assume 1 week lead time
    reorder_point = forecast_data['avg_daily_forecast'] * lead_time_days + safety_stock
    
    # Recommended order quantity
    target_stock = max(minimum_stock, monthly_demand + safety_stock)
    recommended_order = max(0, target_stock - current_stock)
    
    # Days until stockout
    days_until_stockout = current_stock / max(forecast_data['avg_daily_forecast'], 1) if forecast_data['avg_daily_forecast'] > 0 else 999
    
    return {
        'current_stock': current_stock,
        'reorder_point': reorder_point,
        'recommended_order_quantity': recommended_order,
        'safety_stock': safety_stock,
        'weekly_demand': weekly_demand,
        'monthly_demand': monthly_demand,
        'days_until_stockout': days_until_stockout,
        'action_needed': current_stock < reorder_point,
        'urgency': 'HIGH' if days_until_stockout < 7 else 'MEDIUM' if days_until_stockout < 14 else 'LOW'
    }

def store_predictions_in_database(product_id, store_id, forecast_data, recommendations):
    """Store predictions in existing database tables"""
    try:
        conn = get_db_connection()
        
        with conn.cursor() as cursor:
            # Create tables if they don't exist
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS demand_predictions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    product_id VARCHAR(50) NOT NULL,
                    store_id VARCHAR(50) NOT NULL,
                    model_type VARCHAR(50) DEFAULT 'statistical',
                    forecast_days INT NOT NULL,
                    predictions JSON NOT NULL,
                    confidence_lower JSON,
                    confidence_upper JSON,
                    model_accuracy DECIMAL(5,4),
                    total_forecast_demand DECIMAL(10,2),
                    avg_daily_demand DECIMAL(8,2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_product_store (product_id, store_id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS stock_recommendations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    product_id VARCHAR(50) NOT NULL,
                    store_id VARCHAR(50) NOT NULL,
                    current_stock INT NOT NULL,
                    reorder_point DECIMAL(8,2),
                    recommended_order_quantity DECIMAL(8,2),
                    urgency ENUM('LOW', 'MEDIUM', 'HIGH'),
                    action_needed BOOLEAN,
                    days_until_stockout DECIMAL(5,1),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_product_store (product_id, store_id),
                    INDEX idx_urgency (urgency)
                )
            """)
            
            # Store forecast data
            cursor.execute("""
                INSERT INTO demand_predictions 
                (product_id, store_id, model_type, forecast_days, predictions, 
                 confidence_lower, confidence_upper, model_accuracy, total_forecast_demand, avg_daily_demand)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                product_id, store_id, 'statistical_ml', 30,
                json.dumps(forecast_data['predictions']),
                json.dumps(forecast_data['confidence_lower']),
                json.dumps(forecast_data['confidence_upper']),
                forecast_data['model_accuracy'],
                forecast_data['total_forecast'],
                forecast_data['avg_daily_forecast']
            ))
            
            # Store recommendations
            if recommendations:
                cursor.execute("""
                    INSERT INTO stock_recommendations 
                    (product_id, store_id, current_stock, reorder_point, recommended_order_quantity,
                     urgency, action_needed, days_until_stockout)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    product_id, store_id, recommendations['current_stock'],
                    recommendations['reorder_point'], recommendations['recommended_order_quantity'],
                    recommendations['urgency'], recommendations['action_needed'],
                    recommendations['days_until_stockout']
                ))
            
            conn.commit()
        
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"Error storing predictions: {str(e)}")
        return False

def lambda_handler(event, context):
    """Main Lambda handler for ML predictions"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        action = event.get('action', 'forecast')
        product_id = event.get('product_id')
        store_id = event.get('store_id')
        
        if action == 'forecast':
            return handle_forecast_request(event)
        elif action == 'batch_predict':
            return handle_batch_prediction(event)
        elif action == 'dashboard':
            return handle_dashboard_request(event)
        elif action == 'health_check':
            return handle_health_check()
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'success': False,
                    'error': f'Unknown action: {action}'
                })
            }
            
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

def handle_forecast_request(event):
    """Handle individual forecast request"""
    product_id = event.get('product_id')
    store_id = event.get('store_id')
    
    if not product_id or not store_id:
        return {
            'statusCode': 400,
            'body': json.dumps({
                'success': False,
                'error': 'product_id and store_id are required'
            })
        }
    
    try:
        # Get stock and sales data
        stock_data, sales_data = get_current_stock_and_sales(product_id, store_id)
        
        if not stock_data:
            return {
                'statusCode': 404,
                'body': json.dumps({
                    'success': False,
                    'error': 'Product not found'
                })
            }
        
        product_info = stock_data[0]
        sales_history = sales_data.get(f"{product_id}_{store_id}", [])
        
        # Generate forecast
        forecast = calculate_demand_forecast_simple(sales_history)
        
        if forecast:
            # Generate recommendations
            recommendations = generate_stock_recommendations(
                product_info['current_stock'], 
                forecast, 
                product_info['minimum_stock']
            )
            
            # Store in database
            store_predictions_in_database(product_id, store_id, forecast, recommendations)
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'success': True,
                    'data': {
                        'product_id': product_id,
                        'store_id': store_id,
                        'product_name': product_info['product_name'],
                        'current_stock': product_info['current_stock'],
                        'stock_status': product_info['stock_status'],
                        'forecast': forecast,
                        'recommendations': recommendations
                    },
                    'timestamp': datetime.now().isoformat()
                })
            }
        else:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'success': False,
                    'error': 'Insufficient sales data for forecasting',
                    'data': {
                        'product_id': product_id,
                        'current_stock': product_info['current_stock'],
                        'sales_data_points': len(sales_history)
                    }
                })
            }
            
    except Exception as e:
        logger.error(f"Forecast error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }

def handle_batch_prediction(event):
    """Handle batch predictions for multiple products"""
    store_id = event.get('store_id')
    limit = event.get('limit', 20)
    
    try:
        # Get critical stock items (low stock or out of stock)
        stock_data, sales_data = get_current_stock_and_sales(store_id=store_id)
        
        # Focus on critical items
        critical_items = [item for item in stock_data if item['stock_status'] in ['CRITICAL', 'LOW']][:limit]
        
        results = []
        successful = 0
        failed = 0
        
        for item in critical_items:
            try:
                product_id = item['product_id']
                item_store_id = item['store_id']
                sales_history = sales_data.get(f"{product_id}_{item_store_id}", [])
                
                # Generate forecast
                forecast = calculate_demand_forecast_simple(sales_history)
                
                if forecast:
                    # Generate recommendations
                    recommendations = generate_stock_recommendations(
                        item['current_stock'], 
                        forecast, 
                        item['minimum_stock']
                    )
                    
                    # Store in database
                    store_predictions_in_database(product_id, item_store_id, forecast, recommendations)
                    
                    results.append({
                        'product_id': product_id,
                        'store_id': item_store_id,
                        'product_name': item['product_name'],
                        'status': 'success',
                        'forecast_total': forecast['total_forecast'],
                        'action_needed': recommendations['action_needed'] if recommendations else False
                    })
                    successful += 1
                else:
                    results.append({
                        'product_id': product_id,
                        'store_id': item_store_id,
                        'status': 'insufficient_data',
                        'sales_data_points': len(sales_history)
                    })
                    failed += 1
                    
            except Exception as e:
                results.append({
                    'product_id': item.get('product_id', 'unknown'),
                    'status': 'error',
                    'error': str(e)
                })
                failed += 1
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'data': {
                    'store_id': store_id,
                    'total_processed': len(critical_items),
                    'successful': successful,
                    'failed': failed,
                    'results': results
                },
                'timestamp': datetime.now().isoformat()
            })
        }
        
    except Exception as e:
        logger.error(f"Batch prediction error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }

def handle_dashboard_request(event):
    """Handle dashboard data request"""
    try:
        conn = get_db_connection()
        
        # Get summary statistics
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # Recent predictions summary
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_predictions,
                    COUNT(DISTINCT product_id) as products_predicted,
                    AVG(model_accuracy) as avg_accuracy,
                    SUM(total_forecast_demand) as total_forecast
                FROM demand_predictions 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            """)
            prediction_stats = cursor.fetchone()
            
            # Critical stock items
            cursor.execute("""
                SELECT 
                    COUNT(*) as critical_items
                FROM products 
                WHERE current_stock <= minimum_stock
            """)
            critical_stats = cursor.fetchone()
            
            # Recent recommendations
            cursor.execute("""
                SELECT 
                    sr.product_id,
                    p.name as product_name,
                    sr.store_id,
                    s.name as store_name,
                    sr.current_stock,
                    sr.recommended_order_quantity,
                    sr.urgency,
                    sr.action_needed,
                    sr.days_until_stockout
                FROM stock_recommendations sr
                JOIN products p ON sr.product_id = p.id AND sr.store_id = p.store_id
                JOIN stores s ON sr.store_id = s.id
                WHERE sr.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                AND sr.action_needed = 1
                ORDER BY sr.urgency DESC, sr.days_until_stockout ASC
                LIMIT 10
            """)
            urgent_recommendations = cursor.fetchall()
        
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'data': {
                    'prediction_stats': prediction_stats,
                    'critical_stats': critical_stats,
                    'urgent_recommendations': urgent_recommendations,
                    'last_updated': datetime.now().isoformat()
                }
            })
        }
        
    except Exception as e:
        logger.error(f"Dashboard error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }

def handle_health_check():
    """Handle health check"""
    try:
        # Test database connection
        conn = get_db_connection()
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'status': 'healthy',
                'database': 'connected',
                'timestamp': datetime.now().isoformat()
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'status': 'unhealthy',
                'error': str(e)
            })
        }
