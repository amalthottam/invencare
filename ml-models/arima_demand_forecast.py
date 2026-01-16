"""
ARIMA Demand Forecasting Model for Amazon SageMaker
This model predicts product demand using Auto-Regressive Integrated Moving Average
"""

import numpy as np
import pandas as pd
import json
import pickle
import boto3
from datetime import datetime, timedelta
import warnings
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import adfuller, acf, pacf
from statsmodels.stats.diagnostic import acorr_ljungbox
from sklearn.metrics import mean_absolute_error, mean_squared_error
import logging
import os

warnings.filterwarnings('ignore')
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ARIMADemandForecaster:
    def __init__(self, seasonal_periods=7, auto_arima=True):
        """
        Initialize ARIMA Demand Forecaster
        
        Args:
            seasonal_periods (int): Number of periods in a season (7 for weekly)
            auto_arima (bool): Whether to use auto ARIMA for parameter selection
        """
        self.seasonal_periods = seasonal_periods
        self.auto_arima = auto_arima
        self.model = None
        self.fitted_model = None
        self.order = None
        self.seasonal_order = None
        self.is_trained = False
        self.residuals = None
        self.original_data = None
        
    def check_stationarity(self, timeseries, significance_level=0.05):
        """
        Check if time series is stationary using Augmented Dickey-Fuller test
        
        Args:
            timeseries (pd.Series): Time series data
            significance_level (float): Significance level for the test
            
        Returns:
            dict: Stationarity test results
        """
        result = adfuller(timeseries.dropna())
        
        return {
            'adf_statistic': result[0],
            'p_value': result[1],
            'critical_values': result[4],
            'is_stationary': result[1] <= significance_level
        }
    
    def difference_series(self, timeseries, max_diff=2):
        """
        Apply differencing to make series stationary
        
        Args:
            timeseries (pd.Series): Time series data
            max_diff (int): Maximum number of differencing operations
            
        Returns:
            tuple: (differenced_series, number_of_differences)
        """
        differenced = timeseries.copy()
        diff_count = 0
        
        for d in range(max_diff + 1):
            stationarity = self.check_stationarity(differenced)
            
            if stationarity['is_stationary']:
                logger.info(f"Series is stationary after {d} differences")
                return differenced, d
            
            if d < max_diff:
                differenced = differenced.diff().dropna()
                diff_count = d + 1
        
        logger.warning(f"Series may not be stationary after {max_diff} differences")
        return differenced, diff_count
    
    def find_best_arima_order(self, timeseries, max_p=5, max_d=2, max_q=5):
        """
        Find best ARIMA order using grid search with AIC criterion
        
        Args:
            timeseries (pd.Series): Time series data
            max_p (int): Maximum AR order
            max_d (int): Maximum differencing order
            max_q (int): Maximum MA order
            
        Returns:
            tuple: Best (p, d, q) order
        """
        best_aic = np.inf
        best_order = None
        
        logger.info("Searching for best ARIMA parameters...")
        
        for p in range(max_p + 1):
            for d in range(max_d + 1):
                for q in range(max_q + 1):
                    try:
                        model = ARIMA(timeseries, order=(p, d, q))
                        fitted = model.fit()
                        
                        if fitted.aic < best_aic:
                            best_aic = fitted.aic
                            best_order = (p, d, q)
                            
                    except Exception:
                        continue
        
        logger.info(f"Best ARIMA order: {best_order} with AIC: {best_aic:.2f}")
        return best_order
    
    def find_seasonal_order(self, timeseries, seasonal_periods, max_P=2, max_D=1, max_Q=2):
        """
        Find best seasonal ARIMA order
        
        Args:
            timeseries (pd.Series): Time series data
            seasonal_periods (int): Number of seasonal periods
            max_P (int): Maximum seasonal AR order
            max_D (int): Maximum seasonal differencing order
            max_Q (int): Maximum seasonal MA order
            
        Returns:
            tuple: Best seasonal (P, D, Q, s) order
        """
        if len(timeseries) < 2 * seasonal_periods:
            logger.warning("Not enough data for seasonal modeling")
            return (0, 0, 0, seasonal_periods)
        
        best_aic = np.inf
        best_seasonal_order = None
        
        logger.info("Searching for best seasonal ARIMA parameters...")
        
        for P in range(max_P + 1):
            for D in range(max_D + 1):
                for Q in range(max_Q + 1):
                    try:
                        # Use simple ARIMA order for now
                        order = (1, 1, 1) if self.order is None else self.order
                        seasonal_order = (P, D, Q, seasonal_periods)
                        
                        model = ARIMA(timeseries, order=order, seasonal_order=seasonal_order)
                        fitted = model.fit()
                        
                        if fitted.aic < best_aic:
                            best_aic = fitted.aic
                            best_seasonal_order = seasonal_order
                            
                    except Exception:
                        continue
        
        if best_seasonal_order is None:
            best_seasonal_order = (0, 0, 0, seasonal_periods)
            
        logger.info(f"Best seasonal order: {best_seasonal_order} with AIC: {best_aic:.2f}")
        return best_seasonal_order
    
    def prepare_data(self, df, target_col='units_sold', date_col='date'):
        """
        Prepare time series data for ARIMA modeling
        
        Args:
            df (pd.DataFrame): Input dataframe
            target_col (str): Target column name
            date_col (str): Date column name
            
        Returns:
            pd.Series: Prepared time series
        """
        # Convert to datetime and sort
        df = df.copy()
        df[date_col] = pd.to_datetime(df[date_col])
        df = df.sort_values(date_col)
        
        # Set date as index
        df.set_index(date_col, inplace=True)
        
        # Handle missing values
        if df[target_col].isnull().any():
            logger.warning("Missing values detected, forward filling...")
            df[target_col] = df[target_col].fillna(method='ffill').fillna(method='bfill')
        
        # Ensure positive values (add small constant if needed)
        if (df[target_col] <= 0).any():
            logger.warning("Non-positive values detected, adding constant...")
            df[target_col] = df[target_col] + 1
        
        return df[target_col]
    
    def train(self, df, target_col='units_sold', date_col='date'):
        """
        Train ARIMA model
        
        Args:
            df (pd.DataFrame): Training data
            target_col (str): Target column name
            date_col (str): Date column name
            
        Returns:
            dict: Training results and diagnostics
        """
        logger.info("Preparing data for ARIMA training...")
        
        # Prepare time series
        ts = self.prepare_data(df, target_col, date_col)
        self.original_data = ts.copy()
        
        if len(ts) < 10:
            raise ValueError("Not enough data points for ARIMA modeling (minimum 10 required)")
        
        logger.info(f"Training ARIMA on {len(ts)} data points")
        
        # Check stationarity and apply differencing if needed
        stationarity = self.check_stationarity(ts)
        logger.info(f"Initial stationarity test: p-value = {stationarity['p_value']:.4f}")
        
        # Find best parameters
        if self.auto_arima:
            self.order = self.find_best_arima_order(ts)
            
            # Find seasonal order if we have enough data
            if len(ts) >= 2 * self.seasonal_periods:
                self.seasonal_order = self.find_seasonal_order(ts, self.seasonal_periods)
            else:
                self.seasonal_order = (0, 0, 0, self.seasonal_periods)
        else:
            # Use default parameters
            self.order = (1, 1, 1)
            self.seasonal_order = (1, 1, 1, self.seasonal_periods) if len(ts) >= 2 * self.seasonal_periods else (0, 0, 0, self.seasonal_periods)
        
        # Fit the model
        logger.info(f"Fitting ARIMA{self.order} x {self.seasonal_order} model...")
        
        try:
            self.model = ARIMA(ts, order=self.order, seasonal_order=self.seasonal_order)
            self.fitted_model = self.model.fit()
            self.is_trained = True
            
            # Store residuals for diagnostics
            self.residuals = self.fitted_model.resid
            
            logger.info("ARIMA model trained successfully")
            logger.info(f"AIC: {self.fitted_model.aic:.2f}")
            logger.info(f"BIC: {self.fitted_model.bic:.2f}")
            
            # Model diagnostics
            diagnostics = self.run_diagnostics()
            
            return {
                'order': self.order,
                'seasonal_order': self.seasonal_order,
                'aic': self.fitted_model.aic,
                'bic': self.fitted_model.bic,
                'diagnostics': diagnostics
            }
            
        except Exception as e:
            logger.error(f"Error fitting ARIMA model: {str(e)}")
            # Try simpler model
            logger.info("Trying simpler ARIMA(1,1,1) model...")
            
            self.order = (1, 1, 1)
            self.seasonal_order = (0, 0, 0, self.seasonal_periods)
            
            self.model = ARIMA(ts, order=self.order, seasonal_order=self.seasonal_order)
            self.fitted_model = self.model.fit()
            self.is_trained = True
            self.residuals = self.fitted_model.resid
            
            diagnostics = self.run_diagnostics()
            
            return {
                'order': self.order,
                'seasonal_order': self.seasonal_order,
                'aic': self.fitted_model.aic,
                'bic': self.fitted_model.bic,
                'diagnostics': diagnostics
            }
    
    def run_diagnostics(self):
        """
        Run model diagnostics
        
        Returns:
            dict: Diagnostic results
        """
        if not self.is_trained or self.residuals is None:
            return {}
        
        try:
            # Ljung-Box test for residual autocorrelation
            lb_stat, lb_p_value = acorr_ljungbox(self.residuals, lags=10, return_df=False)
            
            # Residual statistics
            residual_mean = np.mean(self.residuals)
            residual_std = np.std(self.residuals)
            
            return {
                'ljung_box_statistic': float(lb_stat[-1]) if hasattr(lb_stat, '__len__') else float(lb_stat),
                'ljung_box_p_value': float(lb_p_value[-1]) if hasattr(lb_p_value, '__len__') else float(lb_p_value),
                'residual_mean': float(residual_mean),
                'residual_std': float(residual_std),
                'residuals_normal': abs(residual_mean) < 0.1  # Simple normality check
            }
        except Exception as e:
            logger.warning(f"Error running diagnostics: {str(e)}")
            return {}
    
    def predict(self, steps_ahead=14, alpha=0.05):
        """
        Generate forecasts with confidence intervals
        
        Args:
            steps_ahead (int): Number of steps to forecast ahead
            alpha (float): Significance level for confidence intervals
            
        Returns:
            dict: Predictions with confidence intervals
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")
        
        try:
            # Generate forecast
            forecast_result = self.fitted_model.forecast(steps=steps_ahead, alpha=alpha)
            forecast = forecast_result
            
            # Get confidence intervals
            conf_int = self.fitted_model.get_forecast(steps=steps_ahead, alpha=alpha).conf_int()
            
            # Generate forecast dates
            last_date = self.original_data.index[-1]
            forecast_dates = [last_date + timedelta(days=i+1) for i in range(steps_ahead)]
            
            # Ensure non-negative predictions
            forecast = np.maximum(forecast, 0)
            lower_bound = np.maximum(conf_int.iloc[:, 0].values, 0)
            upper_bound = np.maximum(conf_int.iloc[:, 1].values, 0)
            
            return {
                'dates': [date.strftime('%Y-%m-%d') for date in forecast_dates],
                'predictions': forecast.tolist(),
                'confidence_lower': lower_bound.tolist(),
                'confidence_upper': upper_bound.tolist(),
                'confidence_level': 1 - alpha
            }
            
        except Exception as e:
            logger.error(f"Error generating predictions: {str(e)}")
            
            # Fallback: simple moving average
            logger.info("Using fallback prediction method...")
            last_values = self.original_data.tail(7).mean()
            predictions = [last_values] * steps_ahead
            
            # Simple confidence intervals
            std_dev = self.original_data.tail(30).std()
            lower_bound = [max(0, p - 1.96 * std_dev) for p in predictions]
            upper_bound = [p + 1.96 * std_dev for p in predictions]
            
            last_date = self.original_data.index[-1]
            forecast_dates = [last_date + timedelta(days=i+1) for i in range(steps_ahead)]
            
            return {
                'dates': [date.strftime('%Y-%m-%d') for date in forecast_dates],
                'predictions': predictions,
                'confidence_lower': lower_bound,
                'confidence_upper': upper_bound,
                'confidence_level': 0.95,
                'fallback': True
            }
    
    def evaluate(self, test_df, target_col='units_sold', date_col='date'):
        """
        Evaluate model performance on test data
        
        Args:
            test_df (pd.DataFrame): Test data
            target_col (str): Target column name
            date_col (str): Date column name
            
        Returns:
            dict: Evaluation metrics
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before evaluation")
        
        # Prepare test data
        test_ts = self.prepare_data(test_df, target_col, date_col)
        
        # Generate predictions for test period
        steps_ahead = len(test_ts)
        predictions = self.predict(steps_ahead)
        
        # Calculate metrics
        actual = test_ts.values
        predicted = np.array(predictions['predictions'][:len(actual)])
        
        mae = mean_absolute_error(actual, predicted)
        rmse = np.sqrt(mean_squared_error(actual, predicted))
        mape = np.mean(np.abs((actual - predicted) / actual)) * 100
        
        return {
            'mae': float(mae),
            'rmse': float(rmse),
            'mape': float(mape),
            'samples': len(actual)
        }
    
    def save_model(self, model_dir):
        """
        Save model for deployment
        
        Args:
            model_dir (str): Directory to save model artifacts
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before saving")
        
        os.makedirs(model_dir, exist_ok=True)
        
        # Save fitted model
        with open(os.path.join(model_dir, 'arima_model.pkl'), 'wb') as f:
            pickle.dump(self.fitted_model, f)
        
        # Save model configuration
        config = {
            'order': self.order,
            'seasonal_order': self.seasonal_order,
            'seasonal_periods': self.seasonal_periods,
            'model_type': 'ARIMA',
            'model_version': '1.0',
            'created_at': datetime.now().isoformat()
        }
        
        with open(os.path.join(model_dir, 'model_config.json'), 'w') as f:
            json.dump(config, f, indent=2)
        
        # Save original data index for forecasting
        if self.original_data is not None:
            original_data_info = {
                'last_date': self.original_data.index[-1].isoformat(),
                'frequency': str(self.original_data.index.freq) if self.original_data.index.freq else 'D',
                'data_length': len(self.original_data)
            }
            
            with open(os.path.join(model_dir, 'data_info.json'), 'w') as f:
                json.dump(original_data_info, f, indent=2)
        
        logger.info(f"ARIMA model saved to {model_dir}")
    
    def load_model(self, model_dir):
        """
        Load trained model
        
        Args:
            model_dir (str): Directory containing model artifacts
        """
        # Load fitted model
        with open(os.path.join(model_dir, 'arima_model.pkl'), 'rb') as f:
            self.fitted_model = pickle.load(f)
        
        # Load configuration
        with open(os.path.join(model_dir, 'model_config.json'), 'r') as f:
            config = json.load(f)
            self.order = tuple(config['order'])
            self.seasonal_order = tuple(config['seasonal_order'])
            self.seasonal_periods = config['seasonal_periods']
        
        # Load data info if available
        data_info_path = os.path.join(model_dir, 'data_info.json')
        if os.path.exists(data_info_path):
            with open(data_info_path, 'r') as f:
                data_info = json.load(f)
                # Create dummy index for forecasting
                last_date = pd.to_datetime(data_info['last_date'])
                self.original_data = pd.Series(
                    index=pd.date_range(end=last_date, periods=1, freq='D'),
                    data=[0]
                )
        
        self.is_trained = True
        logger.info(f"ARIMA model loaded from {model_dir}")

# SageMaker inference functions
def model_fn(model_dir):
    """
    Load model for SageMaker inference
    """
    forecaster = ARIMADemandForecaster()
    forecaster.load_model(model_dir)
    return forecaster

def input_fn(request_body, content_type='application/json'):
    """
    Parse input data for SageMaker inference
    """
    if content_type == 'application/json':
        input_data = json.loads(request_body)
        return {
            'steps_ahead': input_data.get('steps_ahead', 14),
            'alpha': input_data.get('alpha', 0.05)
        }
    else:
        raise ValueError(f"Unsupported content type: {content_type}")

def predict_fn(input_data, model):
    """
    Generate predictions for SageMaker inference
    """
    try:
        predictions = model.predict(
            steps_ahead=input_data['steps_ahead'],
            alpha=input_data['alpha']
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
    parser.add_argument('--seasonal-periods', type=int, default=7)
    parser.add_argument('--auto-arima', type=bool, default=True)
    
    args = parser.parse_args()
    
    # Load training data
    train_file = os.path.join(args.train, 'train.csv')
    df = pd.read_csv(train_file)
    
    # Initialize and train model
    forecaster = ARIMADemandForecaster(
        seasonal_periods=args.seasonal_periods,
        auto_arima=args.auto_arima
    )
    
    # Train model
    results = forecaster.train(df)
    
    # Save model
    forecaster.save_model(args.model_dir)
    
    # Save training results
    with open(os.path.join(args.model_dir, 'training_results.json'), 'w') as f:
        json.dump(results, f, indent=2)
    
    logger.info("ARIMA training completed and model saved successfully")
