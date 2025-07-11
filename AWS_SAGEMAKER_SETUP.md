# AWS SageMaker Setup for Product Analytics

This document provides comprehensive setup instructions and code for implementing machine learning models using Amazon SageMaker for demand forecasting and product analytics.

## Overview

The SageMaker integration includes:

1. **LSTM Deep Learning Model** - For time series demand forecasting
2. **ARIMA Seasonal Model** - For trend analysis and seasonal patterns
3. **Prophet Forecasting Model** - For business time series with holiday effects
4. **Product Classification Model** - For ABC analysis and inventory optimization
5. **Real-time Inference Endpoints** - For live predictions

## 1. LSTM Demand Forecasting Model

### Training Script

```python
# lstm_demand_forecasting.py
import argparse
import os
import json
import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib

def create_sequences(data, seq_length):
    """Create sequences for LSTM training"""
    X, y = [], []
    for i in range(seq_length, len(data)):
        X.append(data[i-seq_length:i])
        y.append(data[i])
    return np.array(X), np.array(y)

def build_lstm_model(seq_length, n_features=1):
    """Build LSTM model architecture"""
    model = Sequential([
        LSTM(50, return_sequences=True, input_shape=(seq_length, n_features)),
        Dropout(0.2),
        LSTM(50, return_sequences=True),
        Dropout(0.2),
        LSTM(50),
        Dropout(0.2),
        Dense(25),
        Dense(1)
    ])

    model.compile(optimizer=Adam(learning_rate=0.001),
                  loss='mean_squared_error',
                  metrics=['mae'])
    return model

def prepare_data(data_path, seq_length=30):
    """Prepare training data from transaction records"""

    # Load transaction data
    df = pd.read_csv(data_path)

    # Aggregate daily sales by product and store
    daily_sales = df.groupby(['product_id', 'store_id', pd.Grouper(key='created_at', freq='D')])['quantity'].sum().reset_index()

    # Prepare sequences for each product-store combination
    all_sequences_X = []
    all_sequences_y = []
    product_store_mapping = []

    for (product_id, store_id), group in daily_sales.groupby(['product_id', 'store_id']):
        if len(group) < seq_length + 10:  # Need minimum data
            continue

        # Fill missing dates with 0
        group = group.set_index('created_at').resample('D')['quantity'].sum().fillna(0)

        # Normalize data
        scaler = MinMaxScaler()
        scaled_data = scaler.fit_transform(group.values.reshape(-1, 1))

        # Create sequences
        X, y = create_sequences(scaled_data.flatten(), seq_length)

        if len(X) > 0:
            all_sequences_X.append(X)
            all_sequences_y.append(y)
            product_store_mapping.extend([(product_id, store_id)] * len(X))

    return (np.vstack(all_sequences_X),
            np.hstack(all_sequences_y),
            product_store_mapping)

def train_model(args):
    """Main training function"""

    # Load and prepare data
    X, y, mapping = prepare_data(args.data_path, args.seq_length)

    # Split data
    train_size = int(0.8 * len(X))
    X_train, X_test = X[:train_size], X[train_size:]
    y_train, y_test = y[:train_size], y[train_size:]

    # Reshape for LSTM
    X_train = X_train.reshape((X_train.shape[0], X_train.shape[1], 1))
    X_test = X_test.reshape((X_test.shape[0], X_test.shape[1], 1))

    # Build and train model
    model = build_lstm_model(args.seq_length)

    # Callbacks
    early_stopping = tf.keras.callbacks.EarlyStopping(
        monitor='val_loss', patience=10, restore_best_weights=True
    )

    reduce_lr = tf.keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss', factor=0.2, patience=5, min_lr=0.0001
    )

    # Train model
    history = model.fit(
        X_train, y_train,
        epochs=args.epochs,
        batch_size=args.batch_size,
        validation_data=(X_test, y_test),
        callbacks=[early_stopping, reduce_lr],
        verbose=1
    )

    # Evaluate model
    train_predictions = model.predict(X_train)
    test_predictions = model.predict(X_test)

    train_mae = mean_absolute_error(y_train, train_predictions)
    test_mae = mean_absolute_error(y_test, test_predictions)
    train_rmse = np.sqrt(mean_squared_error(y_train, train_predictions))
    test_rmse = np.sqrt(mean_squared_error(y_test, test_predictions))

    # Save model
    model.save(os.path.join(args.model_dir, 'lstm_demand_model.h5'))

    # Save scaler and metadata
    metadata = {
        'seq_length': args.seq_length,
        'train_mae': float(train_mae),
        'test_mae': float(test_mae),
        'train_rmse': float(train_rmse),
        'test_rmse': float(test_rmse),
        'model_type': 'lstm_demand_forecasting',
        'version': '1.0'
    }

    with open(os.path.join(args.model_dir, 'model_metadata.json'), 'w') as f:
        json.dump(metadata, f)

    print(f"Model training completed!")
    print(f"Train MAE: {train_mae:.4f}, Test MAE: {test_mae:.4f}")
    print(f"Train RMSE: {train_rmse:.4f}, Test RMSE: {test_rmse:.4f}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-path', type=str, default='/opt/ml/input/data/training/transactions.csv')
    parser.add_argument('--model-dir', type=str, default='/opt/ml/model')
    parser.add_argument('--seq-length', type=int, default=30)
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--batch-size', type=int, default=32)

    args = parser.parse_args()
    train_model(args)
```

