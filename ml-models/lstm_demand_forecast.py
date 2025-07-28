"""
LSTM Demand Forecasting Model for Amazon SageMaker
This model predicts product demand using Long Short-Term Memory neural networks
"""

import numpy as np
import pandas as pd
import json
import pickle
import boto3
from datetime import datetime, timedelta
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LSTMDemandForecaster:
    def __init__(self, sequence_length=30, forecast_horizon=14):
        """
        Initialize LSTM Demand Forecaster
        
        Args:
            sequence_length (int): Number of past days to use for prediction
            forecast_horizon (int): Number of days to forecast ahead
        """
        self.sequence_length = sequence_length
        self.forecast_horizon = forecast_horizon
        self.model = None
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self.feature_scaler = StandardScaler()
        self.is_trained = False
        
    def prepare_features(self, df):
        """
        Prepare additional features for better forecasting
        
        Args:
            df (pd.DataFrame): Input dataframe with sales data
            
        Returns:
            pd.DataFrame: Enhanced dataframe with features
        """
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')
        
        # Time-based features
        df['day_of_week'] = df['date'].dt.dayofweek
        df['month'] = df['date'].dt.month
        df['day_of_month'] = df['date'].dt.day
        df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
        
        # Cyclical encoding for better temporal representation
        df['day_of_week_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['day_of_week_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
        df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
        df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
        
        # Lag features
        df['sales_lag_1'] = df['units_sold'].shift(1)
        df['sales_lag_7'] = df['units_sold'].shift(7)
        df['sales_lag_30'] = df['units_sold'].shift(30)
        
        # Rolling statistics
        df['sales_ma_7'] = df['units_sold'].rolling(window=7).mean()
        df['sales_ma_30'] = df['units_sold'].rolling(window=30).mean()
        df['sales_std_7'] = df['units_sold'].rolling(window=7).std()
        
        # Price features if available
        if 'average_price' in df.columns:
            df['price_change'] = df['average_price'].pct_change()
            df['price_ma_7'] = df['average_price'].rolling(window=7).mean()
        
        return df
    
    def create_sequences(self, data, target_col='units_sold'):
        """
        Create sequences for LSTM training
        
        Args:
            data (pd.DataFrame): Prepared data with features
            target_col (str): Target column name
            
        Returns:
            tuple: (X, y) sequences for training
        """
        # Select features for the model
        feature_cols = [
            'units_sold', 'day_of_week_sin', 'day_of_week_cos',
            'month_sin', 'month_cos', 'is_weekend',
            'sales_lag_1', 'sales_lag_7', 'sales_ma_7', 'sales_std_7'
        ]
        
        # Add price features if available
        if 'price_change' in data.columns:
            feature_cols.extend(['price_change', 'price_ma_7'])
            
        # Filter available columns
        available_cols = [col for col in feature_cols if col in data.columns]
        
        # Handle missing values
        data_clean = data[available_cols].fillna(method='bfill').fillna(method='ffill')
        
        # Scale features
        scaled_features = self.feature_scaler.fit_transform(data_clean)
        
        # Scale target separately
        target_data = data[target_col].values.reshape(-1, 1)
        scaled_target = self.scaler.fit_transform(target_data)
        
        X, y = [], []
        
        for i in range(self.sequence_length, len(scaled_features)):
            # Features sequence
            X.append(scaled_features[i-self.sequence_length:i])
            # Target value
            y.append(scaled_target[i, 0])
            
        return np.array(X), np.array(y)
    
    def build_model(self, input_shape):
        """
        Build LSTM model architecture
        
        Args:
            input_shape (tuple): Shape of input sequences
            
        Returns:
            tf.keras.Model: Compiled LSTM model
        """
        model = Sequential([
            LSTM(100, return_sequences=True, input_shape=input_shape),
            Dropout(0.2),
            LSTM(100, return_sequences=True),
            Dropout(0.2),
            LSTM(50, return_sequences=False),
            Dropout(0.2),
            Dense(25),
            Dense(1)
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )
        
        return model
    
    def train(self, df, validation_split=0.2, epochs=100, batch_size=32):
        """
        Train the LSTM model
        
        Args:
            df (pd.DataFrame): Training data
            validation_split (float): Fraction of data for validation
            epochs (int): Number of training epochs
            batch_size (int): Batch size for training
            
        Returns:
            dict: Training history
        """
        logger.info("Preparing data for training...")
        
        # Prepare features
        df_prepared = self.prepare_features(df)
        
        # Create sequences
        X, y = self.create_sequences(df_prepared)
        
        if len(X) == 0:
            raise ValueError("Not enough data to create sequences")
        
        logger.info(f"Created {len(X)} sequences with shape {X.shape}")
        
        # Build model
        self.model = self.build_model((X.shape[1], X.shape[2]))
        
        logger.info("Model architecture:")
        self.model.summary()
        
        # Train model
        logger.info("Starting training...")
        
        # Early stopping callback
        early_stopping = tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=15,
            restore_best_weights=True
        )
        
        # Learning rate reduction callback
        lr_scheduler = tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=10,
            min_lr=0.0001
        )
        
        history = self.model.fit(
            X, y,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=validation_split,
            callbacks=[early_stopping, lr_scheduler],
            verbose=1
        )
        
        self.is_trained = True
        logger.info("Training completed successfully")
        
        return history.history
    
    def predict(self, df, steps_ahead=None):
        """
        Generate predictions
        
        Args:
            df (pd.DataFrame): Input data for prediction
            steps_ahead (int): Number of steps to forecast ahead
            
        Returns:
            dict: Predictions with confidence intervals
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")
        
        if steps_ahead is None:
            steps_ahead = self.forecast_horizon
            
        # Prepare features
        df_prepared = self.prepare_features(df)
        
        # Get the last sequence for prediction
        feature_cols = [
            'units_sold', 'day_of_week_sin', 'day_of_week_cos',
            'month_sin', 'month_cos', 'is_weekend',
            'sales_lag_1', 'sales_lag_7', 'sales_ma_7', 'sales_std_7'
        ]
        
        # Add price features if available
        if 'price_change' in df_prepared.columns:
            feature_cols.extend(['price_change', 'price_ma_7'])
            
        available_cols = [col for col in feature_cols if col in df_prepared.columns]
        data_clean = df_prepared[available_cols].fillna(method='bfill').fillna(method='ffill')
        
        # Scale features
        scaled_features = self.feature_scaler.transform(data_clean)
        
        # Prepare input sequence
        if len(scaled_features) < self.sequence_length:
            raise ValueError(f"Need at least {self.sequence_length} data points for prediction")
            
        last_sequence = scaled_features[-self.sequence_length:].reshape(1, self.sequence_length, -1)
        
        # Generate predictions
        predictions = []
        current_sequence = last_sequence.copy()
        
        for _ in range(steps_ahead):
            # Predict next value
            pred = self.model.predict(current_sequence, verbose=0)
            predictions.append(pred[0, 0])
            
            # Update sequence for next prediction (simplified approach)
            # In practice, you'd want to update all features properly
            new_features = current_sequence[0, -1].copy()
            new_features[0] = pred[0, 0]  # Update sales prediction
            
            # Shift sequence and add new prediction
            current_sequence = np.roll(current_sequence, -1, axis=1)
            current_sequence[0, -1] = new_features
        
        # Inverse transform predictions
        predictions = np.array(predictions).reshape(-1, 1)
        predictions_scaled = self.scaler.inverse_transform(predictions)
        
        # Generate forecast dates
        last_date = pd.to_datetime(df['date']).max()
        forecast_dates = [last_date + timedelta(days=i+1) for i in range(steps_ahead)]
        
        # Calculate confidence intervals (simplified approach using training residuals)
        # In practice, you'd use more sophisticated methods like Monte Carlo dropout
        confidence_level = 0.95
        residual_std = np.std(predictions_scaled) * 1.96  # Approximation
        
        lower_bound = predictions_scaled.flatten() - residual_std
        upper_bound = predictions_scaled.flatten() + residual_std
        
        return {
            'dates': [date.strftime('%Y-%m-%d') for date in forecast_dates],
            'predictions': predictions_scaled.flatten().tolist(),
            'confidence_lower': lower_bound.tolist(),
            'confidence_upper': upper_bound.tolist(),
            'confidence_level': confidence_level
        }
    
    def evaluate(self, df):
        """
        Evaluate model performance on test data
        
        Args:
            df (pd.DataFrame): Test data
            
        Returns:
            dict: Evaluation metrics
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before evaluation")
        
        # Prepare test data
        df_prepared = self.prepare_features(df)
        X_test, y_test = self.create_sequences(df_prepared)
        
        if len(X_test) == 0:
            raise ValueError("Not enough test data")
        
        # Make predictions
        y_pred = self.model.predict(X_test)
        
        # Inverse transform for metrics calculation
        y_test_scaled = y_test.reshape(-1, 1)
        y_pred_scaled = y_pred.reshape(-1, 1)
        
        y_test_original = self.scaler.inverse_transform(y_test_scaled)
        y_pred_original = self.scaler.inverse_transform(y_pred_scaled)
        
        # Calculate metrics
        mae = mean_absolute_error(y_test_original, y_pred_original)
        rmse = np.sqrt(mean_squared_error(y_test_original, y_pred_original))
        mape = np.mean(np.abs((y_test_original - y_pred_original) / y_test_original)) * 100
        
        return {
            'mae': float(mae),
            'rmse': float(rmse),
            'mape': float(mape),
            'samples': len(y_test)
        }
    
    def save_model(self, model_dir):
        """
        Save model and scalers for deployment
        
        Args:
            model_dir (str): Directory to save model artifacts
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before saving")
        
        os.makedirs(model_dir, exist_ok=True)
        
        # Save Keras model
        self.model.save(os.path.join(model_dir, 'lstm_model.h5'))
        
        # Save scalers
        with open(os.path.join(model_dir, 'target_scaler.pkl'), 'wb') as f:
            pickle.dump(self.scaler, f)
            
        with open(os.path.join(model_dir, 'feature_scaler.pkl'), 'wb') as f:
            pickle.dump(self.feature_scaler, f)
        
        # Save model configuration
        config = {
            'sequence_length': self.sequence_length,
            'forecast_horizon': self.forecast_horizon,
            'model_version': '1.0',
            'created_at': datetime.now().isoformat()
        }
        
        with open(os.path.join(model_dir, 'model_config.json'), 'w') as f:
            json.dump(config, f, indent=2)
        
        logger.info(f"Model saved to {model_dir}")
    
    def load_model(self, model_dir):
        """
        Load trained model and scalers
        
        Args:
            model_dir (str): Directory containing model artifacts
        """
        # Load Keras model
        self.model = tf.keras.models.load_model(os.path.join(model_dir, 'lstm_model.h5'))
        
        # Load scalers
        with open(os.path.join(model_dir, 'target_scaler.pkl'), 'rb') as f:
            self.scaler = pickle.load(f)
            
        with open(os.path.join(model_dir, 'feature_scaler.pkl'), 'rb') as f:
            self.feature_scaler = pickle.load(f)
        
        # Load configuration
        with open(os.path.join(model_dir, 'model_config.json'), 'r') as f:
            config = json.load(f)
            self.sequence_length = config['sequence_length']
            self.forecast_horizon = config['forecast_horizon']
        
        self.is_trained = True
        logger.info(f"Model loaded from {model_dir}")

# SageMaker inference functions
def model_fn(model_dir):
    """
    Load model for SageMaker inference
    """
    forecaster = LSTMDemandForecaster()
    forecaster.load_model(model_dir)
    return forecaster

def input_fn(request_body, content_type='application/json'):
    """
    Parse input data for SageMaker inference
    """
    if content_type == 'application/json':
        input_data = json.loads(request_body)
        df = pd.DataFrame(input_data['data'])
        return {
            'df': df,
            'steps_ahead': input_data.get('steps_ahead', 14)
        }
    else:
        raise ValueError(f"Unsupported content type: {content_type}")

def predict_fn(input_data, model):
    """
    Generate predictions for SageMaker inference
    """
    try:
        predictions = model.predict(
            input_data['df'], 
            steps_ahead=input_data['steps_ahead']
        )
        return predictions
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return {'error': str(e)}

def output_fn(prediction, accept='application/json'):
    """
    Format output for SageMaker inference
    """
    if accept == 'application/json':
        return json.dumps(prediction), accept
    else:
        raise ValueError(f"Unsupported accept type: {accept}")

# Training script for SageMaker
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-dir', type=str, default=os.environ.get('SM_MODEL_DIR'))
    parser.add_argument('--train', type=str, default=os.environ.get('SM_CHANNEL_TRAIN'))
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--sequence-length', type=int, default=30)
    parser.add_argument('--forecast-horizon', type=int, default=14)
    
    args = parser.parse_args()
    
    # Load training data
    train_file = os.path.join(args.train, 'train.csv')
    df = pd.read_csv(train_file)
    
    # Initialize and train model
    forecaster = LSTMDemandForecaster(
        sequence_length=args.sequence_length,
        forecast_horizon=args.forecast_horizon
    )
    
    # Train model
    history = forecaster.train(
        df,
        epochs=args.epochs,
        batch_size=args.batch_size
    )
    
    # Save model
    forecaster.save_model(args.model_dir)
    
    # Save training history
    with open(os.path.join(args.model_dir, 'training_history.json'), 'w') as f:
        json.dump(history, f, indent=2)
    
    logger.info("Training completed and model saved successfully")
