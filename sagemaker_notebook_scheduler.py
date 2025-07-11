#!/usr/bin/env python3
"""
SageMaker Notebook Scheduler for Daily Forecasting

This script helps set up automated execution of the SageMaker notebook
using various AWS services like EventBridge, Lambda, and SageMaker Processing Jobs.
"""

import boto3
import json
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SageMakerNotebookScheduler:
    def __init__(self, region='us-east-1'):
        self.region = region
        self.sagemaker = boto3.client('sagemaker', region_name=region)
        self.events = boto3.client('events', region_name=region)
        self.lambda_client = boto3.client('lambda', region_name=region)
        self.iam = boto3.client('iam', region_name=region)
        
    def create_processing_job_script(self):
        """Create a Python script for SageMaker Processing Job"""
        processing_script = '''
import os
import sys
import subprocess
import json
from datetime import datetime

# Install required packages
subprocess.check_call([sys.executable, "-m", "pip", "install", 
                      "mysql-connector-python", "pandas", "numpy", 
                      "scikit-learn", "matplotlib", "seaborn", "plotly"])

# Import our forecasting modules
sys.path.append('/opt/ml/processing/input/code')

from sagemaker_database_updater_fixed import SageMakerDatabaseUpdater

def main():
    """Main processing function"""
    print(f"🚀 Starting SageMaker Processing Job at {datetime.now()}")
    
    # Database configuration from environment variables
    db_config = {
        'host': os.environ.get('RDS_HOSTNAME', 'invencaredb.cihe2wg8etco.us-east-1.rds.amazonaws.com'),
        'user': os.environ.get('RDS_USERNAME', 'admin'),
        'password': os.environ.get('RDS_PASSWORD', 'InvenCare123'),
        'database': os.environ.get('RDS_DB_NAME', 'invencare'),
        'port': int(os.environ.get('RDS_PORT', 3306)),
        'autocommit': False
    }
    
    try:
        # Initialize the updater
        updater = SageMakerDatabaseUpdater()
        
        # Run the full update
        success = updater.run_full_update()
        
        # Create output report
        report = {
            'timestamp': datetime.now().isoformat(),
            'success': success,
            'message': 'Forecasting update completed' if success else 'Forecasting update failed'
        }
        
        # Save report to output directory
        output_dir = '/opt/ml/processing/output'
        os.makedirs(output_dir, exist_ok=True)
        
        with open(f"{output_dir}/forecasting_report.json", 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"✅ Processing completed. Success: {success}")
        
        if not success:
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Processing failed: {e}")
        
        # Save error report
        error_report = {
            'timestamp': datetime.now().isoformat(),
            'success': False,
            'error': str(e)
        }
        
        output_dir = '/opt/ml/processing/output'
        os.makedirs(output_dir, exist_ok=True)
        
        with open(f"{output_dir}/error_report.json", 'w') as f:
            json.dump(error_report, f, indent=2)
        
        sys.exit(1)

if __name__ == "__main__":
    main()
'''
        
        with open('sagemaker_processing_script.py', 'w') as f:
            f.write(processing_script)
        
        logger.info("✅ Created sagemaker_processing_script.py")
        return 'sagemaker_processing_script.py'
    
    def create_lambda_function(self, function_name='invencare-notebook-trigger'):
        """Create Lambda function to trigger SageMaker Processing Job"""
        
        lambda_code = '''
import boto3
import json
import os
from datetime import datetime

def lambda_handler(event, context):
    """Lambda function to trigger SageMaker Processing Job"""
    
    sagemaker = boto3.client('sagemaker')
    
    # Job configuration
    job_name = f"invencare-forecasting-{datetime.now().strftime('%Y-%m-%d-%H-%M-%S')}"
    
    processing_job_config = {
        'ProcessingJobName': job_name,
        'ProcessingResources': {
            'ClusterConfig': {
                'InstanceCount': 1,
                'InstanceType': 'ml.t3.medium',
                'VolumeSizeInGB': 30
            }
        },
        'AppSpecification': {
            'ImageUri': '246618743249.dkr.ecr.us-west-2.amazonaws.com/sagemaker-scikit-learn:0.23-1-cpu-py3',
            'ContainerEntrypoint': ['python3', '/opt/ml/processing/input/code/sagemaker_processing_script.py']
        },
        'ProcessingInputs': [
            {
                'InputName': 'code',
                'S3Input': {
                    'S3Uri': f"s3://{os.environ['BUCKET_NAME']}/processing-code/",
                    'LocalPath': '/opt/ml/processing/input/code',
                    'S3DataType': 'S3Prefix',
                    'S3InputMode': 'File'
                }
            }
        ],
        'ProcessingOutputConfig': {
            'Outputs': [
                {
                    'OutputName': 'reports',
                    'S3Output': {
                        'S3Uri': f"s3://{os.environ['BUCKET_NAME']}/processing-output/",
                        'LocalPath': '/opt/ml/processing/output',
                        'S3UploadMode': 'EndOfJob'
                    }
                }
            ]
        },
        'RoleArn': os.environ['SAGEMAKER_ROLE_ARN'],
        'Environment': {
            'RDS_HOSTNAME': os.environ['RDS_HOSTNAME'],
            'RDS_USERNAME': os.environ['RDS_USERNAME'],
            'RDS_PASSWORD': os.environ['RDS_PASSWORD'],
            'RDS_DB_NAME': os.environ['RDS_DB_NAME'],
            'RDS_PORT': '3306'
        }
    }
    
    try:
        response = sagemaker.create_processing_job(**processing_job_config)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Processing job {job_name} started successfully',
                'jobArn': response['ProcessingJobArn']
            })
        }
        
    except Exception as e:
        print(f"Error starting processing job: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }
'''
        
        # Create deployment package
        import zipfile
        import tempfile
        
        with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as tmp:
            with zipfile.ZipFile(tmp.name, 'w') as zipf:
                zipf.writestr('lambda_function.py', lambda_code)
            
            lambda_package = tmp.name
        
        logger.info(f"✅ Created Lambda deployment package: {lambda_package}")
        return lambda_package
    
    def create_eventbridge_rule(self, rule_name='daily-forecasting', schedule='cron(0 6 * * ? *)'):
        """Create EventBridge rule for daily execution"""
        
        try:
            # Create the rule
            response = self.events.put_rule(
                Name=rule_name,
                ScheduleExpression=schedule,
                Description='Daily forecasting update at 6 AM UTC',
                State='ENABLED'
            )
            
            logger.info(f"✅ Created EventBridge rule: {rule_name}")
            return response['RuleArn']
            
        except Exception as e:
            logger.error(f"❌ Failed to create EventBridge rule: {e}")
            return None
    
    def generate_cloudformation_template(self):
        """Generate CloudFormation template for complete setup"""
        
        template = {
            "AWSTemplateFormatVersion": "2010-09-09",
            "Description": "InvenCare SageMaker Forecasting Daily Scheduler",
            "Parameters": {
                "RDSHostname": {
                    "Type": "String",
                    "Description": "RDS database hostname",
                    "Default": "invencaredb.cihe2wg8etco.us-east-1.rds.amazonaws.com"
                },
                "RDSUsername": {
                    "Type": "String",
                    "Description": "RDS username",
                    "Default": "admin"
                },
                "RDSPassword": {
                    "Type": "String",
                    "Description": "RDS password",
                    "NoEcho": True
                },
                "S3BucketName": {
                    "Type": "String",
                    "Description": "S3 bucket for SageMaker artifacts"
                }
            },
            "Resources": {
                "SageMakerExecutionRole": {
                    "Type": "AWS::IAM::Role",
                    "Properties": {
                        "AssumeRolePolicyDocument": {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Effect": "Allow",
                                    "Principal": {"Service": "sagemaker.amazonaws.com"},
                                    "Action": "sts:AssumeRole"
                                }
                            ]
                        },
                        "ManagedPolicyArns": [
                            "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
                        ],
                        "Policies": [
                            {
                                "PolicyName": "S3Access",
                                "PolicyDocument": {
                                    "Version": "2012-10-17",
                                    "Statement": [
                                        {
                                            "Effect": "Allow",
                                            "Action": ["s3:*"],
                                            "Resource": [
                                                {"Fn::Sub": "arn:aws:s3:::${S3BucketName}"},
                                                {"Fn::Sub": "arn:aws:s3:::${S3BucketName}/*"}
                                            ]
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                },
                "LambdaExecutionRole": {
                    "Type": "AWS::IAM::Role",
                    "Properties": {
                        "AssumeRolePolicyDocument": {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Effect": "Allow",
                                    "Principal": {"Service": "lambda.amazonaws.com"},
                                    "Action": "sts:AssumeRole"
                                }
                            ]
                        },
                        "ManagedPolicyArns": [
                            "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
                        ],
                        "Policies": [
                            {
                                "PolicyName": "SageMakerAccess",
                                "PolicyDocument": {
                                    "Version": "2012-10-17",
                                    "Statement": [
                                        {
                                            "Effect": "Allow",
                                            "Action": [
                                                "sagemaker:CreateProcessingJob",
                                                "sagemaker:DescribeProcessingJob",
                                                "iam:PassRole"
                                            ],
                                            "Resource": "*"
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                },
                "ForecastingLambda": {
                    "Type": "AWS::Lambda::Function",
                    "Properties": {
                        "FunctionName": "invencare-forecasting-trigger",
                        "Runtime": "python3.9",
                        "Handler": "lambda_function.lambda_handler",
                        "Code": {
                            "ZipFile": "# Lambda code will be deployed separately"
                        },
                        "Role": {"Fn::GetAtt": ["LambdaExecutionRole", "Arn"]},
                        "Environment": {
                            "Variables": {
                                "BUCKET_NAME": {"Ref": "S3BucketName"},
                                "SAGEMAKER_ROLE_ARN": {"Fn::GetAtt": ["SageMakerExecutionRole", "Arn"]},
                                "RDS_HOSTNAME": {"Ref": "RDSHostname"},
                                "RDS_USERNAME": {"Ref": "RDSUsername"},
                                "RDS_PASSWORD": {"Ref": "RDSPassword"},
                                "RDS_DB_NAME": "invencare"
                            }
                        },
                        "Timeout": 60
                    }
                },
                "DailyScheduleRule": {
                    "Type": "AWS::Events::Rule",
                    "Properties": {
                        "Name": "daily-forecasting-schedule",
                        "Description": "Daily forecasting at 6 AM UTC",
                        "ScheduleExpression": "cron(0 6 * * ? *)",
                        "State": "ENABLED",
                        "Targets": [
                            {
                                "Arn": {"Fn::GetAtt": ["ForecastingLambda", "Arn"]},
                                "Id": "ForecastingLambdaTarget"
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
                        "SourceArn": {"Fn::GetAtt": ["DailyScheduleRule", "Arn"]}
                    }
                }
            },
            "Outputs": {
                "LambdaFunctionArn": {
                    "Description": "ARN of the Lambda function",
                    "Value": {"Fn::GetAtt": ["ForecastingLambda", "Arn"]}
                },
                "SageMakerRoleArn": {
                    "Description": "ARN of the SageMaker execution role",
                    "Value": {"Fn::GetAtt": ["SageMakerExecutionRole", "Arn"]}
                },
                "ScheduleRuleArn": {
                    "Description": "ARN of the EventBridge rule",
                    "Value": {"Fn::GetAtt": ["DailyScheduleRule", "Arn"]}
                }
            }
        }
        
        with open('sagemaker-scheduler-template.yaml', 'w') as f:
            import yaml
            yaml.dump(template, f, default_flow_style=False)
        
        logger.info("✅ Created CloudFormation template: sagemaker-scheduler-template.yaml")
        return template

def main():
    """Main setup function"""
    print("🚀 SageMaker Notebook Scheduler Setup")
    print("=" * 50)
    
    scheduler = SageMakerNotebookScheduler()
    
    print("\n1. Creating processing script...")
    processing_script = scheduler.create_processing_job_script()
    
    print("\n2. Creating Lambda deployment package...")
    lambda_package = scheduler.create_lambda_function()
    
    print("\n3. Generating CloudFormation template...")
    cf_template = scheduler.generate_cloudformation_template()
    
    print("\n📋 Setup Instructions:")
    print("=" * 30)
    print("1. Upload the following files to your S3 bucket under 'processing-code/':")
    print(f"   - {processing_script}")
    print("   - sagemaker_database_updater_fixed.py")
    print("   - requirements.txt")
    print()
    print("2. Deploy the CloudFormation template:")
    print("   aws cloudformation create-stack \\")
    print("     --stack-name invencare-forecasting-scheduler \\")
    print("     --template-body file://sagemaker-scheduler-template.yaml \\")
    print("     --parameters ParameterKey=RDSPassword,ParameterValue=YOUR_PASSWORD \\")
    print("                  ParameterKey=S3BucketName,ParameterValue=YOUR_BUCKET \\")
    print("     --capabilities CAPABILITY_IAM")
    print()
    print("3. Update Lambda function code:")
    print(f"   aws lambda update-function-code \\")
    print(f"     --function-name invencare-forecasting-trigger \\")
    print(f"     --zip-file fileb://{lambda_package}")
    print()
    print("4. Your forecasting will now run daily at 6:00 AM UTC!")
    print()
    print("📊 Monitor execution:")
    print("- CloudWatch Logs for Lambda function")
    print("- SageMaker console for Processing Jobs")
    print("- S3 bucket for output reports")

if __name__ == "__main__":
    main()
