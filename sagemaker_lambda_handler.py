"""
AWS Lambda Handler for SageMaker Database Updates

This Lambda function can be triggered by SageMaker training jobs or scheduled events
to update the database with new predictions and model performance data.

Deploy this as a Lambda function with the following configuration:
- Runtime: Python 3.9+
- Memory: 512MB
- Timeout: 15 minutes
- Environment variables: RDS connection details
"""

import json
import logging
import os
from datetime import datetime, timedelta
from sagemaker_database_updater import SageMakerDatabaseUpdater

# Configure logging for Lambda
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    Lambda handler function
    
    Event structure:
    {
        "action": "update_predictions|update_models|full_update",
        "model_name": "optional_model_name",
        "store_ids": ["store_001", "store_002"],  # optional
        "prediction_days": 30,  # optional
        "sagemaker_job_name": "training-job-name"  # optional
    }
    """
    try:
        logger.info(f"Lambda invoked with event: {json.dumps(event)}")
        
        # Initialize the database updater
        updater = SageMakerDatabaseUpdater()
        
        if not updater.connect_database():
            return {
                'statusCode': 500,
                'body': json.dumps({
                    'error': 'Failed to connect to database',
                    'success': False
                })
            }
        
        action = event.get('action', 'full_update')
        results = {}
        
        try:
            if action == 'update_predictions':
                # Update only demand predictions
                prediction_days = event.get('prediction_days', 30)
                predictions = updater.generate_sample_predictions(prediction_days)
                updated_count = updater.update_demand_predictions(predictions)
                results['predictions_updated'] = updated_count
                
            elif action == 'update_models':
                # Update model information and performance
                model_name = event.get('model_name')
                sagemaker_job_name = event.get('sagemaker_job_name')
                
                # Extract model info from SageMaker job (if provided)
                if sagemaker_job_name:
                    model_info = get_sagemaker_job_info(updater.sagemaker_client, sagemaker_job_name)
                    if model_info:
                        model_id = updater.update_forecasting_model(model_info)
                        results['model_updated'] = model_id
                
            elif action == 'full_update':
                # Run complete update process
                success = updater.run_full_update()
                results['full_update_success'] = success
                
            else:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'error': f'Unknown action: {action}',
                        'success': False
                    })
                }
            
            # Commit changes
            updater.commit_changes()
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': f'Successfully executed {action}',
                    'results': results,
                    'timestamp': datetime.now().isoformat(),
                    'success': True
                })
            }
            
        except Exception as e:
            logger.error(f"Error during {action}: {str(e)}")
            updater.connection.rollback() if updater.connection else None
            
            return {
                'statusCode': 500,
                'body': json.dumps({
                    'error': f'Error during {action}: {str(e)}',
                    'success': False
                })
            }
            
        finally:
            updater.disconnect_database()
            
    except Exception as e:
        logger.error(f"Lambda execution error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': f'Lambda execution error: {str(e)}',
                'success': False
            })
        }

def get_sagemaker_job_info(sagemaker_client, job_name):
    """
    Extract model information from a SageMaker training job
    
    Args:
        sagemaker_client: Boto3 SageMaker client
        job_name: Training job name
    
    Returns:
        Dictionary with model information or None
    """
    try:
        response = sagemaker_client.describe_training_job(TrainingJobName=job_name)
        
        model_info = {
            'model_name': response.get('TrainingJobName'),
            'model_type': 'lstm',  # Default, could be extracted from hyperparameters
            'sagemaker_endpoint': None,  # Would be set when endpoint is deployed
            'model_accuracy': 0.85,  # Would be extracted from training metrics
            'training_status': 'training' if response['TrainingJobStatus'] == 'InProgress' else 'deployed',
            'model_artifacts_s3_path': response.get('ModelArtifacts', {}).get('S3ModelArtifacts'),
            'store_id': None,  # Could be extracted from hyperparameters
            'category_id': None  # Could be extracted from hyperparameters
        }
        
        return model_info
        
    except Exception as e:
        logger.error(f"Error getting SageMaker job info: {e}")
        return None

def scheduled_update_handler(event, context):
    """
    Handler for scheduled Lambda executions (CloudWatch Events)
    This runs daily to update predictions and model performance
    """
    try:
        logger.info("Scheduled update triggered")
        
        # Define the event for daily update
        update_event = {
            "action": "full_update",
            "prediction_days": 30
        }
        
        # Call the main handler
        return lambda_handler(update_event, context)
        
    except Exception as e:
        logger.error(f"Scheduled update error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': f'Scheduled update error: {str(e)}',
                'success': False
            })
        }