### Inference Script

```python
# lstm_inference.py
import json
import numpy as np
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler
import os

class LSTMDemandPredictor:
    """LSTM model for demand prediction"""

    def __init__(self, model_dir):
        self.model_dir = model_dir
        self.model = None
        self.metadata = None
        self.load_model()

    def load_model(self):
        """Load trained model and metadata"""
        model_path = os.path.join(self.model_dir, 'lstm_demand_model.h5')
        metadata_path = os.path.join(self.model_dir, 'model_metadata.json')

        self.model = tf.keras.models.load_model(model_path)

        with open(metadata_path, 'r') as f:
            self.metadata = json.load(f)

    def predict(self, historical_data, forecast_days=30):
        """Generate demand forecast"""

        # Prepare input data
        scaler = MinMaxScaler()
        scaled_data = scaler.fit_transform(np.array(historical_data).reshape(-1, 1))

        seq_length = self.metadata['seq_length']

        # Take last sequence
        if len(scaled_data) < seq_length:
            # Pad with zeros if insufficient data
            padded_data = np.zeros(seq_length)
            padded_data[-len(scaled_data):] = scaled_data.flatten()
            last_sequence = padded_data
        else:
            last_sequence = scaled_data[-seq_length:].flatten()

        # Generate predictions
        predictions = []
        current_sequence = last_sequence.copy()

        for _ in range(forecast_days):
            # Reshape for model input
            model_input = current_sequence.reshape(1, seq_length, 1)

            # Predict next value
            next_pred = self.model.predict(model_input)[0][0]
            predictions.append(next_pred)

            # Update sequence for next prediction
            current_sequence = np.append(current_sequence[1:], next_pred)

        # Inverse transform predictions
        predictions_array = np.array(predictions).reshape(-1, 1)
        actual_predictions = scaler.inverse_transform(predictions_array).flatten()

        # Ensure non-negative predictions
        actual_predictions = np.maximum(actual_predictions, 0)

        return {
            'predictions': actual_predictions.tolist(),
            'confidence_lower': (actual_predictions * 0.8).tolist(),
            'confidence_upper': (actual_predictions * 1.2).tolist(),
            'model_accuracy': self.metadata.get('test_mae', 0.0),
            'forecast_horizon': forecast_days
        }

def model_fn(model_dir):
    """SageMaker model loading function"""
    return LSTMDemandPredictor(model_dir)

def input_fn(request_body, request_content_type):
    """Parse input data"""
    if request_content_type == 'application/json':
        input_data = json.loads(request_body)
        return input_data
    else:
        raise ValueError(f"Unsupported content type: {request_content_type}")

def predict_fn(input_data, model):
    """Generate predictions"""
    historical_data = input_data.get('historical_data', [])
    forecast_days = input_data.get('forecast_days', 30)

    return model.predict(historical_data, forecast_days)

def output_fn(prediction, content_type):
    """Format output"""
    if content_type == 'application/json':
        return json.dumps(prediction)
    else:
        raise ValueError(f"Unsupported content type: {content_type}")
```

## 2. ARIMA Seasonal Model

### Training Script

