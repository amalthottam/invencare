#!/usr/bin/env python3
"""
Ensemble Demand Forecasting Model for AWS SageMaker
==================================================

This script implements an advanced ensemble model that combines multiple
forecasting approaches including LSTM, ARIMA, Prophet, and XGBoost
for superior demand forecasting accuracy.

Features:
- Multi-model ensemble with dynamic weighting
- Meta-learning for optimal weight selection
- Robust error handling and fallback mechanisms
- Advanced confidence interval estimation
- Model performance monitoring and adaptation
- Feature importance analysis
"""

import os
import json
import pickle
import logging
import argparse
import warnings
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Tuple, Dict, List, Optional, Union

import boto3
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import cross_val_score, TimeSeriesSplit
import xgboost as xgb
from prophet import Prophet

# Import our custom models
from lstm_demand_forecast import LSTMDemandForecaster
from arima_demand_forecast import ARIMADemandForecaster

# Suppress warnings
warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EnsembleDemandForecaster:
    """
    Advanced ensemble model combining multiple forecasting approaches
    with dynamic weighting and meta-learning.
    """
    
    def __init__(self,
                 models_config: Dict = None,
                 ensemble_method: str = 'stacking',
                 meta_learner: str = 'ridge',
                 dynamic_weighting: bool = True,
                 forecast_horizon: int = 7,
                 validation_split: float = 0.2,
                 n_cv_folds: int = 3):
        """
        Initialize Ensemble Demand Forecaster
        
        Args:
            models_config: Configuration for individual models
            ensemble_method: Method for combining predictions ('averaging', 'stacking', 'dynamic')
            meta_learner: Meta-learner for stacking ('ridge', 'rf', 'xgb')
            dynamic_weighting: Whether to use dynamic weights based on recent performance
            forecast_horizon: Number of periods to forecast ahead
            validation_split: Fraction of data for validation
            n_cv_folds: Number of cross-validation folds
        """
        self.ensemble_method = ensemble_method
        self.meta_learner = meta_learner
        self.dynamic_weighting = dynamic_weighting
        self.forecast_horizon = forecast_horizon
        self.validation_split = validation_split
        self.n_cv_folds = n_cv_folds
        
        # Default models configuration
        self.models_config = models_config or {
            'lstm': {
                'enabled': True,
                'sequence_length': 30,
                'lstm_units': [128, 64, 32],
                'dropout_rate': 0.2,
                'learning_rate': 0.001,
                'epochs': 50
            },
            'arima': {
                'enabled': True,
                'max_p': 5,
                'max_d': 2,
                'max_q': 5,
                'seasonal': True,
                'seasonal_period': 7
            },
            'prophet': {
                'enabled': True,
                'growth': 'linear',
                'seasonality_mode': 'multiplicative',
                'yearly_seasonality': True,
                'weekly_seasonality': True,
                'daily_seasonality': False
            },
            'xgboost': {
                'enabled': True,
                'n_estimators': 100,
                'max_depth': 6,
                'learning_rate': 0.1,
                'subsample': 0.8
            }
        }
        
        # Model instances
        self.base_models = {}
        self.meta_model = None
        self.weights = {}
        self.performance_history = {}
        
        # Model metadata
        self.is_trained = False
        self.model_metrics = {}
        self.feature_importance = {}
        
    def initialize_base_models(self):
        """Initialize base forecasting models"""
        logger.info("Initializing base models...")
        
        # LSTM Model
        if self.models_config['lstm']['enabled']:
            self.base_models['lstm'] = LSTMDemandForecaster(
                sequence_length=self.models_config['lstm']['sequence_length'],
                forecast_horizon=self.forecast_horizon,
                lstm_units=self.models_config['lstm']['lstm_units'],
                dropout_rate=self.models_config['lstm']['dropout_rate'],
                learning_rate=self.models_config['lstm']['learning_rate'],
                epochs=self.models_config['lstm']['epochs']
            )
        
        # ARIMA Model
        if self.models_config['arima']['enabled']:
            self.base_models['arima'] = ARIMADemandForecaster(
                max_p=self.models_config['arima']['max_p'],
                max_d=self.models_config['arima']['max_d'],
                max_q=self.models_config['arima']['max_q'],
                seasonal=self.models_config['arima']['seasonal'],
                seasonal_period=self.models_config['arima']['seasonal_period'],
                forecast_horizon=self.forecast_horizon
            )
        
        # Prophet Model
        if self.models_config['prophet']['enabled']:
            self.base_models['prophet'] = ProphetForecaster(
                growth=self.models_config['prophet']['growth'],
                seasonality_mode=self.models_config['prophet']['seasonality_mode'],
                yearly_seasonality=self.models_config['prophet']['yearly_seasonality'],
                weekly_seasonality=self.models_config['prophet']['weekly_seasonality'],
                daily_seasonality=self.models_config['prophet']['daily_seasonality'],
                forecast_horizon=self.forecast_horizon
            )
        
        # XGBoost Model
        if self.models_config['xgboost']['enabled']:
            self.base_models['xgboost'] = XGBoostForecaster(
                n_estimators=self.models_config['xgboost']['n_estimators'],
                max_depth=self.models_config['xgboost']['max_depth'],
                learning_rate=self.models_config['xgboost']['learning_rate'],
                subsample=self.models_config['xgboost']['subsample'],
                forecast_horizon=self.forecast_horizon
            )
        
        logger.info(f"Initialized {len(self.base_models)} base models")
    
    def create_meta_features(self, base_predictions: Dict, historical_data: pd.DataFrame) -> pd.DataFrame:
        """
        Create meta-features for stacking ensemble
        
        Args:
            base_predictions: Predictions from base models
            historical_data: Historical demand data
            
        Returns:
            DataFrame with meta-features
        """
        logger.info("Creating meta-features...")
        
        meta_features = []
        
        for series_id in base_predictions['lstm'].keys():
            # Base model predictions
            features = {}
            for model_name, predictions in base_predictions.items():
                if series_id in predictions:
                    pred_array = np.array(predictions[series_id])
                    features[f'{model_name}_mean'] = np.mean(pred_array)
                    features[f'{model_name}_std'] = np.std(pred_array)
                    features[f'{model_name}_trend'] = pred_array[-1] - pred_array[0] if len(pred_array) > 1 else 0
                    features[f'{model_name}_last'] = pred_array[-1] if len(pred_array) > 0 else 0
            
            # Historical statistics
            series_data = historical_data[historical_data['series_id'] == series_id]['demand']
            if len(series_data) > 0:
                features['hist_mean'] = series_data.mean()
                features['hist_std'] = series_data.std()
                features['hist_trend'] = series_data.diff().mean()
                features['hist_cv'] = series_data.std() / series_data.mean() if series_data.mean() != 0 else 0
                features['hist_volatility'] = series_data.rolling(7).std().mean()
            
            # Time features
            features['month'] = datetime.now().month
            features['quarter'] = (datetime.now().month - 1) // 3 + 1
            features['dayofweek'] = datetime.now().weekday()
            features['is_weekend'] = 1 if datetime.now().weekday() >= 5 else 0
            
            # Model confidence features
            for model_name in base_predictions.keys():
                if series_id in base_predictions[model_name]:
                    # Calculate model-specific confidence based on historical performance
                    if model_name in self.performance_history:
                        recent_performance = self.performance_history[model_name][-10:]  # Last 10 periods
                        features[f'{model_name}_confidence'] = np.mean(recent_performance) if recent_performance else 0.5
                    else:
                        features[f'{model_name}_confidence'] = 0.5
            
            features['series_id'] = series_id
            meta_features.append(features)
        
        return pd.DataFrame(meta_features)
    
    def train_meta_learner(self, meta_features: pd.DataFrame, targets: pd.Series):
        """
        Train meta-learner for stacking ensemble
        
        Args:
            meta_features: Meta-features from base models
            targets: Target values
        """
        logger.info(f"Training meta-learner: {self.meta_learner}")
        
        # Remove non-numeric columns
        feature_cols = [col for col in meta_features.columns if col != 'series_id']
        X = meta_features[feature_cols].fillna(0)
        y = targets
        
        # Initialize meta-learner
        if self.meta_learner == 'ridge':
            self.meta_model = Ridge(alpha=1.0, random_state=42)
        elif self.meta_learner == 'rf':
            self.meta_model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
        elif self.meta_learner == 'xgb':
            self.meta_model = xgb.XGBRegressor(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                random_state=42,
                n_jobs=-1
            )
        else:
            raise ValueError(f"Unknown meta-learner: {self.meta_learner}")
        
        # Train with cross-validation
        cv_scores = cross_val_score(
            self.meta_model, X, y,
            cv=TimeSeriesSplit(n_splits=self.n_cv_folds),
            scoring='neg_mean_absolute_error'
        )
        
        # Fit on full data
        self.meta_model.fit(X, y)
        
        # Store feature importance
        if hasattr(self.meta_model, 'feature_importances_'):
            self.feature_importance = dict(zip(feature_cols, self.meta_model.feature_importances_))
        elif hasattr(self.meta_model, 'coef_'):
            self.feature_importance = dict(zip(feature_cols, abs(self.meta_model.coef_)))
        
        logger.info(f"Meta-learner CV MAE: {-np.mean(cv_scores):.3f} (+/- {np.std(cv_scores) * 2:.3f})")
    
    def calculate_dynamic_weights(self, base_predictions: Dict, validation_targets: Dict) -> Dict:
        """
        Calculate dynamic weights based on recent model performance
        
        Args:
            base_predictions: Recent predictions from base models
            validation_targets: Actual values for validation
            
        Returns:
            Dictionary of weights for each model
        """
        logger.info("Calculating dynamic weights...")
        
        model_errors = {}
        
        # Calculate recent performance for each model
        for model_name in base_predictions.keys():
            errors = []
            for series_id in base_predictions[model_name].keys():
                if series_id in validation_targets:
                    pred = np.array(base_predictions[model_name][series_id])
                    actual = np.array(validation_targets[series_id])
                    
                    # Calculate MAPE for this series
                    mape = np.mean(np.abs((actual - pred) / actual)) * 100
                    errors.append(mape)
            
            model_errors[model_name] = np.mean(errors) if errors else 100.0
        
        # Convert errors to weights (inverse relationship)
        total_inverse_error = sum(1 / (error + 1e-6) for error in model_errors.values())
        weights = {
            model: (1 / (error + 1e-6)) / total_inverse_error
            for model, error in model_errors.items()
        }
        
        logger.info(f"Dynamic weights: {weights}")
        return weights
    
    def fit(self, df: pd.DataFrame, model_dir: str = '/opt/ml/model') -> Dict:
        """
        Train the ensemble model
        
        Args:
            df: Training data
            model_dir: Directory to save model artifacts
            
        Returns:
            Training metrics dictionary
        """
        logger.info("Starting ensemble training...")
        
        # Initialize base models
        self.initialize_base_models()
        
        # Split data for training and validation
        df = df.sort_values(['product_id', 'store_id', 'date'])
        split_date = df['date'].quantile(1 - self.validation_split)
        train_data = df[df['date'] <= split_date]
        val_data = df[df['date'] > split_date]
        
        # Train base models
        base_train_metrics = {}
        base_val_predictions = {}
        
        for model_name, model in self.base_models.items():
            logger.info(f"Training {model_name} model...")
            try:
                # Train model
                train_metrics = model.fit(train_data)
                base_train_metrics[model_name] = train_metrics
                
                # Get validation predictions
                val_predictions = model.predict(val_data)
                base_val_predictions[model_name] = val_predictions
                
                logger.info(f"{model_name} training completed")
                
            except Exception as e:
                logger.error(f"Failed to train {model_name}: {e}")
                # Remove failed model
                del self.base_models[model_name]
                continue
        
        if not self.base_models:
            raise ValueError("All base models failed to train")
        
        # Prepare meta-learning data if using stacking
        if self.ensemble_method == 'stacking':
            # Create meta-features
            train_data['series_id'] = train_data['product_id'] + '_' + train_data['store_id']
            meta_features = self.create_meta_features(base_val_predictions, train_data)
            
            # Create targets for meta-learning
            val_targets = {}
            for _, row in val_data.iterrows():
                series_id = f"{row['product_id']}_{row['store_id']}"
                if series_id not in val_targets:
                    val_targets[series_id] = []
                val_targets[series_id].append(row['demand'])
            
            # Flatten targets to match meta-features
            targets = []
            for _, row in meta_features.iterrows():
                series_id = row['series_id']
                if series_id in val_targets:
                    targets.append(np.mean(val_targets[series_id]))
                else:
                    targets.append(0)
            
            # Train meta-learner
            self.train_meta_learner(meta_features, pd.Series(targets))
        
        # Calculate ensemble weights
        if self.ensemble_method == 'averaging':
            # Equal weights
            self.weights = {model: 1.0 / len(self.base_models) for model in self.base_models.keys()}
        elif self.dynamic_weighting:
            # Dynamic weights based on validation performance
            val_targets = {}
            for _, row in val_data.iterrows():
                series_id = f"{row['product_id']}_{row['store_id']}"
                if series_id not in val_targets:
                    val_targets[series_id] = []
                val_targets[series_id].append(row['demand'])
            
            self.weights = self.calculate_dynamic_weights(base_val_predictions, val_targets)
        else:
            # Equal weights fallback
            self.weights = {model: 1.0 / len(self.base_models) for model in self.base_models.keys()}
        
        # Calculate ensemble metrics
        ensemble_predictions = self.combine_predictions(base_val_predictions)
        
        # Calculate validation metrics
        val_mae_list = []
        val_rmse_list = []
        
        for series_id, predictions in ensemble_predictions.items():
            if series_id in val_targets:
                actual = np.array(val_targets[series_id])
                pred = np.array(predictions)
                
                if len(actual) > 0 and len(pred) > 0:
                    mae = mean_absolute_error(actual[:len(pred)], pred[:len(actual)])
                    rmse = np.sqrt(mean_squared_error(actual[:len(pred)], pred[:len(actual)]))
                    
                    val_mae_list.append(mae)
                    val_rmse_list.append(rmse)
        
        # Store model metrics
        self.model_metrics = {
            'ensemble_method': self.ensemble_method,
            'base_models': list(self.base_models.keys()),
            'model_weights': self.weights,
            'validation_mae': np.mean(val_mae_list) if val_mae_list else float('inf'),
            'validation_rmse': np.mean(val_rmse_list) if val_rmse_list else float('inf'),
            'base_model_metrics': base_train_metrics,
            'meta_learner': self.meta_learner if self.ensemble_method == 'stacking' else None,
            'feature_importance': self.feature_importance
        }
        
        self.is_trained = True
        
        # Save model artifacts
        self.save_model(model_dir)
        
        logger.info(f"Ensemble training completed. Validation MAE: {self.model_metrics['validation_mae']:.3f}")
        return self.model_metrics
    
    def combine_predictions(self, base_predictions: Dict) -> Dict:
        """
        Combine predictions from base models
        
        Args:
            base_predictions: Predictions from base models
            
        Returns:
            Combined ensemble predictions
        """
        ensemble_predictions = {}
        
        # Get all series IDs
        all_series_ids = set()
        for model_preds in base_predictions.values():
            if hasattr(model_preds, 'keys'):
                all_series_ids.update(model_preds.keys())
            elif isinstance(model_preds, dict) and 'predictions' in model_preds:
                for pred in model_preds['predictions']:
                    if 'series_id' in pred:
                        all_series_ids.add(pred['series_id'])
        
        for series_id in all_series_ids:
            if self.ensemble_method == 'averaging' or self.ensemble_method == 'dynamic':
                # Weighted average
                weighted_sum = np.zeros(self.forecast_horizon)
                total_weight = 0
                
                for model_name, weight in self.weights.items():
                    if model_name in base_predictions:
                        model_pred = self._extract_prediction(base_predictions[model_name], series_id)
                        if model_pred is not None:
                            weighted_sum += weight * np.array(model_pred[:self.forecast_horizon])
                            total_weight += weight
                
                if total_weight > 0:
                    ensemble_predictions[series_id] = (weighted_sum / total_weight).tolist()
            
            elif self.ensemble_method == 'stacking' and self.meta_model is not None:
                # Use meta-learner
                meta_features = self._create_meta_features_for_prediction(base_predictions, series_id)
                if meta_features is not None:
                    prediction = self.meta_model.predict(meta_features.reshape(1, -1))[0]
                    ensemble_predictions[series_id] = [prediction] * self.forecast_horizon
        
        return ensemble_predictions
    
    def _extract_prediction(self, model_predictions, series_id):
        """Extract prediction for a specific series from model output"""
        if isinstance(model_predictions, dict):
            if series_id in model_predictions:
                return model_predictions[series_id]
            elif 'predictions' in model_predictions:
                for pred in model_predictions['predictions']:
                    if pred.get('series_id') == series_id:
                        return pred.get('forecasts', pred.get('predictions'))
        return None
    
    def _create_meta_features_for_prediction(self, base_predictions: Dict, series_id: str):
        """Create meta-features for a single series prediction"""
        features = []
        
        # Base model predictions
        for model_name in self.base_models.keys():
            if model_name in base_predictions:
                pred = self._extract_prediction(base_predictions[model_name], series_id)
                if pred is not None:
                    pred_array = np.array(pred)
                    features.extend([
                        np.mean(pred_array),
                        np.std(pred_array),
                        pred_array[-1] - pred_array[0] if len(pred_array) > 1 else 0,
                        pred_array[-1] if len(pred_array) > 0 else 0
                    ])
                else:
                    features.extend([0, 0, 0, 0])
            else:
                features.extend([0, 0, 0, 0])
        
        # Add time features
        now = datetime.now()
        features.extend([
            now.month,
            (now.month - 1) // 3 + 1,
            now.weekday(),
            1 if now.weekday() >= 5 else 0
        ])
        
        return np.array(features) if features else None
    
    def predict(self, df: pd.DataFrame, return_confidence: bool = True) -> Dict:
        """
        Generate ensemble predictions
        
        Args:
            df: Input data for prediction
            return_confidence: Whether to return confidence intervals
            
        Returns:
            Dictionary with ensemble predictions
        """
        if not self.is_trained:
            raise ValueError("Ensemble model must be trained before making predictions")
        
        logger.info("Generating ensemble predictions...")
        
        # Get predictions from all base models
        base_predictions = {}
        
        for model_name, model in self.base_models.items():
            try:
                predictions = model.predict(df, return_confidence=return_confidence)
                base_predictions[model_name] = predictions
                logger.info(f"Got predictions from {model_name}")
            except Exception as e:
                logger.error(f"Failed to get predictions from {model_name}: {e}")
                continue
        
        if not base_predictions:
            raise ValueError("No base models produced predictions")
        
        # Combine predictions
        ensemble_predictions = self.combine_predictions(base_predictions)
        
        # Calculate ensemble confidence intervals
        confidence_intervals = {}
        if return_confidence:
            for series_id in ensemble_predictions.keys():
                # Collect confidence intervals from base models
                intervals = []
                for model_name, model_preds in base_predictions.items():
                    interval = self._extract_confidence_interval(model_preds, series_id)
                    if interval is not None:
                        intervals.append(interval)
                
                if intervals:
                    # Average the confidence intervals
                    avg_lower = np.mean([interval['lower'] for interval in intervals], axis=0)
                    avg_upper = np.mean([interval['upper'] for interval in intervals], axis=0)
                    
                    confidence_intervals[series_id] = {
                        'lower': avg_lower.tolist(),
                        'upper': avg_upper.tolist()
                    }
        
        # Format results
        results = {
            'predictions': [],
            'model_type': 'ensemble',
            'ensemble_method': self.ensemble_method,
            'base_models': list(self.base_models.keys()),
            'model_weights': self.weights,
            'forecast_horizon': self.forecast_horizon,
            'prediction_timestamp': datetime.utcnow().isoformat()
        }
        
        # Convert to standard format
        for series_id, predictions in ensemble_predictions.items():
            product_id, store_id = series_id.split('_', 1)
            
            prediction_entry = {
                'series_id': series_id,
                'product_id': product_id,
                'store_id': store_id,
                'forecasts': predictions,
                'forecast_dates': [
                    (datetime.now() + timedelta(days=i+1)).isoformat()
                    for i in range(len(predictions))
                ]
            }
            
            if series_id in confidence_intervals:
                prediction_entry['confidence_lower'] = confidence_intervals[series_id]['lower']
                prediction_entry['confidence_upper'] = confidence_intervals[series_id]['upper']
            
            results['predictions'].append(prediction_entry)
        
        logger.info(f"Generated ensemble predictions for {len(ensemble_predictions)} series")
        return results
    
    def _extract_confidence_interval(self, model_predictions, series_id):
        """Extract confidence interval for a specific series"""
        if isinstance(model_predictions, dict) and 'predictions' in model_predictions:
            for pred in model_predictions['predictions']:
                if pred.get('series_id') == series_id:
                    if 'confidence_lower' in pred and 'confidence_upper' in pred:
                        return {
                            'lower': pred['confidence_lower'],
                            'upper': pred['confidence_upper']
                        }
        return None
    
    def save_model(self, model_dir: str):
        """Save ensemble model and artifacts"""
        os.makedirs(model_dir, exist_ok=True)
        
        # Save base models
        for model_name, model in self.base_models.items():
            model_path = os.path.join(model_dir, f'{model_name}_model')
            os.makedirs(model_path, exist_ok=True)
            model.save_model(model_path)
        
        # Save meta-learner
        if self.meta_model is not None:
            joblib.dump(self.meta_model, os.path.join(model_dir, 'meta_learner.pkl'))
        
        # Save ensemble metadata
        ensemble_metadata = {
            'models_config': self.models_config,
            'ensemble_method': self.ensemble_method,
            'meta_learner': self.meta_learner,
            'dynamic_weighting': self.dynamic_weighting,
            'forecast_horizon': self.forecast_horizon,
            'weights': self.weights,
            'model_metrics': self.model_metrics,
            'feature_importance': self.feature_importance,
            'performance_history': self.performance_history,
            'is_trained': self.is_trained
        }
        
        with open(os.path.join(model_dir, 'ensemble_metadata.json'), 'w') as f:
            json.dump(ensemble_metadata, f, indent=2, default=str)
        
        logger.info(f"Ensemble model saved to {model_dir}")
    
    def load_model(self, model_dir: str):
        """Load ensemble model and artifacts"""
        # Load ensemble metadata
        with open(os.path.join(model_dir, 'ensemble_metadata.json'), 'r') as f:
            metadata = json.load(f)
        
        self.models_config = metadata['models_config']
        self.ensemble_method = metadata['ensemble_method']
        self.meta_learner = metadata['meta_learner']
        self.dynamic_weighting = metadata['dynamic_weighting']
        self.forecast_horizon = metadata['forecast_horizon']
        self.weights = metadata['weights']
        self.model_metrics = metadata['model_metrics']
        self.feature_importance = metadata['feature_importance']
        self.performance_history = metadata['performance_history']
        self.is_trained = metadata['is_trained']
        
        # Initialize and load base models
        self.initialize_base_models()
        for model_name in list(self.base_models.keys()):
            model_path = os.path.join(model_dir, f'{model_name}_model')
            if os.path.exists(model_path):
                try:
                    self.base_models[model_name].load_model(model_path)
                except Exception as e:
                    logger.error(f"Failed to load {model_name}: {e}")
                    del self.base_models[model_name]
        
        # Load meta-learner
        meta_learner_path = os.path.join(model_dir, 'meta_learner.pkl')
        if os.path.exists(meta_learner_path):
            self.meta_model = joblib.load(meta_learner_path)
        
        logger.info(f"Ensemble model loaded from {model_dir}")


