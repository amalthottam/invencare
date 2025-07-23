# AWS Lambda Functions for Product Analytics

This document provides complete implementation code and deployment instructions for AWS Lambda functions that power the product analytics features.

## Overview

The product analytics system consists of 4 main Lambda functions:

1. **product-performance-analyzer** - Calculates comprehensive product performance metrics
2. **demand-forecasting-engine** - Generates demand forecasts using multiple ML models
3. **inventory-optimizer** - Provides inventory optimization recommendations
4. **analytics-dashboard-generator** - Aggregates data for real-time analytics dashboards

## 1. Product Performance Analyzer Lambda

### Function Code

```python
import json
import boto3
import pymysql
import os
from datetime import datetime, timedelta
import statistics

def lambda_handler(event, context):
    """
    Calculate comprehensive product performance metrics

    Event structure:
    {
        "productId": "string",
        "storeId": "string",
        "analysisPeriod": 30,  // days
        "action": "calculate_performance"
    }
    """

    try:
        # Parse input
        product_id = event.get('productId')
        store_id = event.get('storeId')
        analysis_period = event.get('analysisPeriod', 30)

        if not product_id or not store_id:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Missing required parameters: productId and storeId'
                })
            }

        # Database connection
        connection = get_db_connection()

        with connection.cursor() as cursor:
            # Get sales data for the period
            end_date = datetime.now()
            start_date = end_date - timedelta(days=analysis_period)

            sales_query = """
            SELECT
                COUNT(*) as transaction_count,
                SUM(quantity) as total_volume,
                SUM(total_amount) as total_revenue,
                AVG(unit_price) as avg_price,
                MIN(created_at) as first_sale,
                MAX(created_at) as last_sale
            FROM inventory_transactions
            WHERE product_id = %s
                AND store_id = %s
                AND transaction_type = 'sale'
                AND created_at >= %s
            """

            cursor.execute(sales_query, (product_id, store_id, start_date))
            sales_data = cursor.fetchone()

            # Get product info
            product_query = """
            SELECT
                p.name,
                p.quantity as current_stock,
                p.minimum_stock,
                p.maximum_stock,
                p.price,
                p.category,
                s.name as store_name
            FROM products p
            JOIN stores s ON p.store_id = s.id
            WHERE p.id = %s AND p.store_id = %s
            """

            cursor.execute(product_query, (product_id, store_id))
            product_info = cursor.fetchone()

            if not product_info:
                return {
                    'statusCode': 404,
                    'body': json.dumps({'error': 'Product not found'})
                }

            # Calculate metrics
            metrics = calculate_performance_metrics(
                sales_data,
                product_info,
                analysis_period
            )

            # Store results in analytics table
            store_performance_analytics(
                cursor,
                product_id,
                store_id,
                metrics,
                analysis_period
            )

            connection.commit()

        connection.close()

        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'productId': product_id,
                'storeId': store_id,
                'analysisPeriod': analysis_period,
                'metrics': metrics,
                'timestamp': datetime.now().isoformat()
            })
        }

    except Exception as e:
        print(f"Error in product performance analysis: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }

def get_db_connection():
    """Create database connection"""
    return pymysql.connect(
        host=os.environ['DB_HOST'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        database=os.environ['DB_NAME'],
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )

def calculate_performance_metrics(sales_data, product_info, period_days):
    """Calculate comprehensive performance metrics"""

    # Sales velocity (units per day)
    total_volume = sales_data.get('total_volume', 0) or 0
    sales_velocity = total_volume / period_days if period_days > 0 else 0

    # Inventory turnover
    current_stock = product_info.get('current_stock', 0) or 0
    inventory_turnover = total_volume / current_stock if current_stock > 0 else 0

    # Days inventory outstanding
    days_inventory = current_stock / sales_velocity if sales_velocity > 0 else 999

    # Revenue metrics
    total_revenue = float(sales_data.get('total_revenue', 0) or 0)
    avg_price = float(sales_data.get('avg_price', 0) or 0)

    # ABC Classification
    if total_revenue > 1000:
        abc_class = 'A'
    elif total_revenue > 500:
        abc_class = 'B'
    else:
        abc_class = 'C'

    # Performance score (0-100)
    velocity_score = min(sales_velocity * 5, 30)
    turnover_score = min(inventory_turnover * 10, 25)
    revenue_score = min(total_revenue / 50, 20)
    abc_score = {'A': 25, 'B': 15, 'C': 5}[abc_class]

    performance_score = velocity_score + turnover_score + revenue_score + abc_score

    # Stock status analysis
    min_stock = product_info.get('minimum_stock', 0) or 0
    max_stock = product_info.get('maximum_stock', 100) or 100

    if current_stock == 0:
        stock_status = 'Out of Stock'
        stock_risk = 'Critical'
    elif current_stock <= min_stock:
        stock_status = 'Low Stock'
        stock_risk = 'High'
    elif current_stock >= max_stock * 0.9:
        stock_status = 'Overstocked'
        stock_risk = 'Medium'
    else:
        stock_status = 'Normal'
        stock_risk = 'Low'

    return {
        'productName': product_info.get('name'),
        'category': product_info.get('category'),
        'storeName': product_info.get('store_name'),
        'totalSalesVolume': total_volume,
        'totalSalesRevenue': total_revenue,
        'averageSalePrice': avg_price,
        'salesVelocity': round(sales_velocity, 2),
        'inventoryTurnover': round(inventory_turnover, 2),
        'daysInventoryOutstanding': int(days_inventory),
        'currentStock': current_stock,
        'minimumStock': min_stock,
        'maximumStock': max_stock,
        'stockStatus': stock_status,
        'stockRisk': stock_risk,
        'abcClassification': abc_class,
        'performanceScore': round(performance_score, 2),
        'transactionCount': sales_data.get('transaction_count', 0),
        'analysisDate': datetime.now().date().isoformat()
    }

def store_performance_analytics(cursor, product_id, store_id, metrics, period_days):
    """Store calculated metrics in the analytics table"""

    period_type = 'monthly' if period_days >= 28 else 'weekly' if period_days >= 7 else 'daily'

    # Insert or update performance record
    query = """
    INSERT INTO product_performance_analytics
    (product_id, store_id, analysis_date, period_type, total_sales_volume,
     total_sales_revenue, average_sale_price, sales_velocity, inventory_turnover,
     days_inventory_outstanding, abc_classification, performance_score)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
    total_sales_volume = VALUES(total_sales_volume),
    total_sales_revenue = VALUES(total_sales_revenue),
    average_sale_price = VALUES(average_sale_price),
    sales_velocity = VALUES(sales_velocity),
    inventory_turnover = VALUES(inventory_turnover),
    days_inventory_outstanding = VALUES(days_inventory_outstanding),
    abc_classification = VALUES(abc_classification),
    performance_score = VALUES(performance_score),
    updated_at = CURRENT_TIMESTAMP
    """

    cursor.execute(query, (
        product_id, store_id, datetime.now().date(), period_type,
        metrics['totalSalesVolume'], metrics['totalSalesRevenue'],
        metrics['averageSalePrice'], metrics['salesVelocity'],
        metrics['inventoryTurnover'], metrics['daysInventoryOutstanding'],
        metrics['abcClassification'], metrics['performanceScore']
    ))
```

