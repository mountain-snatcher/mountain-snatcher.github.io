#!/bin/bash

# Taichi Euler Fluid Simulation Backend Launcher

echo "Starting Taichi Euler Fluid Simulation Backend..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed or not in PATH"
    exit 1
fi

# Check if pip is available
if ! command -v pip3 &> /dev/null; then
    echo "Error: pip3 is not installed or not in PATH"
    exit 1
fi

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "Installing Python dependencies..."
    pip3 install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install dependencies"
        exit 1
    fi
else
    echo "Warning: requirements.txt not found"
fi

# Change to src directory
cd src || {
    echo "Error: src directory not found"
    exit 1
}

# Check if server.py exists
if [ ! -f "server.py" ]; then
    echo "Error: server.py not found in src directory"
    exit 1
fi

echo "Starting WebSocket server on ws://localhost:8765..."
echo "Press Ctrl+C to stop the server"

# Run the server
python3 server.py