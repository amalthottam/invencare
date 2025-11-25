#!/usr/bin/env python3
"""
ARIMA Demand Forecasting Model for AWS SageMaker
===============================================

This script implements an advanced ARIMA model with seasonal decomposition
and automatic parameter selection for demand forecasting on AWS SageMaker.

Features:
- Automatic ARIMA parameter selection (auto-ARIMA)
- Seasonal ARIMA (SARIMA) support
- Multiple time series handling
- Robust outlier detection and handling
- Confidence intervals
- Model diagnostics and validation
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
from sklearn.metrics import mean_absolute_error, mean_squared_error
import statsmodels.api as sm
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import adfuller, kpss
from statsmodels.stats.diagnostic import acorr_ljungbox
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf
import pmdarima as pm
from scipy import stats

# Suppress warnings
warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ARIMADemandForecaster:
    """
    Advanced ARIMA model for demand forecasting with automatic parameter selection
    and seasonal decomposition.
    """
    
    def __init__(self,
                 max_p: int = 5,
                 max_d: int = 2,
                 max_q: int = 5,
                 max_P: int = 2,
                 max_D: int = 1,
                 max_Q: int = 2,
                 seasonal_period: int = 7,
                 forecast_horizon: int = 7,
                 information_criterion: str = 'aic',
                 seasonal: bool = True,
                 trend: Optional[str] = None,
                 error_action: str = 'ignore',
                 suppress_warnings: bool = True,
                 stepwise: bool = True):
        """
        Initialize ARIMA Demand Forecaster
        
        Args:
            max_p: Maximum order of autoregressive component
            max_d: Maximum degree of differencing
            max_q: Maximum order of moving average component
            max_P: Maximum seasonal autoregressive order
            max_D: Maximum seasonal differencing order
            max_Q: Maximum seasonal moving average order
            seasonal_period: Number of periods in seasonal cycle
            forecast_horizon: Number of periods to forecast ahead
            information_criterion: Information criterion for model selection
            seasonal: Whether to fit seasonal ARIMA
            trend: Trend component ('c', 't', 'ct', or None)
            error_action: How to handle errors during fitting
            suppress_warnings: Whether to suppress warnings
            stepwise: Whether to use stepwise search
        """
        self.max_p = max_p
        self.max_d = max_d
        self.max_q = max_q
        self.max_P = max_P
        self.max_D = max_D
        self.max_Q = max_Q
        self.seasonal_period = seasonal_period
        self.forecast_horizon = forecast_horizon
        self.information_criterion = information_criterion
        self.seasonal = seasonal
        self.trend = trend
        self.error_action = error_action
        self.suppress_warnings = suppress_warnings
        self.stepwise = stepwise
        
        # Model storage
        self.models = {}  # Dictionary to store models for each time series
        self.scalers = {}  # Dictionary to store scalers for each time series
        self.series_metadata = {}  # Metadata for each time series
        self.is_trained = False
        
        # Model metrics
        self.model_metrics = {}
        self.diagnostics = {}
        
    def preprocess_series(self, series: pd.Series, series_id: str) -> Tuple[pd.Series, Dict]:
        """
        Preprocess time series data
        
        Args:
            series: Time series data
            series_id: Unique identifier for the series
            
        Returns:
            Tuple of (processed_series, metadata)
        """
        logger.info(f"Preprocessing series {series_id}")
        
        metadata = {
            'original_length': len(series),
            'missing_values': series.isnull().sum(),
            'zero_values': (series == 0).sum(),
            'negative_values': (series < 0).sum()
        }
        
        # Handle missing values
        if metadata['missing_values'] > 0:
            series = series.interpolate(method='linear')
            logger.info(f"Interpolated {metadata['missing_values']} missing values")
        
        # Handle negative values (set to small positive value)
        if metadata['negative_values'] > 0:
            series = series.clip(lower=0.01)
            logger.info(f"Clipped {metadata['negative_values']} negative values")
        
        # Outlier detection using IQR
        Q1 = series.quantile(0.25)
        Q3 = series.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        
        outliers = (series < lower_bound) | (series > upper_bound)
        metadata['outliers'] = outliers.sum()
        
        if metadata['outliers'] > 0:
            # Cap outliers at reasonable bounds
            series = series.clip(lower=lower_bound, upper=upper_bound)
            logger.info(f"Capped {metadata['outliers']} outliers")
        
        # Store metadata
        metadata['final_length'] = len(series)
        metadata['min_value'] = series.min()
        metadata['max_value'] = series.max()
        metadata['mean_value'] = series.mean()
        metadata['std_value'] = series.std()
        
        return series, metadata
    
    def check_stationarity(self, series: pd.Series) -> Dict:
        """
        Check stationarity of time series using ADF and KPSS tests
        
        Args:
            series: Time series to test
            
        Returns:
            Dictionary with stationarity test results
        """
        logger.info("Checking stationarity...")
        
        # Augmented Dickey-Fuller test
        adf_result = adfuller(series.dropna())
        adf_stationary = adf_result[1] < 0.05  # p-value < 0.05 suggests stationarity
        
        # KPSS test
        kpss_result = kpss(series.dropna())
        kpss_stationary = kpss_result[1] > 0.05  # p-value > 0.05 suggests stationarity
        
        results = {
            'adf_statistic': adf_result[0],
            'adf_pvalue': adf_result[1],
            'adf_stationary': adf_stationary,
            'kpss_statistic': kpss_result[0],
            'kpss_pvalue': kpss_result[1],
            'kpss_stationary': kpss_stationary,
            'both_tests_agree': adf_stationary and kpss_stationary
        }
        
        logger.info(f"ADF test: {'Stationary' if adf_stationary else 'Non-stationary'}")
        logger.info(f"KPSS test: {'Stationary' if kpss_stationary else 'Non-stationary'}")
        
        return results
    
    def seasonal_decomposition(self, series: pd.Series, series_id: str) -> Dict:
        """
        Perform seasonal decomposition
        
        Args:
            series: Time series data
            series_id: Series identifier
            
        Returns:
            Dictionary with decomposition components
        """
        logger.info(f"Performing seasonal decomposition for {series_id}")
        
        try:
            # Perform decomposition
            decomposition = seasonal_decompose(
                series, 
                model='multiplicative', 
                period=self.seasonal_period,
                extrapolate_trend='freq'
            )
            
            # Calculate seasonal strength
            seasonal_strength = 1 - (np.var(decomposition.resid.dropna()) / 
                                    np.var(decomposition.trend.dropna() + decomposition.resid.dropna()))
            
            # Calculate trend strength
            trend_strength = 1 - (np.var(decomposition.resid.dropna()) / 
                                 np.var(decomposition.trend.dropna() + decomposition.resid.dropna()))
            
            result = {
                'seasonal_strength': max(0, seasonal_strength),
                'trend_strength': max(0, trend_strength),
                'has_strong_seasonality': seasonal_strength > 0.6,
                'has_strong_trend': trend_strength > 0.6,
                'residual_variance': np.var(decomposition.resid.dropna())
            }
            
            logger.info(f"Seasonal strength: {result['seasonal_strength']:.3f}")
            logger.info(f"Trend strength: {result['trend_strength']:.3f}")
            
            return result
            
        except Exception as e:
            logger.warning(f"Seasonal decomposition failed: {e}")
            return {
                'seasonal_strength': 0,
                'trend_strength': 0,
                'has_strong_seasonality': False,
                'has_strong_trend': False,
                'residual_variance': np.var(series)
            }
    
    def fit_auto_arima(self, series: pd.Series, series_id: str) -> pm.ARIMA:
        """
        Fit auto-ARIMA model with automatic parameter selection
        
        Args:
            series: Time series data
            series_id: Series identifier
            
        Returns:
            Fitted auto-ARIMA model
        """
        logger.info(f"Fitting auto-ARIMA for {series_id}")
        
        # Determine seasonal parameters
        seasonal_params = (self.max_P, self.max_D, self.max_Q, self.seasonal_period) if self.seasonal else None
        
        try:
            # Fit auto-ARIMA
            model = pm.auto_arima(
                series,
                start_p=0, start_q=0,
                max_p=self.max_p, max_d=self.max_d, max_q=self.max_q,
                seasonal=self.seasonal,
                start_P=0, start_Q=0,
                max_P=self.max_P, max_D=self.max_D, max_Q=self.max_Q,
                m=self.seasonal_period,
                information_criterion=self.information_criterion,
                trend=self.trend,
                error_action=self.error_action,
                suppress_warnings=self.suppress_warnings,
                stepwise=self.stepwise,
                n_jobs=-1,
                random_state=42
            )
            
            logger.info(f"Best model: ARIMA{model.order} x {model.seasonal_order if self.seasonal else 'None'}")
            logger.info(f"AIC: {model.aic():.2f}")
            
            return model
            
        except Exception as e:
            logger.error(f"Auto-ARIMA fitting failed for {series_id}: {e}")
            # Fallback to simple ARIMA(1,1,1)
            fallback_model = pm.ARIMA(order=(1, 1, 1), seasonal_order=None)
            fallback_model.fit(series)
            logger.info("Using fallback ARIMA(1,1,1) model")
            return fallback_model
    
    def calculate_model_diagnostics(self, model: pm.ARIMA, series: pd.Series, series_id: str) -> Dict:
        """
        Calculate comprehensive model diagnostics
        
        Args:
            model: Fitted ARIMA model
            series: Original time series
            series_id: Series identifier
            
        Returns:
            Dictionary with diagnostic metrics
        """
        logger.info(f"Calculating diagnostics for {series_id}")
        
        try:
            # Get residuals
            residuals = model.resid()
            
            # Basic residual statistics
            residual_mean = np.mean(residuals)
            residual_std = np.std(residuals)
            residual_skewness = stats.skew(residuals)
            residual_kurtosis = stats.kurtosis(residuals)
            
            # Ljung-Box test for autocorrelation in residuals
            ljung_box = acorr_ljungbox(residuals, lags=10, return_df=True)
            ljung_box_pvalue = ljung_box['lb_pvalue'].iloc[-1]
            
            # Jarque-Bera test for normality of residuals
            jb_statistic, jb_pvalue = stats.jarque_bera(residuals)
            
            # In-sample fit metrics
            fitted_values = model.fittedvalues()
            mae = mean_absolute_error(series[len(series) - len(fitted_values):], fitted_values)
            rmse = np.sqrt(mean_squared_error(series[len(series) - len(fitted_values):], fitted_values))
            mape = np.mean(np.abs((series[len(series) - len(fitted_values):] - fitted_values) / 
                                 series[len(series) - len(fitted_values):])) * 100
            
            diagnostics = {
                'aic': model.aic(),
                'bic': model.bic(),
                'mae': mae,
                'rmse': rmse,
                'mape': mape,
                'residual_mean': residual_mean,
                'residual_std': residual_std,
                'residual_skewness': residual_skewness,
                'residual_kurtosis': residual_kurtosis,
                'ljung_box_pvalue': ljung_box_pvalue,
                'residuals_autocorrelated': ljung_box_pvalue < 0.05,
                'jarque_bera_statistic': jb_statistic,
                'jarque_bera_pvalue': jb_pvalue,
                'residuals_normal': jb_pvalue > 0.05,
                'model_order': model.order,
                'seasonal_order': model.seasonal_order if hasattr(model, 'seasonal_order') else None
            }
            
            logger.info(f"Model diagnostics - AIC: {diagnostics['aic']:.2f}, MAE: {diagnostics['mae']:.2f}")
            
            return diagnostics
            
        except Exception as e:
            logger.error(f"Diagnostic calculation failed for {series_id}: {e}")
            return {
                'aic': float('inf'),
                'bic': float('inf'),
                'mae': float('inf'),
                'rmse': float('inf'),
                'mape': float('inf'),
                'error': str(e)
            }
    
    def fit(self, df: pd.DataFrame, model_dir: str = '/opt/ml/model') -> Dict:
        """
        Train ARIMA models for multiple time series
        
        Args:
            df: DataFrame with columns ['date', 'demand', 'product_id', 'store_id']
            model_dir: Directory to save model artifacts
            
        Returns:
            Training metrics dictionary
        """
        logger.info("Starting ARIMA training...")
        
        # Ensure date column is datetime
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values(['product_id', 'store_id', 'date'])
        
        training_results = []
        
        # Train model for each product-store combination
        for (product_id, store_id), group in df.groupby(['product_id', 'store_id']):
            series_id = f"{product_id}_{store_id}"
            
            # Skip if insufficient data
            if len(group) < self.seasonal_period * 2:
                logger.warning(f"Insufficient data for {series_id}: {len(group)} points")
                continue
            
            logger.info(f"Training model for {series_id}")
            
            # Prepare time series
            group = group.set_index('date')['demand']
            group = group.asfreq('D')  # Ensure daily frequency
            
            # Preprocess series
            processed_series, metadata = self.preprocess_series(group, series_id)
            self.series_metadata[series_id] = metadata
            
            # Check stationarity
            stationarity = self.check_stationarity(processed_series)
            metadata['stationarity'] = stationarity
            
            # Seasonal decomposition
            seasonal_decomp = self.seasonal_decomposition(processed_series, series_id)
            metadata['seasonal_decomposition'] = seasonal_decomp
            
            # Fit auto-ARIMA
            model = self.fit_auto_arima(processed_series, series_id)
            self.models[series_id] = model
            
            # Calculate diagnostics
            diagnostics = self.calculate_model_diagnostics(model, processed_series, series_id)
            self.diagnostics[series_id] = diagnostics
            
            # Store results
            result = {
                'series_id': series_id,
                'product_id': product_id,
                'store_id': store_id,
                'data_points': len(processed_series),
                **diagnostics
            }
            training_results.append(result)
        
        # Calculate overall metrics
        self.model_metrics = {
            'total_models': len(self.models),
            'avg_mae': np.mean([r['mae'] for r in training_results if 'mae' in r and r['mae'] != float('inf')]),
            'avg_rmse': np.mean([r['rmse'] for r in training_results if 'rmse' in r and r['rmse'] != float('inf')]),
            'avg_mape': np.mean([r['mape'] for r in training_results if 'mape' in r and r['mape'] != float('inf')]),
            'avg_aic': np.mean([r['aic'] for r in training_results if 'aic' in r and r['aic'] != float('inf')]),
            'successful_models': len([r for r in training_results if 'error' not in r]),
            'failed_models': len([r for r in training_results if 'error' in r]),
            'training_results': training_results
        }
        
        self.is_trained = True
        
        # Save model artifacts
        self.save_model(model_dir)
        
        logger.info(f"Training completed. Successfully trained {self.model_metrics['successful_models']} models")
        logger.info(f"Average MAE: {self.model_metrics['avg_mae']:.2f}")
        
        return self.model_metrics
    
    def predict(self, df: pd.DataFrame, return_confidence: bool = True) -> Dict:
        """
        Generate predictions with confidence intervals
        
        Args:
            df: Input data for prediction (can be empty for forecasting)
            return_confidence: Whether to return confidence intervals
            
        Returns:
            Dictionary with predictions and metadata
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")
        
        logger.info("Generating ARIMA predictions...")
        
        predictions_list = []
        
        for series_id, model in self.models.items():
            try:
                # Generate forecast
                forecast_result = model.predict(
                    n_periods=self.forecast_horizon,
                    return_conf_int=return_confidence,
                    alpha=0.05  # 95% confidence interval
                )
                
                if return_confidence:
                    forecasts, conf_int = forecast_result
                    
                    prediction = {
                        'series_id': series_id,
                        'product_id': series_id.split('_')[0],
                        'store_id': series_id.split('_')[1],
                        'forecasts': forecasts.tolist(),
                        'confidence_lower': conf_int[:, 0].tolist(),
                        'confidence_upper': conf_int[:, 1].tolist(),
                        'forecast_dates': [
                            (datetime.now() + timedelta(days=i+1)).isoformat()
                            for i in range(self.forecast_horizon)
                        ]
                    }
                else:
                    forecasts = forecast_result
                    
                    prediction = {
                        'series_id': series_id,
                        'product_id': series_id.split('_')[0],
                        'store_id': series_id.split('_')[1],
                        'forecasts': forecasts.tolist(),
                        'forecast_dates': [
                            (datetime.now() + timedelta(days=i+1)).isoformat()
                            for i in range(self.forecast_horizon)
                        ]
                    }
                
                predictions_list.append(prediction)
                
            except Exception as e:
                logger.error(f"Prediction failed for {series_id}: {e}")
                continue
        
        results = {
            'predictions': predictions_list,
            'forecast_horizon': self.forecast_horizon,
            'model_type': 'arima',
            'model_version': '1.0',
            'prediction_timestamp': datetime.utcnow().isoformat(),
            'total_predictions': len(predictions_list)
        }
        
        logger.info(f"Generated predictions for {len(predictions_list)} series")
        return results
    
    def save_model(self, model_dir: str):
        """Save model and artifacts"""
        os.makedirs(model_dir, exist_ok=True)
        
        # Save models
        joblib.dump(self.models, os.path.join(model_dir, 'arima_models.pkl'))
        
        # Save metadata
        metadata = {
            'max_p': self.max_p,
            'max_d': self.max_d,
            'max_q': self.max_q,
            'max_P': self.max_P,
            'max_D': self.max_D,
            'max_Q': self.max_Q,
            'seasonal_period': self.seasonal_period,
            'forecast_horizon': self.forecast_horizon,
            'seasonal': self.seasonal,
            'series_metadata': self.series_metadata,
            'model_metrics': self.model_metrics,
            'diagnostics': self.diagnostics,
            'is_trained': self.is_trained
        }
        
        with open(os.path.join(model_dir, 'arima_metadata.json'), 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
        
        logger.info(f"ARIMA models saved to {model_dir}")
    
    def load_model(self, model_dir: str):
        """Load model and artifacts"""
        # Load models
        self.models = joblib.load(os.path.join(model_dir, 'arima_models.pkl'))
        
        # Load metadata
        with open(os.path.join(model_dir, 'arima_metadata.json'), 'r') as f:
            metadata = json.load(f)
        
        self.max_p = metadata['max_p']
        self.max_d = metadata['max_d']
        self.max_q = metadata['max_q']
        self.max_P = metadata['max_P']
        self.max_D = metadata['max_D']
        self.max_Q = metadata['max_Q']
        self.seasonal_period = metadata['seasonal_period']
        self.forecast_horizon = metadata['forecast_horizon']
        self.seasonal = metadata['seasonal']
        self.series_metadata = metadata['series_metadata']
        self.model_metrics = metadata['model_metrics']
        self.diagnostics = metadata['diagnostics']
        self.is_trained = metadata['is_trained']
        
        logger.info(f"ARIMA models loaded from {model_dir}")


def model_fn(model_dir):
    """Load model for SageMaker inference"""
    forecaster = ARIMADemandForecaster()
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
    parser.add_argument('--max-p', type=int, default=5)
    parser.add_argument('--max-d', type=int, default=2)
    parser.add_argument('--max-q', type=int, default=5)
    parser.add_argument('--max-P', type=int, default=2)
    parser.add_argument('--max-D', type=int, default=1)
    parser.add_argument('--max-Q', type=int, default=2)
    parser.add_argument('--seasonal-period', type=int, default=7)
    parser.add_argument('--forecast-horizon', type=int, default=7)
    parser.add_argument('--seasonal', type=bool, default=True)
    
    args = parser.parse_args()
    
    # Initialize model
    forecaster = ARIMADemandForecaster(
        max_p=args.max_p,
        max_d=args.max_d,
        max_q=args.max_q,
        max_P=args.max_P,
        max_D=args.max_D,
        max_Q=args.max_Q,
        seasonal_period=args.seasonal_period,
        forecast_horizon=args.forecast_horizon,
        seasonal=args.seasonal
    )
    
    # Load training data
    train_data = pd.read_csv(os.path.join(args.train, 'train.csv'))
    
    # Train model
    metrics = forecaster.fit(train_data, args.model_dir)
    
    logger.info("ARIMA training completed successfully!")
    logger.info(f"Final metrics: {metrics}")
