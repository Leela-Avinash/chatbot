"""
Real MCP Weather Server using official MCP SDK
Communicates via stdio (stdin/stdout) using JSON-RPC 2.0
"""
import asyncio
import httpx
from typing import Any
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

app = Server("weather-server")

@app.list_tools()
async def list_tools() -> list[Tool]:
    """
    List available tools - called by MCP client during discovery
    """
    return [
        Tool(
            name="get_weather",
            description="Get current weather for a city using Open-Meteo API",
            inputSchema={
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "City name (e.g., 'London', 'New York')"
                    }
                },
                "required": ["city"],
                "additionalProperties": False
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """
    Execute tool - called by MCP client when tool is invoked
    """
    import sys
    print(f"[WEATHER SERVER] Received call_tool: name={name}, arguments={arguments}, type={type(arguments)}", file=sys.stderr)
    
    if name == "get_weather":
        return await get_weather(arguments)
    else:
        return [TextContent(
            type="text",
            text=f"Unknown tool: {name}"
        )]

async def get_weather(arguments: dict) -> list[TextContent]:
    """
    Get weather data from Open-Meteo API
    
    Args:
        arguments: {"city": "London"}
    
    Returns:
        Weather data as TextContent
    """
    import sys
    print(f"[WEATHER SERVER] get_weather called with arguments: {arguments}, type: {type(arguments)}", file=sys.stderr)
    
    try:
        city = arguments.get("city")
        print(f"[WEATHER SERVER] Extracted city: {city}", file=sys.stderr)
        
        if not city:
            return [TextContent(
                type="text",
                text="Error: city parameter is required"
            )]
        
        geocoding_url = "https://geocoding-api.open-meteo.com/v1/search"
        geocoding_params = {"name": city, "count": 1, "language": "en", "format": "json"}

        async with httpx.AsyncClient() as client:
            response = await client.get(geocoding_url, params=geocoding_params)
            if response.status_code != 200:
                return [TextContent(
                    type="text",
                    text=f"Could not find city: {city}"
                )]
            
            geocoding_data = response.json()
            
            if not geocoding_data.get("results"):
                return [TextContent(
                    type="text",
                    text=f"City not found: {city}"
                )]
            
            location = geocoding_data["results"][0]
            latitude = location["latitude"]
            longitude = location["longitude"]
            
            weather_url = "https://api.open-meteo.com/v1/forecast"
            weather_params = {
                "latitude": latitude,
                "longitude": longitude,
                "current": "temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m",
                "hourly": "temperature_2m",
                "daily": "sunrise,sunset,temperature_2m_max,temperature_2m_min",
                "timezone": "auto",
            }

            response = await client.get(weather_url, params=weather_params, headers={"Accept": "application/json"})
            if response.status_code != 200:
                return [TextContent(
                    type="text",
                    text="Could not fetch weather data"
                )]
            
            weather_data = response.json()
            
            if not weather_data.get("current"):
                return [TextContent(
                    type="text",
                    text="Incomplete weather data received"
                )]
            
            import json
            result = {
                "cityName": city,
                "latitude": latitude,
                "longitude": longitude,
                "timezone": weather_data.get("timezone", ""),
                "current": weather_data.get("current", {}),
                "hourly": weather_data.get("hourly", {}),
                "daily": weather_data.get("daily", {}),
                "current_units": weather_data.get("current_units", {}),
            }
            
            return [TextContent(
                type="text",
                text=json.dumps(result)
            )]
                
    except Exception as e:
        return [TextContent(
            type="text",
            text=f"Error: {str(e)}"
        )]

async def main():
    """
    Main entry point - runs MCP server with stdio transport
    """
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )

if __name__ == "__main__":
    asyncio.run(main())
