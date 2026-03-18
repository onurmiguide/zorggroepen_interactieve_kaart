@echo off
cd /d "%~dp0"
if exist "C:\Program Files\Tesseract-OCR\tesseract.exe" set "TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe"
python -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8001
