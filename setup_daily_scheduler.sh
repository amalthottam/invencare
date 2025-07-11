#!/bin/bash

# InvenCare Daily Forecasting Scheduler Setup Script
# This script helps you quickly set up daily execution of the forecasting update

set -e  # Exit on any error

echo "🤖 InvenCare Daily Forecasting Scheduler Setup"
echo "=============================================="

# Check if we're on EC2 or local environment
if curl -s http://169.254.169.254/latest/meta-data/instance-id &>/dev/null; then
    echo "✅ Detected AWS EC2 environment"
    IS_EC2=true
else
    echo "📍 Detected local/on-premise environment"
    IS_EC2=false
fi

# Check for required files
if [ ! -f "sagemaker_database_updater_fixed.py" ]; then
    echo "❌ Error: sagemaker_database_updater_fixed.py not found in current directory"
    exit 1
fi

if [ ! -f "requirements.txt" ]; then
    echo "⚠️  Warning: requirements.txt not found. Creating basic requirements..."
    cat > requirements.txt << EOF
mysql-connector-python==8.2.0
boto3==1.34.0
pandas==2.1.4
numpy==1.26.2
scikit-learn==1.3.2
schedule==1.2.0
EOF
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

# Set up environment variables
echo "🔧 Setting up environment variables..."

if [ -z "$RDS_HOSTNAME" ]; then
    read -p "Enter RDS Hostname: " RDS_HOSTNAME
    export RDS_HOSTNAME
fi

if [ -z "$RDS_USERNAME" ]; then
    read -p "Enter RDS Username [admin]: " RDS_USERNAME
    RDS_USERNAME=${RDS_USERNAME:-admin}
    export RDS_USERNAME
fi

if [ -z "$RDS_PASSWORD" ]; then
    read -s -p "Enter RDS Password: " RDS_PASSWORD
    echo
    export RDS_PASSWORD
fi

if [ -z "$RDS_DB_NAME" ]; then
    read -p "Enter Database Name [invencare]: " RDS_DB_NAME
    RDS_DB_NAME=${RDS_DB_NAME:-invencare}
    export RDS_DB_NAME
fi

# Create environment file
cat > .env << EOF
RDS_HOSTNAME=$RDS_HOSTNAME
RDS_USERNAME=$RDS_USERNAME
RDS_PASSWORD=$RDS_PASSWORD
RDS_DB_NAME=$RDS_DB_NAME
RDS_PORT=3306
AWS_REGION=${AWS_REGION:-us-east-1}
EOF

echo "✅ Environment variables saved to .env file"

# Choose scheduling method
echo
echo "📅 Choose your scheduling method:"
echo "1. Cron job (recommended for servers)"
echo "2. Systemd service (recommended for Linux production)"
echo "3. Screen session (for development/testing)"
echo "4. AWS Lambda + CloudWatch (recommended for AWS)"

read -p "Enter your choice (1-4): " CHOICE

case $CHOICE in
    1)
        echo "⏰ Setting up cron job..."
        
        # Create wrapper script that loads environment variables
        cat > run_forecasting.sh << EOF
#!/bin/bash
cd $(pwd)
source .env
export RDS_HOSTNAME RDS_USERNAME RDS_PASSWORD RDS_DB_NAME RDS_PORT AWS_REGION
/usr/bin/python3 sagemaker_database_updater_fixed.py >> forecasting_cron.log 2>&1
EOF
        
        chmod +x run_forecasting.sh
        
        # Add to crontab
        CRON_JOB="0 6 * * * $(pwd)/run_forecasting.sh"
        
        # Check if cron job already exists
        if crontab -l 2>/dev/null | grep -q "run_forecasting.sh"; then
            echo "⚠️  Cron job already exists"
        else
            (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
            echo "✅ Cron job added. Daily execution at 6:00 AM"
        fi
        
        echo "📋 To view/edit cron jobs: crontab -e"
        echo "📋 To view logs: tail -f $(pwd)/forecasting_cron.log"
        ;;
        
    2)
        echo "🔧 Setting up systemd service..."
        
        # Create service file
        sudo tee /etc/systemd/system/invencare-forecasting.service > /dev/null << EOF