### Lambda Configuration

```yaml
# lambda-config-product-performance.yaml
FunctionName: product-performance-analyzer
Runtime: python3.9
Handler: lambda_function.lambda_handler
Timeout: 30
MemorySize: 256
Environment:
  Variables:
    DB_HOST: !Ref RDSEndpoint
    DB_USER: !Ref DBUsername
    DB_PASSWORD: !Ref DBPassword
    DB_NAME: invencare
```

## 2. Demand Forecasting Engine Lambda

### Function Code

```python
import json
import boto3
import pymysql
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

def lambda_handler(event, context):
    """
    Generate demand forecasts using multiple ML models

    Event structure:
    {
        "productId": "string",
        "storeId": "string",
        "forecastPeriod": 30,  // days
        "models": ["linear", "seasonal", "arima", "ensemble"]
    }
    """

    try:
        product_id = event.get('productId')
        store_id = event.get('storeId')
        forecast_period = event.get('forecastPeriod', 30)
        requested_models = event.get('models', ['linear', 'seasonal', 'ensemble'])

        if not product_id or not store_id:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Missing required parameters'
                })
            }

        # Database connection
        connection = get_db_connection()

        # Get historical sales data
        historical_data = get_historical_sales_data(
            connection, product_id, store_id, days=90
        )

        if len(historical_data) < 7:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Insufficient historical data for forecasting'
                })
            }

        # Generate forecasts
        forecasts = generate_forecasts(
            historical_data, forecast_period, requested_models
        )

        # Store forecast results
        store_forecast_results(
            connection, product_id, store_id, forecasts, forecast_period
        )

        connection.close()

        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'productId': product_id,
                'storeId': store_id,
                'forecastPeriod': forecast_period,
                'forecasts': forecasts,
                'historicalDataPoints': len(historical_data),
                'timestamp': datetime.now().isoformat()
            })
        }

    except Exception as e:
        print(f"Error in demand forecasting: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Forecasting failed',
                'message': str(e)
            })
        }

def get_historical_sales_data(connection, product_id, store_id, days=90):
    """Retrieve historical sales data"""

    with connection.cursor() as cursor:
        query = """
        SELECT
            DATE(created_at) as sale_date,
            SUM(quantity) as daily_sales
        FROM inventory_transactions
        WHERE product_id = %s
            AND store_id = %s
            AND transaction_type = 'sale'
            AND created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
        GROUP BY DATE(created_at)
        ORDER BY sale_date
        """

        cursor.execute(query, (product_id, store_id, days))
        results = cursor.fetchall()

        # Convert to pandas DataFrame
        df = pd.DataFrame(results)
        if not df.empty:
            df['sale_date'] = pd.to_datetime(df['sale_date'])
            df.set_index('sale_date', inplace=True)
            df = df.reindex(pd.date_range(
                start=df.index.min(),
                end=df.index.max(),
                freq='D'
            ), fill_value=0)

        return df

def generate_forecasts(historical_data, forecast_period, models):
    """Generate forecasts using multiple models"""

    sales_values = historical_data['daily_sales'].values
    forecasts = {}

    # Linear trend forecast
    if 'linear' in models:
        forecasts['linear'] = linear_forecast(sales_values, forecast_period)

    # Seasonal forecast
    if 'seasonal' in models:
        forecasts['seasonal'] = seasonal_forecast(sales_values, forecast_period)

    # ARIMA-like forecast
    if 'arima' in models:
        forecasts['arima'] = arima_forecast(sales_values, forecast_period)

    # LSTM-like pattern forecast
    if 'lstm' in models:
        forecasts['lstm'] = lstm_pattern_forecast(sales_values, forecast_period)

    # Ensemble forecast
    if 'ensemble' in models:
        model_forecasts = [f for f in forecasts.values()]
        if model_forecasts:
            forecasts['ensemble'] = np.mean(model_forecasts, axis=0).tolist()
        else:
            forecasts['ensemble'] = linear_forecast(sales_values, forecast_period)

    # Calculate confidence intervals
    ensemble_values = forecasts.get('ensemble', forecasts.get('linear', [0]))
    if isinstance(ensemble_values, list) and ensemble_values:
        mean_forecast = np.mean(ensemble_values)
        std_forecast = np.std(ensemble_values) if len(ensemble_values) > 1 else mean_forecast * 0.2

        forecasts['confidenceIntervalLower'] = max(0, mean_forecast - 1.96 * std_forecast)
        forecasts['confidenceIntervalUpper'] = mean_forecast + 1.96 * std_forecast
    else:
        forecasts['confidenceIntervalLower'] = 0
        forecasts['confidenceIntervalUpper'] = 0

    # Calculate accuracy score (mock for now)
    forecasts['accuracyScore'] = calculate_forecast_accuracy(sales_values)

    return forecasts

def linear_forecast(sales_data, forecast_period):
    """Simple linear trend forecast"""
    if len(sales_data) < 2:
        return [sales_data[-1] if sales_data else 0] * forecast_period

    X = np.arange(len(sales_data)).reshape(-1, 1)
    y = sales_data

    model = LinearRegression()
    model.fit(X, y)

    future_X = np.arange(len(sales_data), len(sales_data) + forecast_period).reshape(-1, 1)
    forecast = model.predict(future_X)

    return np.maximum(forecast, 0).tolist()  # Ensure non-negative

def seasonal_forecast(sales_data, forecast_period):
    """Seasonal pattern forecast"""
    if len(sales_data) < 14:
        return linear_forecast(sales_data, forecast_period)

    # Calculate weekly seasonality
    weekly_pattern = []
    for day in range(7):
        day_values = [sales_data[i] for i in range(day, len(sales_data), 7)]
        weekly_pattern.append(np.mean(day_values) if day_values else 0)

    # Apply trend
    recent_avg = np.mean(sales_data[-7:]) if len(sales_data) >= 7 else np.mean(sales_data)
    overall_avg = np.mean(sales_data)
    trend_factor = recent_avg / overall_avg if overall_avg > 0 else 1

    forecast = []
    for day in range(forecast_period):
        seasonal_value = weekly_pattern[day % 7] * trend_factor
        forecast.append(max(0, seasonal_value))

    return forecast

def arima_forecast(sales_data, forecast_period):
    """Simplified ARIMA-like forecast"""
    if len(sales_data) < 3:
        return linear_forecast(sales_data, forecast_period)

    # Moving average with trend
    window = min(7, len(sales_data) // 2)
    ma = np.convolve(sales_data, np.ones(window)/window, mode='valid')

    if len(ma) > 1:
        trend = (ma[-1] - ma[0]) / (len(ma) - 1)
    else:
        trend = 0

    last_value = sales_data[-1]
    forecast = []

    for i in range(forecast_period):
        predicted_value = last_value + trend * (i + 1)
        # Add some noise dampening
        predicted_value *= (0.95 ** (i // 7))  # Dampen over weeks
        forecast.append(max(0, predicted_value))

    return forecast

def lstm_pattern_forecast(sales_data, forecast_period):
    """Pattern-based forecast mimicking LSTM"""
    if len(sales_data) < 7:
        return seasonal_forecast(sales_data, forecast_period)

    # Look for weekly patterns
    weekly_patterns = []
    for week_start in range(0, len(sales_data) - 6, 7):
        week_data = sales_data[week_start:week_start + 7]
        if len(week_data) == 7:
            weekly_patterns.append(week_data)

    if not weekly_patterns:
        return seasonal_forecast(sales_data, forecast_period)

    # Average recent patterns
    recent_patterns = weekly_patterns[-4:] if len(weekly_patterns) >= 4 else weekly_patterns
    avg_pattern = np.mean(recent_patterns, axis=0)

    # Scale based on recent trend
    recent_total = np.sum(sales_data[-7:]) if len(sales_data) >= 7 else np.sum(sales_data)
    pattern_total = np.sum(avg_pattern)
    scale_factor = recent_total / pattern_total if pattern_total > 0 else 1

    forecast = []
    for day in range(forecast_period):
        pattern_value = avg_pattern[day % 7] * scale_factor
        # Add slight decay for longer forecasts
        decay_factor = 0.99 ** (day // 7)
        forecast.append(max(0, pattern_value * decay_factor))

    return forecast

def calculate_forecast_accuracy(sales_data):
    """Calculate historical forecast accuracy"""
    if len(sales_data) < 14:
        return 0.75  # Default moderate accuracy

    # Simple accuracy based on data consistency
    cv = np.std(sales_data) / np.mean(sales_data) if np.mean(sales_data) > 0 else 1

    # Lower coefficient of variation = higher accuracy
    accuracy = max(0.5, min(0.95, 1 - cv))
    return round(accuracy, 3)

def store_forecast_results(connection, product_id, store_id, forecasts, forecast_period):
    """Store forecast results in database"""

    with connection.cursor() as cursor:
        forecast_date = datetime.now().date()

        # Clean up old forecasts for this product/store
        cursor.execute("""
            DELETE FROM product_demand_forecasts
            WHERE product_id = %s AND store_id = %s AND forecast_date = %s
        """, (product_id, store_id, forecast_date))

        # Insert new forecast
        query = """
        INSERT INTO product_demand_forecasts
        (product_id, store_id, forecast_date, forecast_period,
         linear_forecast, seasonal_forecast, arima_forecast, lstm_forecast,
         ensemble_forecast, confidence_interval_lower, confidence_interval_upper,
         forecast_accuracy_score)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        cursor.execute(query, (
            product_id, store_id, forecast_date, forecast_period,
            sum(forecasts.get('linear', [0])),
            sum(forecasts.get('seasonal', [0])),
            sum(forecasts.get('arima', [0])),
            sum(forecasts.get('lstm', [0])),
            sum(forecasts.get('ensemble', [0])),
            forecasts.get('confidenceIntervalLower', 0),
            forecasts.get('confidenceIntervalUpper', 0),
            forecasts.get('accuracyScore', 0.75)
        ))

        connection.commit()

def get_db_connection():
    """Create database connection"""
    return pymysql.connect(
        host=os.environ['DB_HOST'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        database=os.environ['DB_NAME'],
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
```

