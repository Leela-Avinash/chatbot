#!/usr/bin/env bash
set -e

echo "🐍 Installing deps"
pip install -r requirements.txt

echo "🔧 Starting FastAPI + MCP servers"

# Start your MCP servers in background
python mcp_servers/weather_server.py &
python mcp_servers/document_server.py &

# Start your main FastAPI server
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