[Unit]
Description=InvenCare Daily Forecasting Update
After=network.target

[Service]
Type=oneshot
User=$(whoami)
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/python3 $(pwd)/sagemaker_database_updater_fixed.py
EnvironmentFile=$(pwd)/.env

[Install]
WantedBy=multi-user.target
EOF

        # Create timer file
        sudo tee /etc/systemd/system/invencare-forecasting.timer > /dev/null << EOF
[Unit]
Description=Run InvenCare Forecasting Daily at 6 AM
Requires=invencare-forecasting.service

[Timer]
OnCalendar=*-*-* 06:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

        # Enable and start the timer
        sudo systemctl daemon-reload
        sudo systemctl enable invencare-forecasting.timer
        sudo systemctl start invencare-forecasting.timer
        
        echo "✅ Systemd timer created and started"
        echo "📋 Check status: sudo systemctl status invencare-forecasting.timer"
        echo "📋 View logs: sudo journalctl -u invencare-forecasting.service"
        ;;
        
    3)
        echo "🖥️  Setting up screen session..."
        
        # Create screen session runner
        cat > start_scheduler.sh << EOF
#!/bin/bash
cd $(pwd)
source .env
export RDS_HOSTNAME RDS_USERNAME RDS_PASSWORD RDS_DB_NAME RDS_PORT AWS_REGION
python3 daily_forecasting_scheduler.py
EOF
        
        chmod +x start_scheduler.sh
        
        echo "✅ Screen session setup complete"
        echo "📋 To start: screen -S forecasting-scheduler ./start_scheduler.sh"
        echo "📋 To detach: Ctrl+A then D"
        echo "📋 To reattach: screen -r forecasting-scheduler"
        ;;
        
    4)
        echo "☁️  AWS Lambda setup instructions:"
        echo
        echo "1. Create a Lambda function with the following files:"
        echo "   - sagemaker_lambda_handler.py"
        echo "   - sagemaker_database_updater_fixed.py"
        echo "   - All dependencies from requirements.txt"
        echo
        echo "2. Set environment variables in Lambda:"
        echo "   RDS_HOSTNAME=$RDS_HOSTNAME"
        echo "   RDS_USERNAME=$RDS_USERNAME"
        echo "   RDS_PASSWORD=$RDS_PASSWORD"
        echo "   RDS_DB_NAME=$RDS_DB_NAME"
        echo
        echo "3. Create CloudWatch Event Rule:"
        
        if command -v aws &> /dev/null; then
            echo "📋 Run these AWS CLI commands:"
            echo
            cat << EOF
aws events put-rule \\
    --name "daily-forecasting-update" \\
    --schedule-expression "cron(0 6 * * ? *)" \\
    --description "Daily forecasting update"

aws lambda add-permission \\
    --function-name YOUR_LAMBDA_FUNCTION_NAME \\
    --statement-id daily-forecasting-update \\
    --action lambda:InvokeFunction \\
    --principal events.amazonaws.com

aws events put-targets \\
    --rule daily-forecasting-update \\
    --targets "Id"="1","Arn"="YOUR_LAMBDA_FUNCTION_ARN"
EOF
        else
            echo "   Install AWS CLI and configure it first: pip install awscli"
        fi
        ;;
        
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

# Test the setup
echo
echo "🧪 Testing the setup..."
python3 -c "
import sys
sys.path.append('.')
from sagemaker_database_updater_fixed import SageMakerDatabaseUpdater
updater = SageMakerDatabaseUpdater()
if updater.connect_database():
    print('✅ Database connection test successful')
    updater.disconnect_database()
else:
    print('❌ Database connection test failed')
    sys.exit(1)
"

echo
echo "🎉 Setup complete!"
echo "📊 The forecasting script will now run daily at 6:00 AM"
echo "📋 Monitor logs and check your forecasting dashboard for updates"