## 3. Inventory Optimizer Lambda

### Function Code

```python
import json
import boto3
import pymysql
import os
from datetime import datetime, timedelta
import numpy as np

def lambda_handler(event, context):
    """
    Generate inventory optimization recommendations

    Event structure:
    {
        "storeId": "string",
        "includeAllProducts": false,  // if false, only low stock
        "optimizationGoal": "cost" | "service_level" | "balanced"
    }
    """

    try:
        store_id = event.get('storeId')
        include_all = event.get('includeAllProducts', False)
        optimization_goal = event.get('optimizationGoal', 'balanced')

        if not store_id:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Missing required parameter: storeId'
                })
            }

        connection = get_db_connection()

        # Get products for optimization
        products = get_products_for_optimization(connection, store_id, include_all)

        # Generate recommendations for each product
        recommendations = []
        for product in products:
            try:
                recommendation = generate_product_recommendation(
                    connection, product, optimization_goal
                )
                if recommendation:
                    recommendations.append(recommendation)
            except Exception as e:
                print(f"Error processing product {product['id']}: {str(e)}")
                continue

        # Store recommendations
        store_optimization_recommendations(connection, recommendations)

        connection.close()

        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'storeId': store_id,
                'optimizationGoal': optimization_goal,
                'totalRecommendations': len(recommendations),
                'recommendations': recommendations,
                'timestamp': datetime.now().isoformat()
            })
        }

    except Exception as e:
        print(f"Error in inventory optimization: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Optimization failed',
                'message': str(e)
            })
        }

def get_products_for_optimization(connection, store_id, include_all):
    """Get products that need optimization"""

    with connection.cursor() as cursor:
        if include_all:
            query = """
            SELECT
                id, name, quantity as current_stock, minimum_stock,
                maximum_stock, price, category
            FROM products
            WHERE store_id = %s AND status = 'active'
            ORDER BY name
            """
            cursor.execute(query, (store_id,))
        else:
            # Only products with potential stock issues
            query = """
            SELECT
                id, name, quantity as current_stock, minimum_stock,
                maximum_stock, price, category
            FROM products
            WHERE store_id = %s AND status = 'active'
                AND (quantity <= minimum_stock * 1.2 OR quantity >= maximum_stock * 0.9)
            ORDER BY (minimum_stock - quantity) DESC
            """
            cursor.execute(query, (store_id,))

        return cursor.fetchall()

def generate_product_recommendation(connection, product, optimization_goal):
    """Generate optimization recommendation for a single product"""

    product_id = product['id']
    store_id = get_store_id_for_product(connection, product_id)

    # Get recent sales data
    sales_data = get_recent_sales_data(connection, product_id, store_id, days=30)

    # Get latest demand forecast if available
    forecast_data = get_demand_forecast(connection, product_id, store_id)

    # Calculate key metrics
    metrics = calculate_inventory_metrics(product, sales_data, forecast_data)

    # Generate recommendation based on optimization goal
    recommendation = generate_recommendation_logic(
        product, metrics, optimization_goal
    )

    return recommendation

def get_store_id_for_product(connection, product_id):
    """Get store ID for a product"""
    with connection.cursor() as cursor:
        cursor.execute("SELECT store_id FROM products WHERE id = %s", (product_id,))
        result = cursor.fetchone()
        return result['store_id'] if result else None

def get_recent_sales_data(connection, product_id, store_id, days=30):
    """Get recent sales data for demand calculation"""

    with connection.cursor() as cursor:
        query = """
        SELECT
            SUM(quantity) as total_sold,
            COUNT(*) as transaction_count,
            AVG(quantity) as avg_transaction_size,
            DATEDIFF(NOW(), MIN(created_at)) as days_with_sales
        FROM inventory_transactions
        WHERE product_id = %s
            AND store_id = %s
            AND transaction_type = 'sale'
            AND created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
        """

        cursor.execute(query, (product_id, store_id, days))
        result = cursor.fetchone()

        return {
            'totalSold': result.get('total_sold', 0) or 0,
            'transactionCount': result.get('transaction_count', 0) or 0,
            'avgTransactionSize': result.get('avg_transaction_size', 0) or 0,
            'daysWithSales': result.get('days_with_sales', 0) or 0
        }

def get_demand_forecast(connection, product_id, store_id):
    """Get latest demand forecast for the product"""

    with connection.cursor() as cursor:
        query = """
        SELECT
            ensemble_forecast,
            confidence_interval_lower,
            confidence_interval_upper,
            forecast_accuracy_score
        FROM product_demand_forecasts
        WHERE product_id = %s AND store_id = %s
        ORDER BY created_at DESC
        LIMIT 1
        """

        cursor.execute(query, (product_id, store_id))
        result = cursor.fetchone()

        if result:
            return {
                'forecastDemand': result.get('ensemble_forecast', 0) or 0,
                'lowerBound': result.get('confidence_interval_lower', 0) or 0,
                'upperBound': result.get('confidence_interval_upper', 0) or 0,
                'accuracy': result.get('forecast_accuracy_score', 0.75) or 0.75
            }

        return None

def calculate_inventory_metrics(product, sales_data, forecast_data):
    """Calculate key inventory metrics"""

    current_stock = product['current_stock']
    min_stock = product['minimum_stock']
    max_stock = product['maximum_stock']

    # Calculate demand rate
    total_sold = sales_data['totalSold']
    if forecast_data:
        # Use forecast for future demand
        daily_demand = forecast_data['forecastDemand'] / 30  # Assume 30-day forecast
    else:
        # Use historical average
        daily_demand = total_sold / 30 if total_sold > 0 else 0.1

    # Calculate key metrics
    days_of_stock = current_stock / daily_demand if daily_demand > 0 else 999

    # Service level calculation
    if current_stock <= 0:
        service_level = 0.0
    elif current_stock <= min_stock:
        service_level = 0.8
    elif current_stock >= max_stock:
        service_level = 0.99
    else:
        # Linear interpolation between min and max
        stock_ratio = (current_stock - min_stock) / (max_stock - min_stock)
        service_level = 0.8 + (stock_ratio * 0.19)  # 80% to 99%

    # Stockout probability
    if forecast_data:
        demand_uncertainty = (forecast_data['upperBound'] - forecast_data['lowerBound']) / 2
        stockout_prob = calculate_stockout_probability(
            current_stock, daily_demand, demand_uncertainty
        )
    else:
        stockout_prob = 0.1 if current_stock > min_stock else 0.5

    return {
        'dailyDemand': daily_demand,
        'daysOfStock': days_of_stock,
        'serviceLevel': service_level,
        'stockoutProbability': stockout_prob,
        'demandVariability': demand_uncertainty if forecast_data else daily_demand * 0.3
    }

def calculate_stockout_probability(current_stock, daily_demand, demand_std):
    """Calculate probability of stockout in next 7 days"""

    # Simple normal distribution approximation
    days_forecast = 7
    expected_demand = daily_demand * days_forecast
    demand_variance = (demand_std ** 2) * days_forecast

    if demand_variance <= 0:
        return 0.0 if current_stock >= expected_demand else 1.0

    # Z-score calculation
    z_score = (current_stock - expected_demand) / np.sqrt(demand_variance)

    # Convert to probability (rough approximation)
    if z_score >= 2:
        return 0.025
    elif z_score >= 1:
        return 0.16
    elif z_score >= 0:
        return 0.5
    elif z_score >= -1:
        return 0.84
    else:
        return 0.975

def generate_recommendation_logic(product, metrics, optimization_goal):
    """Generate the actual recommendation"""

    current_stock = product['current_stock']
    min_stock = product['minimum_stock']
    max_stock = product['maximum_stock']
    daily_demand = metrics['dailyDemand']

    # Determine recommended stock level based on goal
    if optimization_goal == 'cost':
        # Minimize holding costs
        target_stock = min_stock + (daily_demand * 7)  # 1 week buffer
    elif optimization_goal == 'service_level':
        # Maximize service level
        target_stock = min_stock + (daily_demand * 14)  # 2 week buffer
    else:  # balanced
        # Balance cost and service
        target_stock = min_stock + (daily_demand * 10)  # 1.5 week buffer

    # Ensure target is within bounds
    target_stock = max(min_stock, min(target_stock, max_stock))

    # Calculate recommended order quantity
    recommended_order = max(0, target_stock - current_stock)

    # Determine urgency
    if current_stock == 0:
        urgency = 'critical'
    elif current_stock <= min_stock * 0.5:
        urgency = 'high'
    elif current_stock <= min_stock:
        urgency = 'medium'
    else:
        urgency = 'low'

    # Determine recommendation type
    if current_stock >= max_stock * 0.9:
        rec_type = 'reduce'
    elif recommended_order > 0:
        rec_type = 'increase'
    else:
        rec_type = 'maintain'

    # Calculate potential impact
    cost_savings = calculate_cost_savings(
        current_stock, target_stock, product['price'], daily_demand
    )

    return {
        'productId': product['id'],
        'productName': product['name'],
        'category': product['category'],
        'currentStock': current_stock,
        'recommendedStock': int(target_stock),
        'recommendedOrderQuantity': int(recommended_order),
        'urgencyLevel': urgency,
        'recommendationType': rec_type,
        'estimatedDailyDemand': round(daily_demand, 2),
        'daysOfStockCurrent': round(metrics['daysOfStock'], 1),
        'serviceLevel': round(metrics['serviceLevel'], 3),
        'stockoutProbability': round(metrics['stockoutProbability'], 3),
        'estimatedCostSavings': round(cost_savings, 2),
        'reasoning': generate_reasoning(product, metrics, urgency, rec_type),
        'implementationPriority': map_urgency_to_priority(urgency)
    }

def calculate_cost_savings(current_stock, target_stock, unit_price, daily_demand):
    """Calculate estimated cost savings from optimization"""

    # Holding cost (simplified - assume 20% annual holding cost)
    daily_holding_rate = 0.20 / 365

    # Current holding cost
    current_holding_cost = current_stock * unit_price * daily_holding_rate * 30

    # Target holding cost
    target_holding_cost = target_stock * unit_price * daily_holding_rate * 30

    # Stockout cost (simplified - assume 50% margin loss)
    stockout_cost_current = max(0, (daily_demand * 30 - current_stock)) * unit_price * 0.5
    stockout_cost_target = max(0, (daily_demand * 30 - target_stock)) * unit_price * 0.5

    # Total savings
    holding_savings = current_holding_cost - target_holding_cost
    stockout_savings = stockout_cost_current - stockout_cost_target

    return holding_savings + stockout_savings

def generate_reasoning(product, metrics, urgency, rec_type):
    """Generate human-readable reasoning for the recommendation"""

    reasons = []

    current_stock = product['current_stock']
    min_stock = product['minimum_stock']
    days_stock = metrics['daysOfStock']
    daily_demand = metrics['dailyDemand']

    if current_stock == 0:
        reasons.append("Product is out of stock - immediate reorder required")
    elif current_stock <= min_stock:
        reasons.append(f"Stock below minimum threshold ({min_stock} units)")

    if days_stock < 7:
        reasons.append(f"Only {days_stock:.1f} days of stock remaining")
    elif days_stock > 30:
        reasons.append(f"Excess inventory - {days_stock:.1f} days of stock")

    if daily_demand > 0:
        reasons.append(f"Average daily demand: {daily_demand:.1f} units")
    else:
        reasons.append("Low or no recent sales activity")

    if metrics['stockoutProbability'] > 0.3:
        reasons.append(f"High stockout risk: {metrics['stockoutProbability']:.1%}")

    return "; ".join(reasons) if reasons else "Standard inventory optimization"

def map_urgency_to_priority(urgency):
    """Map urgency level to priority"""
    mapping = {
        'critical': 'high',
        'high': 'high',
        'medium': 'medium',
        'low': 'low'
    }
    return mapping.get(urgency, 'medium')

def store_optimization_recommendations(connection, recommendations):
    """Store recommendations in database"""

    with connection.cursor() as cursor:
        for rec in recommendations:
            query = """
            INSERT INTO product_reorder_recommendations
            (product_id, store_id, recommendation_date, current_stock,
             minimum_stock, maximum_stock, projected_demand_14_days,
             recommended_order_quantity, urgency_level, status, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            current_stock = VALUES(current_stock),
            projected_demand_14_days = VALUES(projected_demand_14_days),
            recommended_order_quantity = VALUES(recommended_order_quantity),
            urgency_level = VALUES(urgency_level),
            notes = VALUES(notes),
            updated_at = CURRENT_TIMESTAMP
            """

            # Get store_id for the product
            store_query = "SELECT store_id FROM products WHERE id = %s"
            cursor.execute(store_query, (rec['productId'],))
            store_result = cursor.fetchone()
            store_id = store_result['store_id'] if store_result else 'unknown'

            cursor.execute(query, (
                rec['productId'], store_id, datetime.now().date(),
                rec['currentStock'], rec.get('minimumStock', 0),
                rec.get('maximumStock', 100),
                int(rec['estimatedDailyDemand'] * 14),
                rec['recommendedOrderQuantity'], rec['urgencyLevel'],
                'pending', rec['reasoning']
            ))

        connection.commit()

def get_db_connection():
    """Create database connection"""
    return pymysql.connect(
        host=os.environ['DB_HOST'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        database=os.environ['DB_NAME'],
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
```

