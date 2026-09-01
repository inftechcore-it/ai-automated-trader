@echo off
echo Starting ML Prediction Service...
echo.
echo Make sure you have Python 3.11+ installed
echo.

REM Check if venv exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate venv
call venv\Scripts\activate

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt -q

REM Note about TA-Lib
echo.
echo NOTE: TA-Lib requires manual installation on Windows.
echo Download from: https://www.lfd.uci.edu/~gohlke/pythonlibs/#ta-lib
echo.

REM Start the service
echo Starting ML service on port 8000...
python run.py
