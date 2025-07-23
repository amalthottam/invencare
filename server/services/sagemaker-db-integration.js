import pool from '../db/database.js';
import AWS from 'aws-sdk';

// Configure AWS SageMaker
const sagemaker = new AWS.SageMakerRuntime({
  region: process.env.AWS_REGION || 'us-east-1'
});

export class SageMakerDBService {
  constructor() {
    this.endpoints = {
      lstm: process.env.LSTM_ENDPOINT_NAME || 'lstm-demand-forecasting',
      arima: process.env.ARIMA_ENDPOINT_NAME || 'arima-seasonal-forecasting', 
      prophet: process.env.PROPHET_ENDPOINT_NAME || 'prophet-forecasting',
      classification: process.env.CLASSIFICATION_ENDPOINT_NAME || 'product-abc-classification'
    };
  }

  // Fetch training data from database
  async getTrainingData(productId, storeId, days = 90) {
    try {
      const connection = await pool.getConnection();
      
      const query = `
        SELECT 
          DATE(created_at) as date,
          SUM(CASE WHEN transaction_type = 'Sale' THEN quantity ELSE 0 END) as sales_quantity,
          SUM(CASE WHEN transaction_type = 'Sale' THEN total_amount ELSE 0 END) as sales_amount,
          AVG(unit_price) as avg_price,
          COUNT(*) as transaction_count
        FROM inventory_transactions 
        WHERE product_id = ? 
          AND store_id = ?
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `;
      
      const [rows] = await connection.execute(query, [productId, storeId, days]);
      connection.release();
      
      return rows;
    } catch (error) {
      console.error('Error fetching training data:', error);
      throw error;
    }
  }

  // Get product features for classification
  async getProductFeatures(productId, storeId) {
    try {
      const connection = await pool.getConnection();
      
      const query = `
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
        WHERE p.id = ? AND p.store_id = ?
        GROUP BY p.id, p.name, p.category, p.unit_price, p.current_stock
      `;
      
      const [rows] = await connection.execute(query, [productId, storeId]);
      connection.release();
      
      if (rows.length === 0) {
        throw new Error(`Product ${productId} not found in store ${storeId}`);
      }
      
      const product = rows[0];
      
      // Calculate derived features
      return {
        quantity_sum: product.total_sales_quantity,
        quantity_mean: product.avg_sales_quantity,
        quantity_std: product.demand_volatility,
        quantity_count: product.total_transactions,
        total_amount_sum: product.total_sales_amount,
        total_amount_mean: product.total_sales_amount / Math.max(product.total_transactions, 1),
        unit_price_mean: product.avg_unit_price,
        unit_price_std: product.price_volatility,
        revenue_per_transaction: product.total_sales_amount / Math.max(product.total_transactions, 1),
        price_volatility: product.price_volatility / Math.max(product.avg_unit_price, 1),
        demand_volatility: product.demand_volatility / Math.max(product.avg_sales_quantity, 1),
        total_transactions: product.total_transactions
      };
    } catch (error) {
      console.error('Error fetching product features:', error);
      throw error;
    }
  }