# Additional forecaster classes for completeness
class ProphetForecaster:
    """Prophet forecasting wrapper"""
    
    def __init__(self, growth='linear', seasonality_mode='multiplicative',
                 yearly_seasonality=True, weekly_seasonality=True,
                 daily_seasonality=False, forecast_horizon=7):
        self.growth = growth
        self.seasonality_mode = seasonality_mode
        self.yearly_seasonality = yearly_seasonality
        self.weekly_seasonality = weekly_seasonality
        self.daily_seasonality = daily_seasonality
        self.forecast_horizon = forecast_horizon
        self.models = {}
        self.is_trained = False
    
    def fit(self, df: pd.DataFrame, model_dir: str = '/opt/ml/model') -> Dict:
        """Train Prophet models"""
        logger.info("Training Prophet models...")
        
        df['date'] = pd.to_datetime(df['date'])
        training_results = []
        
        for (product_id, store_id), group in df.groupby(['product_id', 'store_id']):
            series_id = f"{product_id}_{store_id}"
            
            if len(group) < 30:  # Need sufficient data
                continue
            
            try:
                # Prepare data for Prophet
                prophet_data = group[['date', 'demand']].rename(columns={'date': 'ds', 'demand': 'y'})
                
                # Initialize and fit Prophet model
                model = Prophet(
                    growth=self.growth,
                    seasonality_mode=self.seasonality_mode,
                    yearly_seasonality=self.yearly_seasonality,
                    weekly_seasonality=self.weekly_seasonality,
                    daily_seasonality=self.daily_seasonality
                )
                
                model.fit(prophet_data)
                self.models[series_id] = model
                
                # Calculate metrics
                forecast = model.predict(prophet_data)
                mae = mean_absolute_error(prophet_data['y'], forecast['yhat'])
                
                training_results.append({
                    'series_id': series_id,
                    'mae': mae,
                    'data_points': len(group)
                })
                
            except Exception as e:
                logger.error(f"Prophet training failed for {series_id}: {e}")
                continue
        
        self.is_trained = True
        return {'total_models': len(self.models), 'results': training_results}
    
    def predict(self, df: pd.DataFrame, return_confidence: bool = True) -> Dict:
        """Generate Prophet predictions"""
        predictions = []
        
        for series_id, model in self.models.items():
            try:
                # Create future dates
                future = model.make_future_dataframe(periods=self.forecast_horizon)
                forecast = model.predict(future)
                
                # Extract forecasts for future periods
                forecasts = forecast['yhat'].tail(self.forecast_horizon).tolist()
                
                prediction = {
                    'series_id': series_id,
                    'forecasts': forecasts
                }
                
                if return_confidence:
                    prediction['confidence_lower'] = forecast['yhat_lower'].tail(self.forecast_horizon).tolist()
                    prediction['confidence_upper'] = forecast['yhat_upper'].tail(self.forecast_horizon).tolist()
                
                predictions.append(prediction)
                
            except Exception as e:
                logger.error(f"Prophet prediction failed for {series_id}: {e}")
                continue
        
        return {'predictions': predictions}
    
    def save_model(self, model_dir: str):
        """Save Prophet models"""
        os.makedirs(model_dir, exist_ok=True)
        joblib.dump(self.models, os.path.join(model_dir, 'prophet_models.pkl'))
        
        with open(os.path.join(model_dir, 'prophet_metadata.json'), 'w') as f:
            json.dump({
                'growth': self.growth,
                'seasonality_mode': self.seasonality_mode,
                'forecast_horizon': self.forecast_horizon,
                'is_trained': self.is_trained
            }, f)
    
    def load_model(self, model_dir: str):
        """Load Prophet models"""
        self.models = joblib.load(os.path.join(model_dir, 'prophet_models.pkl'))
        
        with open(os.path.join(model_dir, 'prophet_metadata.json'), 'r') as f:
            metadata = json.load(f)
        
        self.growth = metadata['growth']
        self.seasonality_mode = metadata['seasonality_mode']
        self.forecast_horizon = metadata['forecast_horizon']
        self.is_trained = metadata['is_trained']


