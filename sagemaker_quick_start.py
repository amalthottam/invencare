#!/usr/bin/env python3
"""
SageMaker Quick Start for InvenCare Forecasting

This is a simplified version of the forecasting pipeline that you can run directly
in SageMaker Jupyter Lab or as a standalone script. Uses your exact pymysql setup.
"""

import pymysql
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta

def main():
    """Quick start forecasting pipeline"""
    print("🚀 InvenCare SageMaker Forecasting - Quick Start")
    print("=" * 55)
    
    # Your existing database configuration
    config = {
        'user': 'admin',
        'password': 'InvenCare123',  # 🔒 Your existing password
        'host': 'invencaredb.cihe2wg8etco.us-east-1.rds.amazonaws.com',
        'database': 'invencare',
        'port': 3306
    }
    
    # Connect and test
    try:
        print("1️⃣ Connecting to database...")
        connection = pymysql.connect(**config)
        print("✅ Connected to MySQL database!")

        with connection.cursor() as cursor:
            # Get sample products
            cursor.execute("""
                SELECT p.id, p.name, p.store_id, s.name as store_name
                FROM products p 
                JOIN stores s ON p.store_id = s.id
                WHERE p.status = 'active' AND s.status = 'active'
                LIMIT 5
            """)
            products = cursor.fetchall()
            print(f"📦 Found {len(products)} products to forecast")
            
            # Create forecasting tables if they don't exist
            print("\n2️⃣ Setting up forecasting tables...")
            
            # Models table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS demand_forecasting_models (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    model_name VARCHAR(255) NOT NULL UNIQUE,
                    model_type ENUM('arima', 'lstm', 'prophet', 'linear_regression') NOT NULL,
                    model_accuracy DECIMAL(5,4),
                    training_status ENUM('training', 'deployed', 'failed') DEFAULT 'deployed',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Predictions table
            cursor.execute("""
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
                    UNIQUE KEY unique_prediction (product_id, store_id, model_id, prediction_date)
                )
            """)
            
            # Insert a sample model
            cursor.execute("""
                INSERT IGNORE INTO demand_forecasting_models 
                (model_name, model_type, model_accuracy)
                VALUES ('SageMaker_Quick_Start', 'linear_regression', 0.75)
            """)
            
            connection.commit()
            print("✅ Forecasting tables ready")
            
            # Generate predictions for each product
            print("\n3️⃣ Generating forecasts...")
            total_predictions = 0
            
            for product_id, product_name, store_id, store_name in products:
                print(f"🔄 Processing: {product_name} ({store_name})")
                
                # Get historical sales data
                cursor.execute("""
                    SELECT DATE(created_at) as date, 
                           SUM(CASE WHEN transaction_type = 'sale' THEN ABS(quantity) ELSE 0 END) as demand
                    FROM inventory_transactions 
                    WHERE product_id = %s AND store_id = %s 
                    AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    GROUP BY DATE(created_at)
                    ORDER BY date
                """, (product_id, store_id))
                
                historical_data = cursor.fetchall()
                
                if len(historical_data) >= 3:  # Need at least 3 days of data
                    # Convert to DataFrame for easier processing
                    df = pd.DataFrame(historical_data, columns=['date', 'demand'])
                    
                    # Simple forecasting: use average demand + trend
                    avg_demand = df['demand'].mean()
                    std_demand = df['demand'].std()
                    
                    # Calculate simple trend
                    if len(df) >= 7:
                        recent_avg = df['demand'].tail(3).mean()
                        older_avg = df['demand'].head(3).mean()
                        trend = (recent_avg - older_avg) / max(older_avg, 1)
                    else:
                        trend = 0
                    
                    # Generate 7 days of predictions
                    predictions_inserted = 0
                    base_date = datetime.now().date()
                    
                    for i in range(1, 8):  # Next 7 days
                        pred_date = base_date + timedelta(days=i)
                        
                        # Apply trend
                        trend_factor = 1 + (trend * i / 7)
                        predicted_demand = max(0, avg_demand * trend_factor)
                        
                        # Confidence intervals
                        confidence_lower = max(0, predicted_demand - 1.96 * std_demand)
                        confidence_upper = predicted_demand + 1.96 * std_demand
                        
                        # Factors for frontend display
                        factors = {
                            'avg_demand': round(avg_demand, 2),
                            'trend_factor': round(trend_factor, 3),
                            'std_deviation': round(std_demand, 2)
                        }
                        
                        # Insert prediction
                        try:
                            cursor.execute("""
                                INSERT INTO demand_predictions 
                                (product_id, store_id, model_id, prediction_date, predicted_demand,
                                 confidence_interval_lower, confidence_interval_upper, factors)
                                VALUES (%s, %s, 1, %s, %s, %s, %s, %s)
                                ON DUPLICATE KEY UPDATE
                                predicted_demand = VALUES(predicted_demand),
                                confidence_interval_lower = VALUES(confidence_interval_lower),
                                confidence_interval_upper = VALUES(confidence_interval_upper),
                                factors = VALUES(factors)
                            """, (
                                product_id, store_id, pred_date,
                                round(predicted_demand, 2),
                                round(confidence_lower, 2),
                                round(confidence_upper, 2),
                                json.dumps(factors)
                            ))
                            predictions_inserted += 1
                        except Exception as e:
                            print(f"  ⚠️ Error inserting prediction: {e}")
                    
                    connection.commit()
                    total_predictions += predictions_inserted
                    print(f"  ✅ Generated {predictions_inserted} predictions")
                    
                else:
                    print(f"  ⚠️ Insufficient historical data ({len(historical_data)} days)")
            
            print(f"\n🎉 Forecasting complete!")
            print(f"📊 Total predictions generated: {total_predictions}")
            
            # Show sample results
            print("\n4️⃣ Sample results:")
            cursor.execute("""
                SELECT p.name, s.name as store_name, dp.prediction_date, dp.predicted_demand
                FROM demand_predictions dp
                JOIN products p ON dp.product_id = p.id
                JOIN stores s ON dp.store_id = s.id
                WHERE dp.prediction_date >= CURDATE()
                ORDER BY dp.prediction_date
                LIMIT 5
            """)
            
            sample_results = cursor.fetchall()
            for result in sample_results:
                product_name, store_name, pred_date, demand = result
                print(f"  📈 {product_name} ({store_name}): {demand:.1f} units on {pred_date}")
            
            print(f"\n✅ SUCCESS! Check your forecasting dashboard at /forecasting")
            print(f"🌐 Your predictions are now live in the InvenCare application!")

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    finally:
        if 'connection' in locals() and connection.open:
            connection.close()
            print("🔒 Database connection closed")
    
    return True

if __name__ == "__main__":
    success = main()
    print(f"\nExecution result: {'✅ Success' if success else '❌ Failed'}")
