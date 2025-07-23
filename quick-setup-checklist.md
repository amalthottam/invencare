# Quick Setup Checklist ✅

## Step 1: SageMaker Studio

- [ ] Upload `sagemaker-jupyter-notebook.ipynb` to SageMaker Studio
- [ ] Update database credentials in notebook Cell 3
- [ ] Run the notebook to train and deploy LSTM model
- [ ] Note down the endpoint name created

## Step 2: Lambda Function Setup

### 2.1 Quick Deploy (Automated)

```bash
# Set your credentials
export DB_HOST="your-rds-endpoint.amazonaws.com"
export DB_USER="admin"
export DB_PASSWORD="your-password"
export DB_NAME="inventory_management"
export AWS_REGION="us-east-1"

# Run deployment script
./deploy-lambda-ml-analytics.sh
```

### 2.2 Manual Deploy (if automated fails)

1. Create IAM role: `lambda-ml-analytics-role`
2. Deploy function: `invencare-ml-analytics`
3. Set environment variables with your DB credentials

## Step 3: Update Express Server

Add to your Express server `.env` file:

```bash
LAMBDA_ML_ANALYTICS_FUNCTION=invencare-ml-analytics
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## Step 4: Test the Setup

### 4.1 Health Check

```bash
curl http://localhost:8080/api/ml/health
```

### 4.2 Test Refresh Button

1. Go to your Forecasting page
2. Click "Refresh & Predict" button
3. Watch the browser console for ML requests
4. New predictions should appear

## Step 5: Verify Data Flow

When you click refresh, this happens:

1. ✅ **Health Check** - Tests ML service availability
2. ✅ **Dashboard Data** - Gets ML analytics summary
3. ✅ **Batch Predictions** - Triggers new ML predictions via SageMaker
4. ✅ **Database Storage** - Stores results in your database
5. ✅ **Display Update** - Shows fresh predictions on page

## Expected Results

- Refresh button now says "Generating Predictions..." when working
- Console shows ML API calls
- Fresh predictions appear in the forecasting cards
- Database gets updated with new prediction records

## Troubleshooting

### Lambda Function Issues

```bash
# Check function exists
aws lambda get-function --function-name invencare-ml-analytics

# Check logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/invencare-ml-analytics
```

### Database Connection Issues

- Verify RDS security groups allow Lambda access
- Check database credentials in Lambda environment variables

### SageMaker Endpoint Issues

- Ensure endpoints are deployed and running
- Check endpoint names match Lambda environment variables

## Quick Test Commands

```bash
# Test forecasting API directly
curl -X POST http://localhost:8080/api/ml/analytics \
  -H "Content-Type: application/json" \
  -d '{"action":"forecast","product_id":"FV-BAN-001","store_id":"store_001","forecast_days":7}'

# Test batch predictions
curl -X POST http://localhost:8080/api/ml/analytics \
  -H "Content-Type: application/json" \
  -d '{"action":"batch_predict","store_id":"store_001","batch_size":5}'

# Check stored predictions
curl http://localhost:8080/api/ml/predictions/FV-BAN-001/store_001
```

This setup creates a complete ML pipeline: **SageMaker training → Lambda processing → Database storage → Frontend display**
