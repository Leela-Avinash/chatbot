#!/usr/bin/env bash
set -e

echo "🐍 Installing deps"
pip install -r requirements.txt

echo "🚀 Starting FastAPI (MCP servers spawn automatically)"
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
