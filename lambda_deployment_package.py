#!/usr/bin/env python3
"""
AWS Lambda Deployment Package Creator for InvenCare Forecasting

This script creates a deployment package for AWS Lambda with all required dependencies.
"""

import os
import zipfile
import subprocess
import tempfile
import shutil
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_lambda_package():
    """Create a Lambda deployment package"""
    
    # Files to include in the package
    required_files = [
        'sagemaker_database_updater_fixed.py',
        'sagemaker_lambda_handler.py',
        'requirements.txt'
    ]
    
    # Check if all required files exist
    for file in required_files:
        if not os.path.exists(file):
            logger.error(f"Required file not found: {file}")
            return False
    
    # Create temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        logger.info("Creating Lambda deployment package...")
        
        # Install dependencies
        logger.info("Installing dependencies...")
        subprocess.run([
            'pip', 'install', '-r', 'requirements.txt', 
            '--target', temp_dir, '--no-deps'
        ], check=True)
        
        # Copy source files
        for file in required_files:
            shutil.copy2(file, temp_dir)
            logger.info(f"Added {file} to package")
        
        # Create the zip file
        package_name = 'invencare-forecasting-lambda.zip'
        with zipfile.ZipFile(package_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arcname)
        
        logger.info(f"✅ Lambda package created: {package_name}")
        logger.info(f"📦 Package size: {os.path.getsize(package_name) / 1024 / 1024:.2f} MB")
        
        # Generate deployment commands
        print("\n📋 AWS Lambda Deployment Commands:")
        print("=" * 50)
        
        print(f"""
# 1. Create Lambda function
aws lambda create-function \\
    --function-name invencare-forecasting \\
    --runtime python3.9 \\
    --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \\
    --handler sagemaker_lambda_handler.lambda_handler \\
    --zip-file fileb://{package_name} \\
    --timeout 900 \\
    --memory-size 512 \\
    --environment Variables='{{
        "RDS_HOSTNAME":"your-rds-hostname",
        "RDS_USERNAME":"admin",
        "RDS_PASSWORD":"your-password",
        "RDS_DB_NAME":"invencare",
        "AWS_REGION":"us-east-1"
    }}'

# 2. Update function code (if function already exists)
aws lambda update-function-code \\
    --function-name invencare-forecasting \\
    --zip-file fileb://{package_name}

# 3. Create CloudWatch Event Rule for daily execution
aws events put-rule \\
    --name "daily-forecasting-update" \\
    --schedule-expression "cron(0 6 * * ? *)" \\
    --description "Daily forecasting update at 6 AM UTC"

# 4. Add permission for CloudWatch Events to invoke Lambda
aws lambda add-permission \\
    --function-name invencare-forecasting \\
    --statement-id daily-forecasting-update \\
    --action lambda:InvokeFunction \\
    --principal events.amazonaws.com \\
    --source-arn arn:aws:events:YOUR_REGION:YOUR_ACCOUNT:rule/daily-forecasting-update

# 5. Add Lambda as target to the CloudWatch Event Rule
aws events put-targets \\
    --rule daily-forecasting-update \\
    --targets "Id"="1","Arn"="arn:aws:lambda:YOUR_REGION:YOUR_ACCOUNT:function:invencare-forecasting"
""")
        
        print("\n📋 Environment Variables to Set in Lambda:")
        print("=" * 50)
        print("RDS_HOSTNAME = your-rds-hostname")
        print("RDS_USERNAME = admin")
        print("RDS_PASSWORD = your-password")
        print("RDS_DB_NAME = invencare")
        print("RDS_PORT = 3306")
        print("AWS_REGION = us-east-1")
        
        return True

def create_terraform_config():
    """Create Terraform configuration for Lambda deployment"""
    
    terraform_config = """
# InvenCare Forecasting Lambda Function
resource "aws_lambda_function" "forecasting_lambda" {
  filename         = "invencare-forecasting-lambda.zip"
  function_name    = "invencare-forecasting"
  role            = aws_iam_role.lambda_role.arn
  handler         = "sagemaker_lambda_handler.lambda_handler"
  runtime         = "python3.9"
  timeout         = 900
  memory_size     = 512

  environment {
    variables = {
      RDS_HOSTNAME = var.rds_hostname
      RDS_USERNAME = var.rds_username
      RDS_PASSWORD = var.rds_password
      RDS_DB_NAME  = var.rds_db_name
      RDS_PORT     = "3306"
      AWS_REGION   = var.aws_region
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_logs,
    aws_cloudwatch_log_group.lambda_logs,
  ]
}

# CloudWatch Event Rule for daily execution
resource "aws_cloudwatch_event_rule" "daily_forecasting" {
  name                = "daily-forecasting-update"
  description         = "Daily forecasting update at 6 AM UTC"
  schedule_expression = "cron(0 6 * * ? *)"
}

# CloudWatch Event Target
resource "aws_cloudwatch_event_target" "lambda_target" {
  rule      = aws_cloudwatch_event_rule.daily_forecasting.name
  target_id = "ForecastingLambdaTarget"
  arn       = aws_lambda_function.forecasting_lambda.arn
}

# Lambda permission for CloudWatch Events
resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.forecasting_lambda.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_forecasting.arn
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "invencare-forecasting-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for Lambda to access RDS and CloudWatch
resource "aws_iam_role_policy" "lambda_policy" {
  name = "invencare-forecasting-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "sagemaker:InvokeEndpoint",
          "sagemaker:DescribeEndpoint",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/invencare-forecasting"
  retention_in_days = 14
}

# IAM policy attachment for Lambda basic execution
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Variables
variable "rds_hostname" {
  description = "RDS hostname"
  type        = string
}

variable "rds_username" {
  description = "RDS username"
  type        = string
  default     = "admin"
}

variable "rds_password" {
  description = "RDS password"
  type        = string
  sensitive   = true
}

variable "rds_db_name" {
  description = "RDS database name"
  type        = string
  default     = "invencare"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# Outputs
output "lambda_function_arn" {
  value = aws_lambda_function.forecasting_lambda.arn
}

output "cloudwatch_event_rule_arn" {
  value = aws_cloudwatch_event_rule.daily_forecasting.arn
}
"""

    with open('terraform-lambda.tf', 'w') as f:
        f.write(terraform_config)
    
    logger.info("✅ Terraform configuration created: terraform-lambda.tf")
    
    # Create terraform.tfvars.example
    tfvars_example = """
# Copy this file to terraform.tfvars and fill in your values
rds_hostname = "your-rds-hostname.amazonaws.com"
rds_username = "admin"
rds_password = "your-secure-password"
rds_db_name  = "invencare"
aws_region   = "us-east-1"
"""
    
    with open('terraform.tfvars.example', 'w') as f:
        f.write(tfvars_example)
    
    logger.info("✅ Terraform variables example created: terraform.tfvars.example")

def main():
    """Main function"""
    print("🚀 InvenCare Lambda Deployment Package Creator")
    print("=" * 50)
    
    # Create deployment package
    if create_lambda_package():
        print("\n🔧 Creating Terraform configuration...")
        create_terraform_config()
        
        print("\n🎉 Deployment package creation complete!")
        print("\nNext steps:")
        print("1. Upload invencare-forecasting-lambda.zip to AWS Lambda")
        print("2. Configure environment variables")
        print("3. Set up CloudWatch Events rule")
        print("4. Or use the provided Terraform configuration")
    else:
        print("❌ Failed to create deployment package")

if __name__ == "__main__":
    main()
