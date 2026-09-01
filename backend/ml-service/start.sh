#!/bin/bash
echo "Starting ML Prediction Service..."
echo

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt -q

# Start the service
echo "Starting ML service on port 8000..."
python run.py