```python
# arima_seasonal_model.py
import argparse
import os
import json
import pandas as pd
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf
from statsmodels.tsa.stattools import adfuller
import pickle
import warnings
warnings.filterwarnings('ignore')

class ARIMASeasonalForecaster:
    """ARIMA model with seasonal decomposition"""

    def __init__(self):
        self.model = None
        self.seasonal_components = None
        self.order = (1, 1, 1)  # Default ARIMA order
        self.seasonal_order = (1, 1, 1, 7)  # Weekly seasonality

    def find_optimal_order(self, data, max_p=3, max_d=2, max_q=3):
        """Find optimal ARIMA order using AIC"""
        best_aic = float('inf')
        best_order = (1, 1, 1)

        for p in range(max_p + 1):
            for d in range(max_d + 1):
                for q in range(max_q + 1):
                    try:
                        model = ARIMA(data, order=(p, d, q))
                        fitted_model = model.fit()
                        if fitted_model.aic < best_aic:
                            best_aic = fitted_model.aic
                            best_order = (p, d, q)
                    except:
                        continue

        return best_order

    def decompose_series(self, data, period=7):
        """Perform seasonal decomposition"""
        if len(data) < 2 * period:
            return None

        try:
            decomposition = seasonal_decompose(
                data, model='additive', period=period, extrapolate_trend='freq'
            )
            return {
                'trend': decomposition.trend.dropna(),
                'seasonal': decomposition.seasonal.dropna(),
                'residual': decomposition.resid.dropna()
            }
        except:
            return None

    def fit(self, data):
        """Train ARIMA model"""

        # Ensure data is pandas Series
        if isinstance(data, list):
            data = pd.Series(data)

        # Remove any NaN values
        data = data.dropna()

        if len(data) < 30:  # Need minimum data
            raise ValueError("Insufficient data for ARIMA modeling")

        # Seasonal decomposition
        self.seasonal_components = self.decompose_series(data)

        # Find optimal order
        self.order = self.find_optimal_order(data)

        # Fit ARIMA model
        try:
            self.model = ARIMA(data, order=self.order)
            self.fitted_model = self.model.fit()
        except Exception as e:
            # Fallback to simple ARIMA(1,1,1)
            self.order = (1, 1, 1)
            self.model = ARIMA(data, order=self.order)
            self.fitted_model = self.model.fit()

    def forecast(self, steps=30):
        """Generate forecasts"""
        if self.fitted_model is None:
            raise ValueError("Model must be fitted before forecasting")

        # Generate forecasts
        forecast_result = self.fitted_model.forecast(steps=steps)
        conf_int = self.fitted_model.get_forecast(steps=steps).conf_int()

        # Apply seasonal pattern if available
        if self.seasonal_components is not None:
            seasonal_pattern = self.seasonal_components['seasonal']
            seasonal_length = len(seasonal_pattern)

            # Repeat seasonal pattern for forecast period
            seasonal_forecast = []
            for i in range(steps):
                seasonal_index = i % seasonal_length
                seasonal_forecast.append(seasonal_pattern.iloc[seasonal_index])

            # Add seasonal component to forecast
            forecast_result = forecast_result + np.array(seasonal_forecast)
            conf_int.iloc[:, 0] = conf_int.iloc[:, 0] + np.array(seasonal_forecast)
            conf_int.iloc[:, 1] = conf_int.iloc[:, 1] + np.array(seasonal_forecast)

        # Ensure non-negative forecasts
        forecast_result = np.maximum(forecast_result, 0)
        conf_int.iloc[:, 0] = np.maximum(conf_int.iloc[:, 0], 0)

        return {
            'forecast': forecast_result.tolist(),
            'lower_confidence': conf_int.iloc[:, 0].tolist(),
            'upper_confidence': conf_int.iloc[:, 1].tolist(),
            'model_order': self.order,
            'aic': self.fitted_model.aic
        }

def prepare_training_data(data_path):
    """Prepare data for ARIMA training"""
    df = pd.read_csv(data_path)

    # Aggregate daily sales
    df['created_at'] = pd.to_datetime(df['created_at'])
    daily_sales = df.groupby([
        'product_id', 'store_id', pd.Grouper(key='created_at', freq='D')
    ])['quantity'].sum().reset_index()

    return daily_sales

def train_arima_models(args):
    """Train ARIMA models for each product-store combination"""

    daily_sales = prepare_training_data(args.data_path)

    models = {}
    model_metadata = []

    for (product_id, store_id), group in daily_sales.groupby(['product_id', 'store_id']):
        if len(group) < 50:  # Need sufficient data
            continue

        print(f"Training ARIMA model for Product {product_id}, Store {store_id}")

        # Prepare time series
        ts_data = group.set_index('created_at')['quantity']
        ts_data = ts_data.asfreq('D', fill_value=0)  # Fill missing dates

        try:
            # Create and train model
            forecaster = ARIMASeasonalForecaster()
            forecaster.fit(ts_data)

            # Test forecast
            test_forecast = forecaster.forecast(steps=7)

            # Save model
            model_key = f"{product_id}_{store_id}"
            models[model_key] = forecaster

            model_metadata.append({
                'product_id': product_id,
                'store_id': store_id,
                'model_key': model_key,
                'arima_order': forecaster.order,
                'aic': forecaster.fitted_model.aic,
                'training_data_points': len(ts_data),
                'has_seasonal_component': forecaster.seasonal_components is not None
            })

        except Exception as e:
            print(f"Failed to train model for {product_id}-{store_id}: {str(e)}")
            continue

    # Save all models
    models_path = os.path.join(args.model_dir, 'arima_models.pkl')
    with open(models_path, 'wb') as f:
        pickle.dump(models, f)

    # Save metadata
    metadata_path = os.path.join(args.model_dir, 'arima_metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump({
            'models': model_metadata,
            'model_type': 'arima_seasonal',
            'version': '1.0',
            'total_models': len(models)
        }, f)

    print(f"Training completed. {len(models)} models saved.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-path', type=str, default='/opt/ml/input/data/training/transactions.csv')
    parser.add_argument('--model-dir', type=str, default='/opt/ml/model')

    args = parser.parse_args()
    train_arima_models(args)
```

