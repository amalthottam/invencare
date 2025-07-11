#!/usr/bin/env python3
"""
Daily Forecasting Scheduler for InvenCare

This script provides multiple ways to schedule daily forecasting updates:
1. AWS Lambda with CloudWatch Events (recommended for AWS deployments)
2. Cron job (for Linux/Unix servers)
3. Continuous scheduler (for always-on applications)
4. Windows Task Scheduler (for Windows servers)
"""

import os
import json
import time
import logging
import schedule
from datetime import datetime, timedelta
from sagemaker_database_updater_fixed import SageMakerDatabaseUpdater

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('forecasting_scheduler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ForecastingScheduler:
    def __init__(self):
        self.updater = SageMakerDatabaseUpdater()
        self.last_run = None
        
    def run_daily_forecast_update(self):
        """Execute the daily forecasting update"""
        try:
            logger.info("Starting daily forecasting update...")
            
            # Record start time
            start_time = datetime.now()
            
            # Run the update
            success = self.updater.run_full_update()
            
            # Record completion
            end_time = datetime.now()
            duration = end_time - start_time
            
            if success:
                logger.info(f"✅ Daily forecasting update completed successfully in {duration}")
                self.last_run = datetime.now()
                return True
            else:
                logger.error(f"❌ Daily forecasting update failed after {duration}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Exception during daily forecasting update: {e}")
            return False
    
    def run_continuous_scheduler(self):
        """Run a continuous scheduler that executes daily at specified time"""
        # Schedule daily execution at 6:00 AM
        schedule.every().day.at("06:00").do(self.run_daily_forecast_update)
        
        logger.info("🕰️ Continuous scheduler started. Daily updates scheduled for 06:00 AM")
        
        while True:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except KeyboardInterrupt:
                logger.info("Scheduler stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in scheduler: {e}")
                time.sleep(300)  # Wait 5 minutes before retrying

def lambda_handler(event, context):
    """
    AWS Lambda handler for scheduled execution
    Deploy this function and trigger it with CloudWatch Events
    """
    try:
        logger.info(f"Lambda triggered with event: {json.dumps(event)}")
        
        scheduler = ForecastingScheduler()
        success = scheduler.run_daily_forecast_update()
        
        return {
            'statusCode': 200 if success else 500,
            'body': json.dumps({
                'message': 'Daily forecasting update completed' if success else 'Daily forecasting update failed',
                'timestamp': datetime.now().isoformat(),
                'success': success
            })
        }
        
    except Exception as e:
        logger.error(f"Lambda execution error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': f'Lambda execution error: {str(e)}',
                'timestamp': datetime.now().isoformat(),
                'success': False
            })
        }

def create_cron_job():
    """Generate cron job configuration"""
    cron_command = f"""
# Daily forecasting update at 6:00 AM
0 6 * * * cd {os.getcwd()} && /usr/bin/python3 {os.path.join(os.getcwd(), 'sagemaker_database_updater_fixed.py')} >> /var/log/forecasting_cron.log 2>&1
"""
    
    print("📋 Cron job configuration:")
    print("Add this line to your crontab (run 'crontab -e'):")
    print(cron_command.strip())
    
    return cron_command

def create_systemd_service():
    """Generate systemd service and timer files"""
    service_content = f"""[Unit]
Description=InvenCare Daily Forecasting Update
After=network.target

[Service]
Type=oneshot
User=ec2-user
WorkingDirectory={os.getcwd()}
ExecStart=/usr/bin/python3 {os.path.join(os.getcwd(), 'sagemaker_database_updater_fixed.py')}
Environment=RDS_HOSTNAME={os.getenv('RDS_HOSTNAME', 'your-rds-hostname')}
Environment=RDS_USERNAME={os.getenv('RDS_USERNAME', 'admin')}
Environment=RDS_PASSWORD={os.getenv('RDS_PASSWORD', 'your-password')}
Environment=RDS_DB_NAME={os.getenv('RDS_DB_NAME', 'invencare')}
Environment=AWS_REGION={os.getenv('AWS_REGION', 'us-east-1')}

[Install]
WantedBy=multi-user.target
"""

    timer_content = """[Unit]
Description=Run InvenCare Forecasting Daily
Requires=invencare-forecasting.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
"""

    print("📋 Systemd service configuration:")
    print("\n1. Create /etc/systemd/system/invencare-forecasting.service:")
    print(service_content)
    print("\n2. Create /etc/systemd/system/invencare-forecasting.timer:")
    print(timer_content)
    print("\n3. Enable and start the timer:")
    print("sudo systemctl daemon-reload")
    print("sudo systemctl enable invencare-forecasting.timer")
    print("sudo systemctl start invencare-forecasting.timer")

