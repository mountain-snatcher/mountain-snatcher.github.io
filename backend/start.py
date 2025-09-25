#!/usr/bin/env python3
"""
Simple startup script for Render deployment
"""
import os
import subprocess
import sys

def main():
    # Change to src directory
    os.chdir('src')
    
    # Run the production server
    subprocess.run([sys.executable, 'server_production.py'])

if __name__ == '__main__':
    main()