## 3. Prophet Forecasting Model

### Training Script

```python
# prophet_forecasting.py
import argparse
import os
import json
import pandas as pd
import numpy as np
from prophet import Prophet
import pickle
import warnings
warnings.filterwarnings('ignore')

class ProphetDemandForecaster:
    """Prophet model for demand forecasting with holidays and events"""

    def __init__(self):
        self.model = None
        self.product_id = None
        self.store_id = None

    def create_holidays_df(self):
        """Create holidays dataframe for Prophet"""
        holidays = pd.DataFrame({
            'holiday': ['New Year', 'Valentine', 'Easter', 'Mother Day', 'Memorial Day',
                       'Independence Day', 'Labor Day', 'Halloween', 'Thanksgiving', 'Christmas'],
            'ds': pd.to_datetime(['2023-01-01', '2023-02-14', '2023-04-09', '2023-05-14', '2023-05-29',
                                '2023-07-04', '2023-09-04', '2023-10-31', '2023-11-23', '2023-12-25']),
            'lower_window': [-1, -1, -1, -1, -1, -1, -1, -1, -2, -2],
            'upper_window': [1, 1, 1, 1, 1, 1, 1, 1, 1, 2]
        })

        # Add Black Friday and Cyber Monday
        holidays = pd.concat([
            holidays,
            pd.DataFrame({
                'holiday': ['Black Friday', 'Cyber Monday'],
                'ds': pd.to_datetime(['2023-11-24', '2023-11-27']),
                'lower_window': [-1, 0],
                'upper_window': [1, 1]
            })
        ])

        return holidays

    def add_promotional_events(self, df):
        """Add promotional events as regressors"""
        # Simulate promotional events (in reality, this would come from your data)
        df['promotion'] = 0

        # Add some random promotional events
        promotional_dates = pd.date_range('2023-01-01', '2024-01-01', freq='MS')
        for date in promotional_dates:
            if np.random.random() > 0.7:  # 30% chance of promotion
                promo_start = date + pd.Timedelta(days=np.random.randint(0, 28))
                promo_end = promo_start + pd.Timedelta(days=np.random.randint(1, 7))
                df.loc[(df['ds'] >= promo_start) & (df['ds'] <= promo_end), 'promotion'] = 1

        return df

    def fit(self, data, product_id, store_id):
        """Train Prophet model"""
        self.product_id = product_id
        self.store_id = store_id

        # Prepare data for Prophet
        prophet_data = data.reset_index()
        prophet_data.columns = ['ds', 'y']

        # Add promotional events
        prophet_data = self.add_promotional_events(prophet_data)

        # Create holidays
        holidays = self.create_holidays_df()

        # Initialize Prophet model
        self.model = Prophet(
            holidays=holidays,
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10,
            holidays_prior_scale=10,
            interval_width=0.8
        )

        # Add promotional regressor
        self.model.add_regressor('promotion')

        # Fit model
        self.model.fit(prophet_data)

    def forecast(self, periods=30):
        """Generate forecasts"""
        if self.model is None:
            raise ValueError("Model must be fitted before forecasting")

        # Create future dataframe
        future = self.model.make_future_dataframe(periods=periods)

        # Add future promotional events (simplified - assume no future promotions)
        future['promotion'] = 0

        # Generate forecast
        forecast = self.model.predict(future)

        # Extract relevant columns
        forecast_values = forecast['yhat'].tail(periods).values
        lower_bound = forecast['yhat_lower'].tail(periods).values
        upper_bound = forecast['yhat_upper'].tail(periods).values

        # Ensure non-negative forecasts
        forecast_values = np.maximum(forecast_values, 0)
        lower_bound = np.maximum(lower_bound, 0)

        return {
            'forecast': forecast_values.tolist(),
            'lower_confidence': lower_bound.tolist(),
            'upper_confidence': upper_bound.tolist(),
            'trend': forecast['trend'].tail(periods).values.tolist(),
            'seasonal': forecast['seasonal'].tail(periods).values.tolist(),
            'holidays': forecast['holidays'].tail(periods).values.tolist()
        }

def prepare_prophet_data(data_path):
    """Prepare data for Prophet training"""
    df = pd.read_csv(data_path)

    # Aggregate daily sales
    df['created_at'] = pd.to_datetime(df['created_at'])
    daily_sales = df.groupby([
        'product_id', 'store_id', pd.Grouper(key='created_at', freq='D')
    ])['quantity'].sum().reset_index()

    return daily_sales

def train_prophet_models(args):
    """Train Prophet models for each product-store combination"""

    daily_sales = prepare_prophet_data(args.data_path)

    models = {}
    model_metadata = []

    for (product_id, store_id), group in daily_sales.groupby(['product_id', 'store_id']):
        if len(group) < 60:  # Need at least 2 months of data
            continue

        print(f"Training Prophet model for Product {product_id}, Store {store_id}")

        # Prepare time series
        ts_data = group.set_index('created_at')['quantity']
        ts_data = ts_data.asfreq('D', fill_value=0)  # Fill missing dates

        try:
            # Create and train model
            forecaster = ProphetDemandForecaster()
            forecaster.fit(ts_data, product_id, store_id)

            # Test forecast
            test_forecast = forecaster.forecast(periods=7)

            # Save model
            model_key = f"{product_id}_{store_id}"
            models[model_key] = forecaster

            model_metadata.append({
                'product_id': product_id,
                'store_id': store_id,
                'model_key': model_key,
                'training_data_points': len(ts_data),
                'has_yearly_seasonality': True,
                'has_weekly_seasonality': True,
                'includes_holidays': True
            })

        except Exception as e:
            print(f"Failed to train Prophet model for {product_id}-{store_id}: {str(e)}")
            continue

    # Save all models
    models_path = os.path.join(args.model_dir, 'prophet_models.pkl')
    with open(models_path, 'wb') as f:
        pickle.dump(models, f)

    # Save metadata
    metadata_path = os.path.join(args.model_dir, 'prophet_metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump({
            'models': model_metadata,
            'model_type': 'prophet_forecasting',
            'version': '1.0',
            'total_models': len(models)
        }, f)

    print(f"Prophet training completed. {len(models)} models saved.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-path', type=str, default='/opt/ml/input/data/training/transactions.csv')
    parser.add_argument('--model-dir', type=str, default='/opt/ml/model')

    args = parser.parse_args()
    train_prophet_models(args)
```