def create_aws_cloudwatch_event():
    """Generate AWS CloudWatch Events configuration"""
    cloudformation_template = {
        "AWSTemplateFormatVersion": "2010-09-09",
        "Description": "Daily forecasting update scheduler",
        "Resources": {
            "ForecastingUpdateRule": {
                "Type": "AWS::Events::Rule",
                "Properties": {
                    "Description": "Trigger daily forecasting update",
                    "ScheduleExpression": "cron(0 6 * * ? *)",
                    "State": "ENABLED",
                    "Targets": [
                        {
                            "Arn": {"Fn::GetAtt": ["ForecastingLambda", "Arn"]},
                            "Id": "ForecastingUpdateTarget"
                        }
                    ]
                }
            },
            "LambdaInvokePermission": {
                "Type": "AWS::Lambda::Permission",
                "Properties": {
                    "Action": "lambda:InvokeFunction",
                    "FunctionName": {"Ref": "ForecastingLambda"},
                    "Principal": "events.amazonaws.com",
                    "SourceArn": {"Fn::GetAtt": ["ForecastingUpdateRule", "Arn"]}
                }
            }
        }
    }
    
    print("📋 AWS CloudWatch Events setup:")
    print("\n1. Deploy the Lambda function using the sagemaker_lambda_handler.py")
    print("2. Use this CloudFormation template:")
    print(json.dumps(cloudformation_template, indent=2))
    
    print("\n3. Or use AWS CLI:")
    print(f"""
aws events put-rule \\
    --name "daily-forecasting-update" \\
    --schedule-expression "cron(0 6 * * ? *)" \\
    --description "Daily forecasting update"

aws lambda add-permission \\
    --function-name your-forecasting-lambda \\
    --statement-id daily-forecasting-update \\
    --action lambda:InvokeFunction \\
    --principal events.amazonaws.com \\
    --source-arn arn:aws:events:region:account:rule/daily-forecasting-update

aws events put-targets \\
    --rule daily-forecasting-update \\
    --targets "Id"="1","Arn"="arn:aws:lambda:region:account:function:your-forecasting-lambda"
""")

def main():
    """Main function to choose scheduling method"""
    print("🤖 InvenCare Daily Forecasting Scheduler Setup")
    print("=" * 50)
    print("Choose your scheduling method:")
    print("1. Run continuous scheduler (keeps running)")
    print("2. Generate cron job configuration")
    print("3. Generate systemd service configuration")
    print("4. Generate AWS CloudWatch Events configuration")
    print("5. Run once now (for testing)")
    
    choice = input("\nEnter your choice (1-5): ").strip()
    
    scheduler = ForecastingScheduler()
    
    if choice == "1":
        print("🚀 Starting continuous scheduler...")
        scheduler.run_continuous_scheduler()
        
    elif choice == "2":
        create_cron_job()
        
    elif choice == "3":
        create_systemd_service()
        
    elif choice == "4":
        create_aws_cloudwatch_event()
        
    elif choice == "5":
        print("🧪 Running forecasting update once...")
        success = scheduler.run_daily_forecast_update()
        if success:
            print("✅ Test run completed successfully!")
        else:
            print("❌ Test run failed!")
    
    else:
        print("❌ Invalid choice. Please run again and select 1-5.")

if __name__ == "__main__":
    main()
