#!/usr/bin/env python3
"""
LSTM Demand Forecasting Model for AWS SageMaker
===============================================

This script implements an LSTM neural network for demand forecasting
optimized for deployment on AWS SageMaker.

Features:
- Multi-step ahead forecasting
- Seasonal decomposition
- Feature engineering with external factors
- Robust preprocessing pipeline
- Model versioning and checkpointing
- Confidence intervals estimation
"""

import os
import json
import pickle
import logging
import argparse
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Tuple, Dict, List, Optional

import boto3
import joblib
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error
import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from tensorflow.keras.regularizers import l1_l2

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LSTMDemandForecaster:
    """
    Advanced LSTM model for demand forecasting with feature engineering
    and confidence interval estimation.
    """
    
    def __init__(self, 
                 sequence_length: int = 30,
                 forecast_horizon: int = 7,
                 lstm_units: List[int] = [128, 64, 32],
                 dropout_rate: float = 0.2,
                 learning_rate: float = 0.001,
                 batch_size: int = 32,
                 epochs: int = 100,
                 validation_split: float = 0.2):
        """
        Initialize LSTM Demand Forecaster
        
        Args:
            sequence_length: Number of historical periods to use for prediction
            forecast_horizon: Number of periods to forecast ahead
            lstm_units: List of units for each LSTM layer
            dropout_rate: Dropout rate for regularization
            learning_rate: Learning rate for Adam optimizer
            batch_size: Training batch size
            epochs: Maximum training epochs
            validation_split: Fraction of data for validation
        """
        self.sequence_length = sequence_length
        self.forecast_horizon = forecast_horizon
        self.lstm_units = lstm_units
        self.dropout_rate = dropout_rate
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.epochs = epochs
        self.validation_split = validation_split
        
        # Model components
        self.model = None
        self.scaler_target = StandardScaler()
        self.scaler_features = StandardScaler()
        self.label_encoders = {}
        self.feature_names = []
        self.is_trained = False
        
        # Model metadata
        self.training_history = {}
        self.model_metrics = {}
        self.feature_importance = {}
        
    def create_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create comprehensive feature set for demand forecasting
        
        Args:
            df: DataFrame with columns ['date', 'demand', 'product_id', 'store_id']
            
        Returns:
            DataFrame with engineered features
        """
        logger.info("Creating features...")
        
        # Ensure date is datetime
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values(['product_id', 'store_id', 'date'])
        
        # Time-based features
        df['year'] = df['date'].dt.year
        df['month'] = df['date'].dt.month
        df['day'] = df['date'].dt.day
        df['dayofweek'] = df['date'].dt.dayofweek
        df['quarter'] = df['date'].dt.quarter
        df['week'] = df['date'].dt.isocalendar().week
        df['is_weekend'] = (df['dayofweek'] >= 5).astype(int)
        df['is_month_start'] = df['date'].dt.is_month_start.astype(int)
        df['is_month_end'] = df['date'].dt.is_month_end.astype(int)
        
        # Seasonal features
        df['sin_month'] = np.sin(2 * np.pi * df['month'] / 12)
        df['cos_month'] = np.cos(2 * np.pi * df['month'] / 12)
        df['sin_week'] = np.sin(2 * np.pi * df['week'] / 52)
        df['cos_week'] = np.cos(2 * np.pi * df['week'] / 52)
        df['sin_day'] = np.sin(2 * np.pi * df['dayofweek'] / 7)
        df['cos_day'] = np.cos(2 * np.pi * df['dayofweek'] / 7)
        
        # Lag features
        groupby_cols = ['product_id', 'store_id']
        for lag in [1, 2, 3, 7, 14, 30]:
            df[f'demand_lag_{lag}'] = df.groupby(groupby_cols)['demand'].shift(lag)
        
        # Rolling statistics
        for window in [3, 7, 14, 30]:
            df[f'demand_rolling_mean_{window}'] = df.groupby(groupby_cols)['demand'].transform(
                lambda x: x.rolling(window=window, min_periods=1).mean()
            )
            df[f'demand_rolling_std_{window}'] = df.groupby(groupby_cols)['demand'].transform(
                lambda x: x.rolling(window=window, min_periods=1).std()
            )
            df[f'demand_rolling_median_{window}'] = df.groupby(groupby_cols)['demand'].transform(
                lambda x: x.rolling(window=window, min_periods=1).median()
            )
        
        # Exponential moving averages
        for alpha in [0.1, 0.3, 0.5]:
            df[f'demand_ema_{alpha}'] = df.groupby(groupby_cols)['demand'].transform(
                lambda x: x.ewm(alpha=alpha).mean()
            )
        
        # Price features (if available)
        if 'price' in df.columns:
            df['price_lag_1'] = df.groupby(groupby_cols)['price'].shift(1)
            df['price_change'] = df['price'] - df['price_lag_1']
            df['price_change_pct'] = df['price_change'] / df['price_lag_1']
            df['price_rolling_mean_7'] = df.groupby(groupby_cols)['price'].transform(
                lambda x: x.rolling(window=7, min_periods=1).mean()
            )
        
        # Inventory features (if available)
        if 'stock_level' in df.columns:
            df['stock_lag_1'] = df.groupby(groupby_cols)['stock_level'].shift(1)
            df['stockout_risk'] = (df['stock_level'] < df['demand_rolling_mean_7']).astype(int)
        
        # Remove rows with too many NaN values (from lags)
        df = df.dropna()
        
        logger.info(f"Created {len(df.columns)} features")
        return df
    
    def prepare_data(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare data for LSTM training/prediction
        
        Args:
            df: DataFrame with features and target
            
        Returns:
            Tuple of (X, y) arrays ready for LSTM
        """
        logger.info("Preparing data for LSTM...")
        
        # Separate target and features
        target_col = 'demand'
        feature_cols = [col for col in df.columns if col not in [
            'date', 'product_id', 'store_id', target_col
        ]]
        
        # Encode categorical features
        categorical_cols = df[feature_cols].select_dtypes(include=['object']).columns
        for col in categorical_cols:
            if col not in self.label_encoders:
                self.label_encoders[col] = LabelEncoder()
                df[col] = self.label_encoders[col].fit_transform(df[col])
            else:
                df[col] = self.label_encoders[col].transform(df[col])
        
        # Store feature names
        self.feature_names = feature_cols
        
        # Group by product-store combinations
        X_list, y_list = [], []
        
        for (product_id, store_id), group in df.groupby(['product_id', 'store_id']):
            if len(group) < self.sequence_length + self.forecast_horizon:
                continue
                
            # Sort by date
            group = group.sort_values('date')
            
            # Extract features and target
            features = group[feature_cols].values
            target = group[target_col].values
            
            # Create sequences
            for i in range(len(group) - self.sequence_length - self.forecast_horizon + 1):
                X_seq = features[i:i + self.sequence_length]
                y_seq = target[i + self.sequence_length:i + self.sequence_length + self.forecast_horizon]
                
                X_list.append(X_seq)
                y_list.append(y_seq)
        
        X = np.array(X_list)
        y = np.array(y_list)
        
        logger.info(f"Prepared {X.shape[0]} sequences with shape {X.shape}")
        return X, y
    
    def build_model(self, input_shape: Tuple[int, int]) -> Sequential:
        """
        Build LSTM model architecture
        
        Args:
            input_shape: Shape of input sequences (sequence_length, n_features)
            
        Returns:
            Compiled Keras model
        """
        logger.info("Building LSTM model...")
        
        model = Sequential()
        
        # First LSTM layer
        model.add(LSTM(
            units=self.lstm_units[0],
            return_sequences=len(self.lstm_units) > 1,
            input_shape=input_shape,
            kernel_regularizer=l1_l2(l1=1e-5, l2=1e-4)
        ))
        model.add(BatchNormalization())
        model.add(Dropout(self.dropout_rate))
        
        # Additional LSTM layers
        for i, units in enumerate(self.lstm_units[1:]):
            return_sequences = i < len(self.lstm_units) - 2
            model.add(LSTM(
                units=units,
                return_sequences=return_sequences,
                kernel_regularizer=l1_l2(l1=1e-5, l2=1e-4)
            ))
            model.add(BatchNormalization())
            model.add(Dropout(self.dropout_rate))
        
        # Output layer
        model.add(Dense(self.forecast_horizon, activation='relu'))
        
        # Compile model
        optimizer = Adam(learning_rate=self.learning_rate)
        model.compile(
            optimizer=optimizer,
            loss='mse',
            metrics=['mae', 'mape']
        )
        
        logger.info(f"Model built with {model.count_params()} parameters")
        return model
    
    def fit(self, df: pd.DataFrame, model_dir: str = '/opt/ml/model') -> Dict:
        """
        Train the LSTM model
        
        Args:
            df: Training data
            model_dir: Directory to save model artifacts
            
        Returns:
            Training metrics dictionary
        """
        logger.info("Starting LSTM training...")
        
        # Create features
        df_features = self.create_features(df)
        
        # Prepare data
        X, y = self.prepare_data(df_features)
        
        # Scale features and target
        X_scaled = self.scaler_features.fit_transform(X.reshape(-1, X.shape[-1]))
        X_scaled = X_scaled.reshape(X.shape)
        
        y_scaled = self.scaler_target.fit_transform(y.reshape(-1, 1))
        y_scaled = y_scaled.reshape(y.shape)
        
        # Build model
        self.model = self.build_model((X.shape[1], X.shape[2]))
        
        # Callbacks
        callbacks = [
            EarlyStopping(
                monitor='val_loss',
                patience=10,
                restore_best_weights=True
            ),
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=5,
                min_lr=1e-6
            ),
            ModelCheckpoint(
                filepath=os.path.join(model_dir, 'best_model.h5'),
                monitor='val_loss',
                save_best_only=True
            )
        ]
        
        # Train model
        history = self.model.fit(
            X_scaled, y_scaled,
            batch_size=self.batch_size,
            epochs=self.epochs,
            validation_split=self.validation_split,
            callbacks=callbacks,
            verbose=1
        )
        
        self.training_history = history.history
        self.is_trained = True
        
        # Calculate metrics
        train_pred = self.model.predict(X_scaled)
        train_pred_unscaled = self.scaler_target.inverse_transform(train_pred.reshape(-1, 1))
        y_unscaled = self.scaler_target.inverse_transform(y_scaled.reshape(-1, 1))
        
        self.model_metrics = {
            'mae': float(mean_absolute_error(y_unscaled, train_pred_unscaled)),
            'rmse': float(np.sqrt(mean_squared_error(y_unscaled, train_pred_unscaled))),
            'mape': float(np.mean(np.abs((y_unscaled - train_pred_unscaled) / y_unscaled)) * 100),
            'training_samples': len(X),
            'validation_loss': float(min(history.history['val_loss'])),
            'training_epochs': len(history.history['loss'])
        }
        
        # Save model artifacts
        self.save_model(model_dir)
        
        logger.info(f"Training completed. MAE: {self.model_metrics['mae']:.2f}")
        return self.model_metrics
    
    def predict(self, df: pd.DataFrame, return_confidence: bool = True) -> Dict:
        """
        Generate predictions with confidence intervals
        
        Args:
            df: Input data for prediction
            return_confidence: Whether to calculate confidence intervals
            
        Returns:
            Dictionary with predictions and metadata
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")
        
        logger.info("Generating predictions...")
        
        # Create features
        df_features = self.create_features(df)
        
        # Prepare data
        X, _ = self.prepare_data(df_features)
        
        # Scale features
        X_scaled = self.scaler_features.transform(X.reshape(-1, X.shape[-1]))
        X_scaled = X_scaled.reshape(X.shape)
        
        # Generate predictions
        predictions_scaled = self.model.predict(X_scaled)
        predictions = self.scaler_target.inverse_transform(predictions_scaled.reshape(-1, 1))
        predictions = predictions.reshape(predictions_scaled.shape)
        
        results = {
            'predictions': predictions.tolist(),
            'forecast_horizon': self.forecast_horizon,
            'model_type': 'lstm',
            'model_version': '2.1',
            'prediction_timestamp': datetime.utcnow().isoformat()
        }
        
        # Calculate confidence intervals using Monte Carlo dropout
        if return_confidence:
            confidence_intervals = self._calculate_confidence_intervals(X_scaled)
            results['confidence_intervals'] = confidence_intervals
        
        logger.info(f"Generated {len(predictions)} predictions")
        return results
    
    def _calculate_confidence_intervals(self, X: np.ndarray, n_samples: int = 100) -> List:
        """
        Calculate confidence intervals using Monte Carlo dropout
        
        Args:
            X: Input features
            n_samples: Number of Monte Carlo samples
            
        Returns:
            List of confidence intervals
        """
        logger.info("Calculating confidence intervals...")
        
        # Enable dropout during inference
        predictions_mc = []
        for _ in range(n_samples):
            pred = self.model(X, training=True)
            pred_unscaled = self.scaler_target.inverse_transform(pred.numpy().reshape(-1, 1))
            predictions_mc.append(pred_unscaled.reshape(pred.shape))
        
        predictions_mc = np.array(predictions_mc)
        
        # Calculate percentiles
        lower_bound = np.percentile(predictions_mc, 2.5, axis=0)
        upper_bound = np.percentile(predictions_mc, 97.5, axis=0)
        
        confidence_intervals = []
        for i in range(len(lower_bound)):
            confidence_intervals.append({
                'lower': lower_bound[i].tolist(),
                'upper': upper_bound[i].tolist()
            })
        
        return confidence_intervals
    
    def save_model(self, model_dir: str):
        """Save model and artifacts"""
        os.makedirs(model_dir, exist_ok=True)
        
        # Save Keras model
        self.model.save(os.path.join(model_dir, 'lstm_model.h5'))
        
        # Save scalers and encoders
        joblib.dump(self.scaler_target, os.path.join(model_dir, 'scaler_target.pkl'))
        joblib.dump(self.scaler_features, os.path.join(model_dir, 'scaler_features.pkl'))
        joblib.dump(self.label_encoders, os.path.join(model_dir, 'label_encoders.pkl'))
        
        # Save model metadata
        metadata = {
            'sequence_length': self.sequence_length,
            'forecast_horizon': self.forecast_horizon,
            'lstm_units': self.lstm_units,
            'feature_names': self.feature_names,
            'model_metrics': self.model_metrics,
            'training_history': self.training_history,
            'is_trained': self.is_trained
        }
        
        with open(os.path.join(model_dir, 'model_metadata.json'), 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Model saved to {model_dir}")
    
    def load_model(self, model_dir: str):
        """Load model and artifacts"""
        # Load Keras model
        self.model = load_model(os.path.join(model_dir, 'lstm_model.h5'))
        
        # Load scalers and encoders
        self.scaler_target = joblib.load(os.path.join(model_dir, 'scaler_target.pkl'))
        self.scaler_features = joblib.load(os.path.join(model_dir, 'scaler_features.pkl'))
        self.label_encoders = joblib.load(os.path.join(model_dir, 'label_encoders.pkl'))
        
        # Load metadata
        with open(os.path.join(model_dir, 'model_metadata.json'), 'r') as f:
            metadata = json.load(f)
        
        self.sequence_length = metadata['sequence_length']
        self.forecast_horizon = metadata['forecast_horizon']
        self.lstm_units = metadata['lstm_units']
        self.feature_names = metadata['feature_names']
        self.model_metrics = metadata['model_metrics']
        self.training_history = metadata['training_history']
        self.is_trained = metadata['is_trained']
        
        logger.info(f"Model loaded from {model_dir}")


def model_fn(model_dir):
    """Load model for SageMaker inference"""
    forecaster = LSTMDemandForecaster()
    forecaster.load_model(model_dir)
    return forecaster


def input_fn(request_body, request_content_type):
    """Parse input data for SageMaker inference"""
    if request_content_type == 'application/json':
        input_data = json.loads(request_body)
        return pd.DataFrame(input_data['data'])
    else:
        raise ValueError(f"Unsupported content type: {request_content_type}")


def predict_fn(input_data, model):
    """Generate predictions for SageMaker inference"""
    return model.predict(input_data)


def output_fn(prediction, content_type):
    """Format output for SageMaker inference"""
    if content_type == 'application/json':
        return json.dumps(prediction)
    else:
        raise ValueError(f"Unsupported content type: {content_type}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    
    # SageMaker arguments
    parser.add_argument('--model-dir', type=str, default=os.environ.get('SM_MODEL_DIR'))
    parser.add_argument('--train', type=str, default=os.environ.get('SM_CHANNEL_TRAINING'))
    parser.add_argument('--hosts', type=list, default=json.loads(os.environ.get('SM_HOSTS')))
    parser.add_argument('--current-host', type=str, default=os.environ.get('SM_CURRENT_HOST'))
    
    # Model hyperparameters
    parser.add_argument('--sequence-length', type=int, default=30)
    parser.add_argument('--forecast-horizon', type=int, default=7)
    parser.add_argument('--lstm-units', type=str, default='128,64,32')
    parser.add_argument('--dropout-rate', type=float, default=0.2)
    parser.add_argument('--learning-rate', type=float, default=0.001)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--epochs', type=int, default=100)
    
    args = parser.parse_args()
    
    # Parse LSTM units
    lstm_units = [int(x) for x in args.lstm_units.split(',')]
    
    # Initialize model
    forecaster = LSTMDemandForecaster(
        sequence_length=args.sequence_length,
        forecast_horizon=args.forecast_horizon,
        lstm_units=lstm_units,
        dropout_rate=args.dropout_rate,
        learning_rate=args.learning_rate,
        batch_size=args.batch_size,
        epochs=args.epochs
    )
    
    # Load training data
    train_data = pd.read_csv(os.path.join(args.train, 'train.csv'))
    
    # Train model
    metrics = forecaster.fit(train_data, args.model_dir)
    
    logger.info("Training completed successfully!")
    logger.info(f"Final metrics: {metrics}")