## 4. Product Classification Model (ABC Analysis)

### Training Script

```python
# product_classification.py
import argparse
import os
import json
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
import joblib

class ProductClassifier:
    """ML model for product ABC classification and inventory optimization"""

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.feature_names = None

    def create_features(self, df):
        """Create features for product classification"""

        # Aggregate product metrics
        features = df.groupby(['product_id', 'store_id']).agg({
            'quantity': ['sum', 'mean', 'std', 'count'],
            'total_amount': ['sum', 'mean', 'std'],
            'unit_price': ['mean', 'std']
        }).round(4)

        # Flatten column names
        features.columns = ['_'.join(col).strip() for col in features.columns]

        # Add additional derived features
        features['revenue_per_transaction'] = features['total_amount_sum'] / features['quantity_count']
        features['price_volatility'] = features['unit_price_std'] / features['unit_price_mean']
        features['demand_volatility'] = features['quantity_std'] / features['quantity_mean']
        features['total_transactions'] = features['quantity_count']

        # Handle infinite and NaN values
        features = features.replace([np.inf, -np.inf], 0).fillna(0)

        return features

    def create_abc_labels(self, features):
        """Create ABC classification labels based on revenue"""

        revenue = features['total_amount_sum']

        # Calculate percentiles for ABC classification
        a_threshold = revenue.quantile(0.8)  # Top 20% = A
        b_threshold = revenue.quantile(0.5)  # Next 30% = B, Bottom 50% = C

        labels = []
        for rev in revenue:
            if rev >= a_threshold:
                labels.append('A')
            elif rev >= b_threshold:
                labels.append('B')
            else:
                labels.append('C')

        return np.array(labels)

    def fit(self, training_data_path):
        """Train the classification model"""

        # Load transaction data
        df = pd.read_csv(training_data_path)

        # Create features
        features = self.create_features(df)

        # Create ABC labels
        labels = self.create_abc_labels(features)

        # Store feature names
        self.feature_names = features.columns.tolist()

        # Prepare training data
        X = features.values
        y = labels

        # Encode labels
        y_encoded = self.label_encoder.fit_transform(y)

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
        )

        # Train Random Forest model
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42
        )

        self.model.fit(X_train, y_train)

        # Evaluate model
        train_accuracy = accuracy_score(y_train, self.model.predict(X_train))
        test_accuracy = accuracy_score(y_test, self.model.predict(X_test))

        # Feature importance
        feature_importance = dict(zip(
            self.feature_names,
            self.model.feature_importances_
        ))

        return {
            'train_accuracy': train_accuracy,
            'test_accuracy': test_accuracy,
            'feature_importance': feature_importance,
            'class_distribution': dict(zip(*np.unique(y, return_counts=True)))
        }

    def predict(self, product_features):
        """Predict ABC classification for products"""
        if self.model is None:
            raise ValueError("Model must be trained before prediction")

        # Ensure features are in correct order
        if isinstance(product_features, dict):
            feature_values = [product_features.get(name, 0) for name in self.feature_names]
        else:
            feature_values = product_features

        # Scale features
        X_scaled = self.scaler.transform([feature_values])

        # Predict
        prediction = self.model.predict(X_scaled)[0]
        probabilities = self.model.predict_proba(X_scaled)[0]

        # Decode prediction
        abc_class = self.label_encoder.inverse_transform([prediction])[0]

        # Create probability dictionary
        class_probabilities = dict(zip(
            self.label_encoder.classes_,
            probabilities
        ))

        return {
            'abc_classification': abc_class,
            'confidence': float(max(probabilities)),
            'class_probabilities': {k: float(v) for k, v in class_probabilities.items()}
        }

def train_classification_model(args):
    """Main training function"""

    # Create classifier
    classifier = ProductClassifier()

    # Train model
    print("Training product classification model...")
    results = classifier.fit(args.data_path)

    print(f"Training completed!")
    print(f"Train Accuracy: {results['train_accuracy']:.4f}")
    print(f"Test Accuracy: {results['test_accuracy']:.4f}")
    print(f"Class Distribution: {results['class_distribution']}")

    # Save model components
    model_path = os.path.join(args.model_dir, 'product_classifier.pkl')
    scaler_path = os.path.join(args.model_dir, 'feature_scaler.pkl')
    encoder_path = os.path.join(args.model_dir, 'label_encoder.pkl')

    joblib.dump(classifier.model, model_path)
    joblib.dump(classifier.scaler, scaler_path)
    joblib.dump(classifier.label_encoder, encoder_path)

    # Save metadata
    metadata = {
        'model_type': 'product_abc_classification',
        'version': '1.0',
        'feature_names': classifier.feature_names,
        'train_accuracy': results['train_accuracy'],
        'test_accuracy': results['test_accuracy'],
        'feature_importance': results['feature_importance'],
        'class_distribution': results['class_distribution']
    }

    metadata_path = os.path.join(args.model_dir, 'classification_metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-path', type=str, default='/opt/ml/input/data/training/transactions.csv')
    parser.add_argument('--model-dir', type=str, default='/opt/ml/model')

    args = parser.parse_args()
    train_classification_model(args)
```

