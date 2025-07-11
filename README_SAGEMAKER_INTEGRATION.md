# SageMaker Database Integration for InvenCare Forecasting

This directory contains Python scripts for integrating AWS SageMaker with the InvenCare RDS database for demand forecasting and inventory optimization.

## Files Overview

- `sagemaker_database_updater.py` - Main script for updating database with SageMaker predictions
- `sagemaker_lambda_handler.py` - AWS Lambda handler for automated updates
- `database_schema_validator.py` - Validates and creates required database tables
- `requirements.txt` - Python dependencies

## Database Tables for Forecasting

The following tables are used for the AI forecasting functionality:

### Core Tables

1. **demand_forecasting_models** - ML model metadata and performance
2. **demand_predictions** - Daily demand predictions from SageMaker
3. **seasonal_trends** - Seasonal pattern analysis
4. **optimization_recommendations** - AI-generated inventory recommendations
5. **model_performance_metrics** - Model evaluation metrics

### Key Columns to Update

#### demand_predictions

- `product_id` - Product identifier
- `store_id` - Store identifier
- `model_id` - ML model used for prediction
- `prediction_date` - Date of predicted demand
- `predicted_demand` - Forecasted demand quantity
- `confidence_interval_lower/upper` - Prediction confidence bounds
- `factors` - JSON object with contributing factors (seasonality, trends, etc.)

#### demand_forecasting_models

- `model_name` - SageMaker model name
- `model_type` - Model algorithm (arima, lstm, prophet, linear_regression)
- `sagemaker_endpoint` - SageMaker endpoint ARN
- `model_accuracy` - Model accuracy score (0.0 to 1.0)
- `training_status` - Current model status (training, deployed, failed)

#### optimization_recommendations

- `recommendation_type` - Type (reorder, transfer, markdown, promotion)
- `priority` - Urgency level (high, medium, low)
- `recommended_action` - Specific action to take
- `impact_score` - Expected business impact (0.0 to 1.0)
- `estimated_benefit` - Financial benefit estimate

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Environment Variables

```bash
export RDS_HOSTNAME="your-rds-endpoint.amazonaws.com"
export RDS_USERNAME="admin"
export RDS_PASSWORD="your-password"
export RDS_DB_NAME="invencare"
export RDS_PORT="3306"
export AWS_REGION="us-east-1"
```

### 3. Validate Database Schema

```bash
# Check current schema
python database_schema_validator.py

# Create missing tables
python database_schema_validator.py --create-missing
```

### 4. Run Database Update

```bash
python sagemaker_database_updater.py
```

## Usage Examples

### Basic Update from SageMaker Notebook

```python
from sagemaker_database_updater import SageMakerDatabaseUpdater

# Initialize updater
updater = SageMakerDatabaseUpdater()
updater.connect_database()

# Update model information
model_data = {
    'model_name': 'LSTM_Demand_v3',
    'model_type': 'lstm',
    'sagemaker_endpoint': 'my-endpoint-name',
    'model_accuracy': 0.94,
    'training_status': 'deployed'
}
model_id = updater.update_forecasting_model(model_data)

# Update predictions
predictions = [
    {
        'product_id': 1,
        'store_id': 'store_001',
        'model_id': model_id,
        'prediction_date': '2024-01-15',
        'predicted_demand': 125.5,
        'confidence_interval_lower': 100.2,
        'confidence_interval_upper': 150.8,
        'factors': {'seasonality': 0.8, 'trend': 0.2}
    }
]
updater.update_demand_predictions(predictions)

# Commit changes
updater.commit_changes()
updater.disconnect_database()
```

### Using with AWS Lambda

Deploy `sagemaker_lambda_handler.py` as a Lambda function and invoke with:

```json
{
  "action": "update_predictions",
  "prediction_days": 30,
  "store_ids": ["store_001", "store_002"]
}
```

### Scheduled Updates

Use CloudWatch Events to trigger Lambda function daily:

```bash
aws events put-rule \
    --name "daily-forecast-update" \
    --schedule-expression "cron(0 6 * * ? *)"
```

## SageMaker Integration Patterns

### 1. Real-time Predictions

```python
# Invoke SageMaker endpoint for real-time prediction
payload = {
    "instances": [
        {
            "product_id": 1,
            "store_id": "store_001",
            "historical_demand": [100, 120, 95, 110],
            "features": {
                "day_of_week": 1,
                "month": 12,
                "is_holiday": True
            }
        }
    ]
}

result = updater.invoke_sagemaker_endpoint("my-endpoint", payload)
```

### 2. Batch Processing

```python
# Process batch predictions from SageMaker Transform job
import boto3

s3_client = boto3.client('s3')
predictions_file = s3_client.get_object(
    Bucket='my-sagemaker-bucket',
    Key='batch-predictions/output.json'
)

predictions_data = json.loads(predictions_file['Body'].read())
updater.update_demand_predictions(predictions_data)
```

### 3. Model Performance Monitoring

```python
# Update model performance metrics after evaluation
metrics = [
    {
        'model_id': 1,
        'metric_type': 'mape',
        'metric_value': 8.5,
        'evaluation_period_start': '2024-01-01',
        'evaluation_period_end': '2024-01-31'
    }
]
updater.update_model_performance_metrics(metrics)
```

## Best Practices

### Data Quality

- Validate input data before updating database
- Handle missing values and outliers appropriately
- Implement data type conversions and error handling

### Performance

- Use batch operations for large updates
- Implement connection pooling for high-frequency updates
- Monitor database performance and query optimization

### Security

- Use IAM roles for SageMaker and Lambda access
- Enable RDS encryption and SSL connections
- Rotate database credentials regularly
- Never hardcode credentials in code

### Monitoring

- Set up CloudWatch alarms for failed updates
- Log all database operations for audit trail
- Monitor prediction accuracy over time
- Track model performance degradation

## Troubleshooting

### Common Issues

1. **Database Connection Timeout**

   - Check RDS security group settings
   - Verify network connectivity from SageMaker/Lambda
   - Increase connection timeout settings

2. **Foreign Key Constraints**

   - Ensure referenced products and stores exist
   - Validate model_id exists before creating predictions
   - Use proper error handling for constraint violations

3. **Data Type Mismatches**
   - Ensure decimal precision matches database schema
   - Convert dates to proper format (YYYY-MM-DD)
   - Handle NULL values appropriately

### Debug Mode

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Testing

Test with small data samples first:

```python
# Test with single prediction
test_predictions = updater.generate_sample_predictions(num_days=1)
updater.update_demand_predictions(test_predictions[:1])
```

## Integration with Frontend

The updated data will be automatically available to the React frontend through these API endpoints:

- `/api/analytics/demand-predictions` - Get demand predictions
- `/api/analytics/forecasting-dashboard` - Get dashboard summary
- `/api/analytics/inventory-db` - Get inventory analytics

The forecasting dashboard will display:

- Active AI models and their accuracy
- Demand predictions with confidence intervals
- Optimization recommendations
- Model performance metrics

## Support

For issues with the SageMaker integration:

1. Check CloudWatch logs for Lambda function errors
2. Verify database schema with the validator script
3. Test SageMaker endpoint connectivity
4. Review RDS connection settings and permissions
