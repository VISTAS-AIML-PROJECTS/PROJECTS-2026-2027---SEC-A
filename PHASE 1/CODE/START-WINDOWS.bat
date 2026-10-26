@echo off
setlocal
cd /d "%~dp0"
title URLNivox - ML Ready
if exist "backend\venv\Scripts\python.exe" goto check_python
where py >nul 2>&1
if errorlevel 1 goto use_python
py -3 -m venv backend\venv
if errorlevel 1 goto setup_error
goto check_python
:use_python
where python >nul 2>&1
if errorlevel 1 goto missing_python
python -m venv backend\venv
if errorlevel 1 goto setup_error
:check_python
"backend\venv\Scripts\python.exe" -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)"
if errorlevel 1 goto missing_python
"backend\venv\Scripts\python.exe" -c "import flask, sklearn, joblib, numpy, scipy; assert sklearn.__version__ == '1.8.0'; assert joblib.__version__ == '1.5.3'; assert numpy.__version__ == '2.3.5'; assert scipy.__version__ == '1.17.0'" >nul 2>&1
if not errorlevel 1 goto check_model
echo Installing the app and compatible ML dependencies. First-time setup needs internet.
"backend\venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 goto setup_error
:check_model
"backend\venv\Scripts\python.exe" backend\check_ml_setup.py
if errorlevel 1 goto model_error
echo.
echo Model is ready. You do not need to train it again.
echo Open http://127.0.0.1:5000 in your browser.
echo Keep this window open. Press Ctrl+C to stop.
echo.
"backend\venv\Scripts\python.exe" backend\app.py
pause
exit /b
:missing_python
echo Python 3.11 or newer is required. Python 3.13 is supported.
echo If this folder contains an older virtual environment, extract this ZIP to a new folder after installing newer Python.
pause
exit /b 1
:setup_error
echo Setup failed. Check the error above and your internet connection, then run again.
pause
exit /b 1
:model_error
echo The bundled model could not be loaded. Check the message above.
echo Extract the full ZIP again, or use the retraining instructions in README.md.
pause
exit /b 1