## 5. SageMaker Training Jobs Configuration

### CloudFormation Template

```yaml
# sagemaker-training-stack.yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: "SageMaker Training Infrastructure for Product Analytics"

Parameters:
  RoleArn:
    Type: String
    Description: SageMaker execution role ARN

  S3BucketName:
    Type: String
    Description: S3 bucket for training data and models

Resources:
  # LSTM Training Job
  LSTMTrainingJob:
    Type: AWS::SageMaker::TrainingJob
    Properties:
      TrainingJobName: !Sub "lstm-demand-forecasting-${AWS::StackName}"
      RoleArn: !Ref RoleArn
      AlgorithmSpecification:
        TrainingInputMode: File
        TrainingImage: 763104351884.dkr.ecr.us-east-1.amazonaws.com/tensorflow-training:2.8-gpu-py39-cu112-ubuntu20.04-sagemaker
      InputDataConfig:
        - ChannelName: training
          DataSource:
            S3DataSource:
              S3DataType: S3Prefix
              S3Uri: !Sub "s3://${S3BucketName}/training-data/"
              S3DataDistributionType: FullyReplicated
          ContentType: text/csv
          CompressionType: None
          RecordWrapperType: None
      OutputDataConfig:
        S3OutputPath: !Sub "s3://${S3BucketName}/models/lstm/"
      ResourceConfig:
        InstanceType: ml.p3.2xlarge
        InstanceCount: 1
        VolumeSizeInGB: 30
      StoppingCondition:
        MaxRuntimeInSeconds: 86400
      HyperParameters:
        epochs: "100"
        batch-size: "32"
        seq-length: "30"

  # ARIMA Training Job
  ARIMATrainingJob:
    Type: AWS::SageMaker::TrainingJob
    Properties:
      TrainingJobName: !Sub "arima-seasonal-${AWS::StackName}"
      RoleArn: !Ref RoleArn
      AlgorithmSpecification:
        TrainingInputMode: File
        TrainingImage: 683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:0.23-1-cpu-py3
      InputDataConfig:
        - ChannelName: training
          DataSource:
            S3DataSource:
              S3DataType: S3Prefix
              S3Uri: !Sub "s3://${S3BucketName}/training-data/"
              S3DataDistributionType: FullyReplicated
          ContentType: text/csv
      OutputDataConfig:
        S3OutputPath: !Sub "s3://${S3BucketName}/models/arima/"
      ResourceConfig:
        InstanceType: ml.m5.xlarge
        InstanceCount: 1
        VolumeSizeInGB: 20
      StoppingCondition:
        MaxRuntimeInSeconds: 3600

  # Prophet Training Job
  ProphetTrainingJob:
    Type: AWS::SageMaker::TrainingJob
    Properties:
      TrainingJobName: !Sub "prophet-forecasting-${AWS::StackName}"
      RoleArn: !Ref RoleArn
      AlgorithmSpecification:
        TrainingInputMode: File
        TrainingImage: 683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:0.23-1-cpu-py3
      InputDataConfig:
        - ChannelName: training
          DataSource:
            S3DataSource:
              S3DataType: S3Prefix
              S3Uri: !Sub "s3://${S3BucketName}/training-data/"
      OutputDataConfig:
        S3OutputPath: !Sub "s3://${S3BucketName}/models/prophet/"
      ResourceConfig:
        InstanceType: ml.m5.xlarge
        InstanceCount: 1
        VolumeSizeInGB: 20
      StoppingCondition:
        MaxRuntimeInSeconds: 3600

Outputs:
  LSTMTrainingJobName:
    Value: !Ref LSTMTrainingJob

  ARIMATrainingJobName:
    Value: !Ref ARIMATrainingJob

  ProphetTrainingJobName:
    Value: !Ref ProphetTrainingJob
```