## 4. Analytics Dashboard Generator Lambda

### Function Code

```python
import json
import boto3
import pymysql
import os
from datetime import datetime, timedelta

def lambda_handler(event, context):
    """
    Generate analytics dashboard data

    Event structure:
    {
        "storeId": "string",
        "period": "daily" | "weekly" | "monthly",
        "includeForecasts": true,
        "includeRecommendations": true
    }
    """

    try:
        store_id = event.get('storeId')
        period = event.get('period', 'monthly')
        include_forecasts = event.get('includeForecasts', True)
        include_recommendations = event.get('includeRecommendations', True)

        if not store_id:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Missing required parameter: storeId'
                })
            }

        connection = get_db_connection()

        # Generate dashboard data
        dashboard_data = {
            'storeId': store_id,
            'period': period,
            'generatedAt': datetime.now().isoformat(),
            'summary': generate_summary_metrics(connection, store_id, period),
            'topProducts': get_top_performing_products(connection, store_id, period),
            'categoryPerformance': get_category_performance(connection, store_id, period),
            'inventoryAlerts': get_inventory_alerts(connection, store_id),
            'salesTrends': get_sales_trends(connection, store_id, period)
        }

        if include_forecasts:
            dashboard_data['demandForecasts'] = get_demand_forecast_summary(
                connection, store_id
            )

        if include_recommendations:
            dashboard_data['recommendations'] = get_optimization_recommendations(
                connection, store_id
            )

        connection.close()

        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'dashboard': dashboard_data
            })
        }

    except Exception as e:
        print(f"Error generating dashboard: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Dashboard generation failed',
                'message': str(e)
            })
        }

def generate_summary_metrics(connection, store_id, period):
    """Generate high-level summary metrics"""

    days = {'daily': 1, 'weekly': 7, 'monthly': 30}[period]

    with connection.cursor() as cursor:
        # Sales metrics
        sales_query = """
        SELECT
            COUNT(*) as transaction_count,
            SUM(total_amount) as total_revenue,
            SUM(quantity) as total_units_sold,
            COUNT(DISTINCT product_id) as unique_products_sold
        FROM inventory_transactions
        WHERE store_id = %s
            AND transaction_type = 'sale'
            AND created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
        """

        cursor.execute(sales_query, (store_id, days))
        sales_data = cursor.fetchone() or {}

        # Inventory metrics
        inventory_query = """
        SELECT
            COUNT(*) as total_products,
            SUM(quantity) as total_stock_units,
            SUM(price * quantity) as total_inventory_value,
            COUNT(CASE WHEN quantity <= minimum_stock THEN 1 END) as low_stock_items,
            COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_items
        FROM products
        WHERE store_id = %s AND status = 'active'
        """

        cursor.execute(inventory_query, (store_id,))
        inventory_data = cursor.fetchone() or {}

        return {
            'sales': {
                'totalRevenue': float(sales_data.get('total_revenue', 0) or 0),
                'totalTransactions': sales_data.get('transaction_count', 0) or 0,
                'totalUnitsSold': sales_data.get('total_units_sold', 0) or 0,
                'uniqueProductsSold': sales_data.get('unique_products_sold', 0) or 0,
                'averageTransactionValue': (
                    float(sales_data.get('total_revenue', 0) or 0) /
                    max(1, sales_data.get('transaction_count', 0) or 1)
                )
            },
            'inventory': {
                'totalProducts': inventory_data.get('total_products', 0) or 0,
                'totalStockUnits': inventory_data.get('total_stock_units', 0) or 0,
                'totalInventoryValue': float(inventory_data.get('total_inventory_value', 0) or 0),
                'lowStockItems': inventory_data.get('low_stock_items', 0) or 0,
                'outOfStockItems': inventory_data.get('out_of_stock_items', 0) or 0,
                'stockHealthScore': calculate_stock_health_score(inventory_data)
            }
        }

def calculate_stock_health_score(inventory_data):
    """Calculate overall stock health score (0-100)"""

    total_products = inventory_data.get('total_products', 0) or 1
    low_stock = inventory_data.get('low_stock_items', 0) or 0
    out_of_stock = inventory_data.get('out_of_stock_items', 0) or 0

    # Penalize out of stock more heavily
    health_score = 100 - (
        (out_of_stock / total_products) * 60 +
        (low_stock / total_products) * 30
    ) * 100

    return max(0, min(100, health_score))

def get_top_performing_products(connection, store_id, period):
    """Get top performing products by revenue"""

    days = {'daily': 1, 'weekly': 7, 'monthly': 30}[period]

    with connection.cursor() as cursor:
        query = """
        SELECT
            it.product_id,
            it.product_name,
            it.category,
            SUM(it.quantity) as total_sold,
            SUM(it.total_amount) as total_revenue,
            COUNT(*) as transaction_count,
            AVG(it.unit_price) as avg_price
        FROM inventory_transactions it
        WHERE it.store_id = %s
            AND it.transaction_type = 'sale'
            AND it.created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
        GROUP BY it.product_id, it.product_name, it.category
        ORDER BY total_revenue DESC
        LIMIT 10
        """

        cursor.execute(query, (store_id, days))
        results = cursor.fetchall()

        return [
            {
                'productId': row['product_id'],
                'productName': row['product_name'],
                'category': row['category'],
                'totalSold': row['total_sold'] or 0,
                'totalRevenue': float(row['total_revenue'] or 0),
                'transactionCount': row['transaction_count'] or 0,
                'averagePrice': float(row['avg_price'] or 0)
            }
            for row in results
        ]

def get_category_performance(connection, store_id, period):
    """Get performance metrics by category"""

    days = {'daily': 1, 'weekly': 7, 'monthly': 30}[period]

    with connection.cursor() as cursor:
        query = """
        SELECT
            it.category,
            SUM(it.quantity) as total_sold,
            SUM(it.total_amount) as total_revenue,
            COUNT(DISTINCT it.product_id) as unique_products,
            COUNT(*) as transaction_count
        FROM inventory_transactions it
        WHERE it.store_id = %s
            AND it.transaction_type = 'sale'
            AND it.created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
        GROUP BY it.category
        ORDER BY total_revenue DESC
        """

        cursor.execute(query, (store_id, days))
        results = cursor.fetchall()

        return [
            {
                'category': row['category'],
                'totalSold': row['total_sold'] or 0,
                'totalRevenue': float(row['total_revenue'] or 0),
                'uniqueProducts': row['unique_products'] or 0,
                'transactionCount': row['transaction_count'] or 0
            }
            for row in results
        ]

def get_inventory_alerts(connection, store_id):
    """Get current inventory alerts"""

    with connection.cursor() as cursor:
        query = """
        SELECT
            id as product_id,
            name as product_name,
            category,
            quantity as current_stock,
            minimum_stock,
            maximum_stock,
            CASE
                WHEN quantity = 0 THEN 'Out of Stock'
                WHEN quantity <= minimum_stock * 0.5 THEN 'Critical Low'
                WHEN quantity <= minimum_stock THEN 'Low Stock'
                WHEN quantity >= maximum_stock * 0.9 THEN 'Overstocked'
                ELSE 'Normal'
            END as alert_type,
            CASE
                WHEN quantity = 0 THEN 1
                WHEN quantity <= minimum_stock * 0.5 THEN 2
                WHEN quantity <= minimum_stock THEN 3
                WHEN quantity >= maximum_stock * 0.9 THEN 4
                ELSE 5
            END as priority_order
        FROM products
        WHERE store_id = %s
            AND status = 'active'
            AND (quantity <= minimum_stock OR quantity >= maximum_stock * 0.9)
        ORDER BY priority_order ASC, quantity ASC
        """

        cursor.execute(query, (store_id,))
        results = cursor.fetchall()

        return [
            {
                'productId': row['product_id'],
                'productName': row['product_name'],
                'category': row['category'],
                'currentStock': row['current_stock'],
                'minimumStock': row['minimum_stock'],
                'maximumStock': row['maximum_stock'],
                'alertType': row['alert_type'],
                'severity': ['Critical', 'High', 'Medium', 'Low', 'Info'][row['priority_order'] - 1]
            }
            for row in results
        ]

def get_sales_trends(connection, store_id, period):
    """Get sales trends data"""

    days = {'daily': 7, 'weekly': 4*7, 'monthly': 12*30}[period]
    group_by = {
        'daily': 'DATE(created_at)',
        'weekly': 'YEARWEEK(created_at)',
        'monthly': 'YEAR(created_at), MONTH(created_at)'
    }[period]

    with connection.cursor() as cursor:
        query = f"""
        SELECT
            {group_by} as time_period,
            SUM(total_amount) as revenue,
            SUM(quantity) as units_sold,
            COUNT(*) as transaction_count
        FROM inventory_transactions
        WHERE store_id = %s
            AND transaction_type = 'sale'
            AND created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
        GROUP BY {group_by}
        ORDER BY time_period
        """

        cursor.execute(query, (store_id, days))
        results = cursor.fetchall()

        return [
            {
                'period': str(row['time_period']),
                'revenue': float(row['revenue'] or 0),
                'unitsSold': row['units_sold'] or 0,
                'transactionCount': row['transaction_count'] or 0
            }
            for row in results
        ]

def get_demand_forecast_summary(connection, store_id):
    """Get summary of demand forecasts"""

    with connection.cursor() as cursor:
        query = """
        SELECT
            COUNT(*) as total_forecasts,
            AVG(forecast_accuracy_score) as avg_accuracy,
            SUM(ensemble_forecast) as total_predicted_demand
        FROM product_demand_forecasts pdf
        JOIN products p ON pdf.product_id = p.id
        WHERE p.store_id = %s
            AND pdf.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        """

        cursor.execute(query, (store_id,))
        result = cursor.fetchone() or {}

        return {
            'totalForecasts': result.get('total_forecasts', 0) or 0,
            'averageAccuracy': float(result.get('avg_accuracy', 0) or 0),
            'totalPredictedDemand': float(result.get('total_predicted_demand', 0) or 0)
        }

def get_optimization_recommendations(connection, store_id):
    """Get current optimization recommendations"""

    with connection.cursor() as cursor:
        query = """
        SELECT
            COUNT(*) as total_recommendations,
            COUNT(CASE WHEN urgency_level = 'critical' THEN 1 END) as critical_count,
            COUNT(CASE WHEN urgency_level = 'high' THEN 1 END) as high_count,
            COUNT(CASE WHEN urgency_level = 'medium' THEN 1 END) as medium_count,
            COUNT(CASE WHEN urgency_level = 'low' THEN 1 END) as low_count
        FROM product_reorder_recommendations
        WHERE store_id = %s
            AND status = 'pending'
            AND recommendation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        """

        cursor.execute(query, (store_id,))
        result = cursor.fetchone() or {}

        return {
            'totalRecommendations': result.get('total_recommendations', 0) or 0,
            'urgencyBreakdown': {
                'critical': result.get('critical_count', 0) or 0,
                'high': result.get('high_count', 0) or 0,
                'medium': result.get('medium_count', 0) or 0,
                'low': result.get('low_count', 0) or 0
            }
        }

def get_db_connection():
    """Create database connection"""
    return pymysql.connect(
        host=os.environ['DB_HOST'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        database=os.environ['DB_NAME'],
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
```