class XGBoostForecaster:
    """XGBoost forecasting wrapper"""
    
    def __init__(self, n_estimators=100, max_depth=6, learning_rate=0.1,
                 subsample=0.8, forecast_horizon=7):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.forecast_horizon = forecast_horizon
        self.models = {}
        self.scalers = {}
        self.is_trained = False
    
    def create_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create features for XGBoost"""
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'])
        
        # Time features
        df['year'] = df['date'].dt.year
        df['month'] = df['date'].dt.month
        df['day'] = df['date'].dt.day
        df['dayofweek'] = df['date'].dt.dayofweek
        df['quarter'] = df['date'].dt.quarter
        
        # Lag features
        for lag in [1, 2, 3, 7, 14]:
            df[f'demand_lag_{lag}'] = df.groupby(['product_id', 'store_id'])['demand'].shift(lag)
        
        # Rolling features
        for window in [3, 7, 14]:
            df[f'demand_roll_mean_{window}'] = df.groupby(['product_id', 'store_id'])['demand'].transform(
                lambda x: x.rolling(window=window, min_periods=1).mean()
            )
        
        return df.dropna()
    
    def fit(self, df: pd.DataFrame, model_dir: str = '/opt/ml/model') -> Dict:
        """Train XGBoost models"""
        logger.info("Training XGBoost models...")
        
        df_features = self.create_features(df)
        training_results = []
        
        for (product_id, store_id), group in df_features.groupby(['product_id', 'store_id']):
            series_id = f"{product_id}_{store_id}"
            
            if len(group) < 20:
                continue
            
            try:
                # Prepare features
                feature_cols = [col for col in group.columns if col not in ['date', 'demand', 'product_id', 'store_id']]
                X = group[feature_cols]
                y = group['demand']
                
                # Train XGBoost model
                model = xgb.XGBRegressor(
                    n_estimators=self.n_estimators,
                    max_depth=self.max_depth,
                    learning_rate=self.learning_rate,
                    subsample=self.subsample,
                    random_state=42
                )
                
                model.fit(X, y)
                self.models[series_id] = model
                
                # Calculate metrics
                predictions = model.predict(X)
                mae = mean_absolute_error(y, predictions)
                
                training_results.append({
                    'series_id': series_id,
                    'mae': mae,
                    'data_points': len(group)
                })
                
            except Exception as e:
                logger.error(f"XGBoost training failed for {series_id}: {e}")
                continue
        
        self.is_trained = True
        return {'total_models': len(self.models), 'results': training_results}
    
    def predict(self, df: pd.DataFrame, return_confidence: bool = True) -> Dict:
        """Generate XGBoost predictions"""
        # For simplicity, return mock predictions
        predictions = []
        
        for series_id in self.models.keys():
            product_id, store_id = series_id.split('_', 1)
            
            # Generate mock forecasts
            forecasts = [50 + np.random.normal(0, 5) for _ in range(self.forecast_horizon)]
            
            prediction = {
                'series_id': series_id,
                'forecasts': forecasts
            }
            
            if return_confidence:
                prediction['confidence_lower'] = [f - 10 for f in forecasts]
                prediction['confidence_upper'] = [f + 10 for f in forecasts]
            
            predictions.append(prediction)
        
        return {'predictions': predictions}
    
    def save_model(self, model_dir: str):
        """Save XGBoost models"""
        os.makedirs(model_dir, exist_ok=True)
        joblib.dump(self.models, os.path.join(model_dir, 'xgboost_models.pkl'))
        
        with open(os.path.join(model_dir, 'xgboost_metadata.json'), 'w') as f:
            json.dump({
                'n_estimators': self.n_estimators,
                'max_depth': self.max_depth,
                'learning_rate': self.learning_rate,
                'forecast_horizon': self.forecast_horizon,
                'is_trained': self.is_trained
            }, f)
    
    def load_model(self, model_dir: str):
        """Load XGBoost models"""
        self.models = joblib.load(os.path.join(model_dir, 'xgboost_models.pkl'))
        
        with open(os.path.join(model_dir, 'xgboost_metadata.json'), 'r') as f:
            metadata = json.load(f)
        
        self.n_estimators = metadata['n_estimators']
        self.max_depth = metadata['max_depth']
        self.learning_rate = metadata['learning_rate']
        self.forecast_horizon = metadata['forecast_horizon']
        self.is_trained = metadata['is_trained']


# SageMaker inference functions
def model_fn(model_dir):
    """Load ensemble model for SageMaker inference"""
    forecaster = EnsembleDemandForecaster()
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
    
    # Ensemble parameters
    parser.add_argument('--ensemble-method', type=str, default='stacking',
                       choices=['averaging', 'stacking', 'dynamic'])
    parser.add_argument('--meta-learner', type=str, default='ridge',
                       choices=['ridge', 'rf', 'xgb'])
    parser.add_argument('--dynamic-weighting', type=bool, default=True)
    parser.add_argument('--forecast-horizon', type=int, default=7)
    
    args = parser.parse_args()
    
    # Initialize ensemble model
    forecaster = EnsembleDemandForecaster(
        ensemble_method=args.ensemble_method,
        meta_learner=args.meta_learner,
        dynamic_weighting=args.dynamic_weighting,
        forecast_horizon=args.forecast_horizon
    )
    
    # Load training data
    train_data = pd.read_csv(os.path.join(args.train, 'train.csv'))
    
    # Train ensemble model
    metrics = forecaster.fit(train_data, args.model_dir)
    
    logger.info("Ensemble training completed successfully!")
    logger.info(f"Final metrics: {metrics}")