## 6. Real-time Inference Endpoints

### Deployment Script

```python
# deploy_endpoints.py
import boto3
import json
from datetime import datetime

class SageMakerDeployment:
    """Deploy SageMaker models to real-time endpoints"""

    def __init__(self, region='us-east-1'):
        self.sagemaker = boto3.client('sagemaker', region_name=region)
        self.region = region

    def create_model(self, model_name, model_data_url, image_uri, role_arn):
        """Create SageMaker model"""

        try:
            response = self.sagemaker.create_model(
                ModelName=model_name,
                PrimaryContainer={
                    'Image': image_uri,
                    'ModelDataUrl': model_data_url
                },
                ExecutionRoleArn=role_arn
            )
            print(f"Model {model_name} created successfully")
            return response
        except Exception as e:
            print(f"Error creating model {model_name}: {str(e)}")
            return None

    def create_endpoint_config(self, config_name, model_name, instance_type='ml.m5.large'):
        """Create endpoint configuration"""

        try:
            response = self.sagemaker.create_endpoint_config(
                EndpointConfigName=config_name,
                ProductionVariants=[
                    {
                        'VariantName': 'AllTraffic',
                        'ModelName': model_name,
                        'InitialInstanceCount': 1,
                        'InstanceType': instance_type,
                        'InitialVariantWeight': 1
                    }
                ]
            )
            print(f"Endpoint config {config_name} created successfully")
            return response
        except Exception as e:
            print(f"Error creating endpoint config {config_name}: {str(e)}")
            return None

    def create_endpoint(self, endpoint_name, config_name):
        """Create real-time endpoint"""

        try:
            response = self.sagemaker.create_endpoint(
                EndpointName=endpoint_name,
                EndpointConfigName=config_name
            )
            print(f"Endpoint {endpoint_name} creation started")
            return response
        except Exception as e:
            print(f"Error creating endpoint {endpoint_name}: {str(e)}")
            return None

    def deploy_all_models(self, models_config, role_arn):
        """Deploy all analytics models"""

        deployed_endpoints = []

        for model_config in models_config:
            model_name = model_config['model_name']
            endpoint_name = model_config['endpoint_name']

            # Create model
            model_response = self.create_model(
                model_name=model_name,
                model_data_url=model_config['model_data_url'],
                image_uri=model_config['image_uri'],
                role_arn=role_arn
            )

            if model_response:
                # Create endpoint config
                config_name = f"{model_name}-config"
                config_response = self.create_endpoint_config(
                    config_name=config_name,
                    model_name=model_name,
                    instance_type=model_config.get('instance_type', 'ml.m5.large')
                )

                if config_response:
                    # Create endpoint
                    endpoint_response = self.create_endpoint(
                        endpoint_name=endpoint_name,
                        config_name=config_name
                    )

                    if endpoint_response:
                        deployed_endpoints.append({
                            'model_name': model_name,
                            'endpoint_name': endpoint_name,
                            'endpoint_arn': endpoint_response['EndpointArn']
                        })

        return deployed_endpoints

# Deployment configuration
def get_deployment_config():
    """Get deployment configuration for all models"""

    timestamp = datetime.now().strftime("%Y%m%d%H%M")

    return [
        {
            'model_name': f'lstm-demand-model-{timestamp}',
            'endpoint_name': f'lstm-demand-forecasting-{timestamp}',
            'model_data_url': 's3://your-bucket/models/lstm/model.tar.gz',
            'image_uri': '763104351884.dkr.ecr.us-east-1.amazonaws.com/tensorflow-inference:2.8-cpu',
            'instance_type': 'ml.m5.large'
        },
        {
            'model_name': f'arima-seasonal-model-{timestamp}',
            'endpoint_name': f'arima-seasonal-forecasting-{timestamp}',
            'model_data_url': 's3://your-bucket/models/arima/model.tar.gz',
            'image_uri': '683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:0.23-1-cpu-py3',
            'instance_type': 'ml.t2.medium'
        },
        {
            'model_name': f'prophet-forecasting-model-{timestamp}',
            'endpoint_name': f'prophet-forecasting-{timestamp}',
            'model_data_url': 's3://your-bucket/models/prophet/model.tar.gz',
            'image_uri': '683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:0.23-1-cpu-py3',
            'instance_type': 'ml.t2.medium'
        },
        {
            'model_name': f'product-classifier-model-{timestamp}',
            'endpoint_name': f'product-abc-classification-{timestamp}',
            'model_data_url': 's3://your-bucket/models/classification/model.tar.gz',
            'image_uri': '683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:0.23-1-cpu-py3',
            'instance_type': 'ml.t2.medium'
        }
    ]

if __name__ == '__main__':
    # Initialize deployment
    deployer = SageMakerDeployment()

    # Get configuration
    models_config = get_deployment_config()

    # Replace with your actual execution role ARN
    role_arn = "arn:aws:iam::YOUR_ACCOUNT:role/SageMakerExecutionRole"

    # Deploy all models
    deployed_endpoints = deployer.deploy_all_models(models_config, role_arn)

    print("\nDeployment Summary:")
    for endpoint in deployed_endpoints:
        print(f"- {endpoint['model_name']}: {endpoint['endpoint_name']}")
```