## Deployment Instructions

### 1. Create Lambda Functions

```bash
# Create deployment packages
for func in product-performance-analyzer demand-forecasting-engine inventory-optimizer analytics-dashboard-generator; do
    mkdir $func-package
    cp $func.py $func-package/lambda_function.py
    cd $func-package
    pip install pymysql pandas numpy scikit-learn -t .
    zip -r ../$func.zip .
    cd ..
done
```

### 2. Deploy with AWS CLI

```bash
# Create functions
aws lambda create-function \
    --function-name product-performance-analyzer \
    --runtime python3.9 \
    --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
    --handler lambda_function.lambda_handler \
    --zip-file fileb://product-performance-analyzer.zip \
    --timeout 30 \
    --memory-size 256 \
    --environment Variables='{
        "DB_HOST":"your-rds-endpoint",
        "DB_USER":"admin",
        "DB_PASSWORD":"your-password",
        "DB_NAME":"invencare"
    }'

# Repeat for other functions...
```

### 3. Set up API Gateway (Optional)

```yaml
# api-gateway.yaml
Resources:
  ProductAnalyticsAPI:
    Type: AWS::ApiGateway::RestApi
    Properties:
      Name: ProductAnalyticsAPI

  ProductPerformanceResource:
    Type: AWS::ApiGateway::Resource
    Properties:
      RestApiId: !Ref ProductAnalyticsAPI
      ParentId: !GetAtt ProductAnalyticsAPI.RootResourceId
      PathPart: performance

  ProductPerformanceMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref ProductAnalyticsAPI
      ResourceId: !Ref ProductPerformanceResource
      HttpMethod: POST
      AuthorizationType: NONE
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${ProductPerformanceAnalyzer}/invocations
```

### 4. Test the Functions

```python
# Test script
import json
import boto3

lambda_client = boto3.client('lambda')

# Test product performance analyzer
test_event = {
    "productId": "1",
    "storeId": "store_001",
    "analysisPeriod": 30
}

response = lambda_client.invoke(
    FunctionName='product-performance-analyzer',
    Payload=json.dumps(test_event)
)

print(json.loads(response['Payload'].read()))
```

## Environment Variables Required

- `DB_HOST`: RDS endpoint
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name (invencare)

## IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": ["rds:DescribeDBInstances", "rds-db:connect"],
      "Resource": "*"
    }
  ]
}
```

These Lambda functions provide comprehensive product analytics capabilities including performance analysis, demand forecasting, inventory optimization, and dashboard generation. They can be integrated with the frontend through API calls or triggered by events.
