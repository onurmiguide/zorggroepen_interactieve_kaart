@echo off
cd /d "%~dp0"
if exist "C:\Program Files\Tesseract-OCR\tesseract.exe" set "TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe"
if "%GLM_OCR_PROVIDER%"=="" set "GLM_OCR_PROVIDER=ollama"
if "%GLM_OCR_OLLAMA_MODEL%"=="" set "GLM_OCR_OLLAMA_MODEL=glm-ocr"
if "%GLM_OCR_OLLAMA_URL%"=="" set "GLM_OCR_OLLAMA_URL=http://127.0.0.1:11434/api/chat"
echo GLM-OCR provider: %GLM_OCR_PROVIDER% (%GLM_OCR_OLLAMA_MODEL%)
python -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8001