## 7. Integration with Lambda Functions

### SageMaker Inference Lambda

```python
# sagemaker_inference_lambda.py
import json
import boto3
import os

def lambda_handler(event, context):
    """Lambda function to invoke SageMaker endpoints"""

    sagemaker_runtime = boto3.client('sagemaker-runtime')

    try:
        model_type = event.get('model_type')
        endpoint_name = get_endpoint_name(model_type)

        if not endpoint_name:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': f'Invalid model type: {model_type}'})
            }

        # Prepare input data
        input_data = prepare_model_input(event, model_type)

        # Invoke endpoint
        response = sagemaker_runtime.invoke_endpoint(
            EndpointName=endpoint_name,
            ContentType='application/json',
            Body=json.dumps(input_data)
        )

        # Parse response
        result = json.loads(response['Body'].read().decode())

        return {
            'statusCode': 200,
            'body': json.dumps({
                'model_type': model_type,
                'endpoint_name': endpoint_name,
                'prediction': result,
                'timestamp': context.aws_request_id
            })
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Prediction failed',
                'message': str(e)
            })
        }

def get_endpoint_name(model_type):
    """Get endpoint name for model type"""
    endpoints = {
        'lstm': os.environ.get('LSTM_ENDPOINT_NAME'),
        'arima': os.environ.get('ARIMA_ENDPOINT_NAME'),
        'prophet': os.environ.get('PROPHET_ENDPOINT_NAME'),
        'classification': os.environ.get('CLASSIFICATION_ENDPOINT_NAME')
    }
    return endpoints.get(model_type)

def prepare_model_input(event, model_type):
    """Prepare input data for specific model types"""

    if model_type == 'lstm':
        return {
            'historical_data': event.get('historical_data', []),
            'forecast_days': event.get('forecast_days', 30)
        }

    elif model_type == 'arima':
        return {
            'time_series': event.get('time_series', []),
            'forecast_periods': event.get('forecast_periods', 30)
        }

    elif model_type == 'prophet':
        return {
            'historical_data': event.get('historical_data', []),
            'forecast_periods': event.get('forecast_periods', 30),
            'include_holidays': event.get('include_holidays', True)
        }

    elif model_type == 'classification':
        return {
            'features': event.get('features', {})
        }

    else:
        raise ValueError(f"Unsupported model type: {model_type}")
```

## Summary

This comprehensive SageMaker setup provides:

1. **LSTM Deep Learning Model** for complex time series forecasting
2. **ARIMA Seasonal Model** for trend and seasonality analysis
3. **Prophet Model** for business forecasting with holidays
4. **Product Classification** for ABC analysis
5. **Real-time Inference Endpoints** for live predictions
6. **Lambda Integration** for seamless API access

The models can be trained on your transaction data and deployed to provide advanced analytics capabilities for inventory management and demand forecasting.

To deploy this system:

1. Prepare your training data in S3
2. Run the training jobs using SageMaker
3. Deploy models to real-time endpoints
4. Configure Lambda functions with endpoint names
5. Integrate with your frontend through API calls

This creates a complete ML-powered analytics system for product management.