  // Make prediction using SageMaker endpoint
  async predict(modelType, inputData) {
    try {
      const endpointName = this.endpoints[modelType];
      if (!endpointName) {
        throw new Error(`No endpoint configured for model type: ${modelType}`);
      }

      const params = {
        EndpointName: endpointName,
        ContentType: 'application/json',
        Body: JSON.stringify(inputData)
      };

      const response = await sagemaker.invokeEndpoint(params).promise();
      const prediction = JSON.parse(response.Body.toString());
      
      return {
        model_type: modelType,
        endpoint_name: endpointName,
        prediction: prediction,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error making ${modelType} prediction:`, error);
      throw error;
    }
  }

  // Demand forecasting for a product
  async forecastDemand(productId, storeId, forecastDays = 30, modelType = 'lstm') {
    try {
      // Get historical data
      const historicalData = await this.getTrainingData(productId, storeId, 90);
      
      if (historicalData.length < 30) {
        throw new Error('Insufficient historical data for forecasting (minimum 30 days required)');
      }

      // Prepare input for forecasting model
      const salesData = historicalData.map(row => row.sales_quantity);
      
      const inputData = {
        historical_data: salesData,
        forecast_days: forecastDays,
        product_id: productId,
        store_id: storeId
      };

      // Make prediction
      const result = await this.predict(modelType, inputData);
      
      // Store prediction in database
      await this.storeForecastPrediction({
        product_id: productId,
        store_id: storeId,
        model_type: modelType,
        forecast_days: forecastDays,
        prediction: result.prediction,
        created_at: new Date()
      });

      return result;
    } catch (error) {
      console.error('Error in demand forecasting:', error);
      throw error;
    }
  }

  // ABC classification for a product
  async classifyProduct(productId, storeId) {
    try {
      // Get product features
      const features = await this.getProductFeatures(productId, storeId);
      
      const inputData = { features: features };
      
      // Make prediction
      const result = await this.predict('classification', inputData);
      
      // Store classification in database
      await this.storeClassificationPrediction({
        product_id: productId,
        store_id: storeId,
        abc_class: result.prediction.abc_classification,
        confidence: result.prediction.confidence,
        features: features,
        created_at: new Date()
      });

      return result;
    } catch (error) {
      console.error('Error in product classification:', error);
      throw error;
    }
  }

  // Store forecast predictions in database
  async storeForecastPrediction(predictionData) {
    try {
      const connection = await pool.getConnection();
      
      // Create predictions table if it doesn't exist
      await connection.execute(`
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
      `);

      const query = `
        INSERT INTO demand_predictions 
        (product_id, store_id, model_type, forecast_days, predictions, confidence_lower, confidence_upper, model_accuracy, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        predictionData.product_id,
        predictionData.store_id,
        predictionData.model_type,
        predictionData.forecast_days,
        JSON.stringify(predictionData.prediction.predictions || []),
        JSON.stringify(predictionData.prediction.confidence_lower || []),
        JSON.stringify(predictionData.prediction.confidence_upper || []),
        predictionData.prediction.model_accuracy || null,
        predictionData.created_at
      ];
      
      await connection.execute(query, values);
      connection.release();
      
      console.log(`✅ Stored forecast prediction for ${predictionData.product_id}`);
    } catch (error) {
      console.error('Error storing forecast prediction:', error);
      throw error;
    }
  }

  // Store classification predictions in database
  async storeClassificationPrediction(classificationData) {
    try {
      const connection = await pool.getConnection();
      
      // Create classifications table if it doesn't exist
      await connection.execute(`
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
      `);

      const query = `
        INSERT INTO product_classifications 
        (product_id, store_id, abc_class, confidence, class_probabilities, features_used, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        classificationData.product_id,
        classificationData.store_id,
        classificationData.abc_class,
        classificationData.confidence,
        JSON.stringify(classificationData.class_probabilities || {}),
        JSON.stringify(classificationData.features),
        classificationData.created_at
      ];
      
      await connection.execute(query, values);
      connection.release();
      
      console.log(`✅ Stored classification for ${classificationData.product_id}: ${classificationData.abc_class}`);
    } catch (error) {
      console.error('Error storing classification:', error);
      throw error;
    }
  }

  // Get latest predictions from database
  async getLatestPredictions(productId, storeId) {
    try {
      const connection = await pool.getConnection();
      
      // Get latest forecast
      const [forecastRows] = await connection.execute(`
        SELECT * FROM demand_predictions 
        WHERE product_id = ? AND store_id = ?
        ORDER BY created_at DESC 
        LIMIT 1
      `, [productId, storeId]);

      // Get latest classification
      const [classificationRows] = await connection.execute(`
        SELECT * FROM product_classifications 
        WHERE product_id = ? AND store_id = ?
        ORDER BY created_at DESC 
        LIMIT 1
      `, [productId, storeId]);

      connection.release();
      
      return {
        forecast: forecastRows[0] || null,
        classification: classificationRows[0] || null
      };
    } catch (error) {
      console.error('Error fetching latest predictions:', error);
      throw error;
    }
  }

  // Batch prediction for all products in a store
  async batchPredictStore(storeId, modelType = 'lstm') {
    try {
      const connection = await pool.getConnection();
      
      // Get all products in the store
      const [products] = await connection.execute(`
        SELECT DISTINCT product_id FROM inventory_transactions 
        WHERE store_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        GROUP BY product_id 
        HAVING COUNT(*) >= 10
      `, [storeId]);
      
      connection.release();
      
      const results = [];
      
      for (const product of products) {
        try {
          // Forecast demand
          const forecast = await this.forecastDemand(product.product_id, storeId, 30, modelType);
          
          // Classify product
          const classification = await this.classifyProduct(product.product_id, storeId);
          
          results.push({
            product_id: product.product_id,
            store_id: storeId,
            forecast: forecast,
            classification: classification,
            status: 'success'
          });
          
        } catch (error) {
          console.error(`Failed prediction for ${product.product_id}:`, error.message);
          results.push({
            product_id: product.product_id,
            store_id: storeId,
            error: error.message,
            status: 'failed'
          });
        }
        
        // Add small delay to avoid overwhelming the endpoints
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return {
        store_id: storeId,
        total_products: products.length,
        successful_predictions: results.filter(r => r.status === 'success').length,
        failed_predictions: results.filter(r => r.status === 'failed').length,
        results: results
      };
    } catch (error) {
      console.error('Error in batch prediction:', error);
      throw error;
    }
  }
}

export default new SageMakerDBService();
