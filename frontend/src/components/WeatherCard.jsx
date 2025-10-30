import React from 'react';
import {
    Cloud,
    CloudDrizzle,
    CloudRain,
    CloudSnow,
    CloudLightning,
    CloudFog,
    Droplets,
    Wind,
    Sun,
    CloudSun,
    Snowflake,
    MapPin,
} from 'lucide-react';
import { weatherCodes, getWeatherDescription, getWeatherIconType } from '../utils/weatherCodes';

export const WeatherCard = ({ data }) => {
    // Add defensive checks for data structure
    if (!data) {
        return null;
    }

    const { 
        cityName = 'Unknown', 
        country = '', 
        current = {}, 
        current_units = {}, 
        timezone = '', 
        daily = {},
        hourly = {}
    } = data;

    // Check if current has the required data
    if (!current || typeof current !== 'object' || current.temperature_2m === undefined) {
        // Better error message for location not found
        return (
            <div className="rounded-xl p-4 my-2 border" style={{ backgroundColor: '#2d2d2d', borderColor: '#404040' }}>
                <div className="flex items-center gap-2" style={{ color: '#9ca3af' }}>
                    <MapPin className="w-5 h-5" />
                    <p className="text-sm">
                        I don't have information about the weather at <span className="font-semibold">{cityName}</span>. 
                        Please check the location name and try again.
                    </p>
                </div>
            </div>
        );
    }
    
    // Set default weather_code if missing
    if (current.weather_code === undefined) {
        current.weather_code = 0; // Clear sky as default
    }

    const getWeatherIcon = (code, size = "w-12 h-12") => {
        const iconType = getWeatherIconType(code);
        
        switch (iconType) {
            case "sun":
                return <Sun className={`${size} text-yellow-400`} />;
            case "cloud-sun":
                return <CloudSun className={`${size} text-yellow-300`} />;
            case "cloud":
                return <Cloud className={`${size} text-gray-300`} />;
            case "cloud-fog":
                return <CloudFog className={`${size} text-gray-400`} />;
            case "cloud-drizzle":
                return <CloudDrizzle className={`${size} text-blue-300`} />;
            case "cloud-rain":
                return <CloudRain className={`${size} text-blue-400`} />;
            case "snowflake":
                return <Snowflake className={`${size} text-blue-200`} />;
            case "cloud-lightning":
                return <CloudLightning className={`${size} text-purple-400`} />;
            default:
                return <Sun className={`${size} text-yellow-400`} />;
        }
    };

    // Get current time and format hourly forecast
    const now = new Date();
    const currentHour = now.getHours();
    
    // Get hourly forecast with past and future hours
    const getHourlyForecast = () => {
        if (!hourly || !hourly.time || !hourly.temperature_2m) {
            return [];
        }
        
        const forecasts = [];
        let currentIndex = -1;
        
        // Find the current hour index
        for (let i = 0; i < hourly.time.length; i++) {
            const time = new Date(hourly.time[i]);
            if (time.getHours() === currentHour && time.toDateString() === now.toDateString()) {
                currentIndex = i;
                break;
            }
        }
        
        // If we can't find current hour, find the closest future hour
        if (currentIndex === -1) {
            for (let i = 0; i < hourly.time.length; i++) {
                const time = new Date(hourly.time[i]);
                if (time >= now) {
                    currentIndex = i;
                    break;
                }
            }
        }
        
        if (currentIndex === -1) return [];
        
        // Get 3 hours before, current, and 3 hours after
        const startIndex = Math.max(0, currentIndex - 3);
        const endIndex = Math.min(hourly.time.length - 1, currentIndex + 3);
        
        for (let i = startIndex; i <= endIndex; i++) {
            const time = new Date(hourly.time[i]);
            const hour = time.getHours();
            const isNow = i === currentIndex;
            
            forecasts.push({
                time: isNow ? 'Now' : `${hour % 12 || 12}${hour >= 12 ? 'PM' : 'AM'}`,
                temp: Math.round(hourly.temperature_2m[i]),
                code: hourly.weather_code ? hourly.weather_code[i] : current.weather_code,
                isNow: isNow,
                isPast: i < currentIndex
            });
        }
        
        return forecasts;
    };

    const hourlyForecast = getHourlyForecast();

    return (
        <div className="rounded-xl p-4 shadow-lg my-2 animate-in fade-in duration-500 w-[80%] max-w-3xl" style={{ backgroundColor: '#2d2d2d', color: '#e5e7eb' }}>
            {/* Current Weather Section - Compact Horizontal */}
            <div className="flex items-center justify-between gap-6 mb-4">
                {/* Left: Icon, Temp, Location */}
                <div className="flex items-center gap-3">
                    <div className="shrink-0">
                        {getWeatherIcon(current.weather_code, "w-12 h-12")}
                    </div>
                    
                    <div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold">{Math.round(current.temperature_2m)}°</span>
                            <span className="text-sm" style={{ color: '#9ca3af' }}>{current_units.temperature_2m}</span>
                        </div>
                        <h3 className="text-base font-semibold">{cityName}{country && `, ${country}`}</h3>
                        <p className="text-xs capitalize" style={{ color: '#9ca3af' }}>
                            {current.weather_description || getWeatherDescription(current.weather_code)}
                        </p>
                    </div>
                </div>

                {/* Right: High/Low */}
                <div className="text-right">
                    <p className="text-xs" style={{ color: '#9ca3af' }}>High / Low</p>
                    <p className="text-sm font-semibold">
                        {daily?.temperature_2m_max?.[0] ? Math.round(daily.temperature_2m_max[0]) : '--'}° / 
                        {daily?.temperature_2m_min?.[0] ? Math.round(daily.temperature_2m_min[0]) : '--'}°
                    </p>
                </div>
            </div>

            {/* Hourly Forecast - Compact Horizontal */}
            {hourlyForecast.length > 0 && (
                <div className="border-t pt-3 mb-3" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <h4 className="text-xs font-semibold mb-2" style={{ color: '#9ca3af' }}>7-Hour Forecast</h4>
                    <div className="flex gap-1 justify-between">
                        {hourlyForecast.map((hour, index) => (
                            <div
                                key={index}
                                className="flex flex-col items-center gap-1 flex-1 px-2 py-2 rounded-lg transition-all backdrop-blur-sm"
                                style={{
                                    backgroundColor: hour.isNow 
                                        ? 'rgba(59, 130, 246, 0.3)' 
                                        : hour.isPast 
                                            ? 'rgba(255, 255, 255, 0.05)' 
                                            : 'rgba(255, 255, 255, 0.1)',
                                    border: hour.isNow ? '2px solid rgba(59, 130, 246, 0.5)' : 'none',
                                    opacity: hour.isPast ? 0.6 : 1
                                }}
                            >
                                <span className={`text-[10px] font-medium ${hour.isNow ? 'font-bold' : ''}`}>
                                    {hour.time}
                                </span>
                                {getWeatherIcon(hour.code, "w-6 h-6")}
                                <span className={`text-xs font-semibold ${hour.isNow ? 'font-bold' : ''}`}>
                                    {hour.temp}°
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Weather Details Grid - Compact */}
            <div className="grid grid-cols-4 gap-3 pt-3 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                {current.wind_speed_10m !== undefined && (
                    <div className="flex items-center gap-1.5 text-sm">
                        <Wind className="w-4 h-4 shrink-0" style={{ color: '#60a5fa' }} />
                        <div>
                            <p className="text-[10px]" style={{ color: '#9ca3af' }}>Wind</p>
                            <p className="text-xs font-semibold">
                                {current.wind_speed_10m} {current_units.wind_speed_10m || 'km/h'}
                            </p>
                        </div>
                    </div>
                )}

                {current.relative_humidity_2m !== undefined && (
                    <div className="flex items-center gap-1.5 text-sm">
                        <Droplets className="w-4 h-4 shrink-0" style={{ color: '#60a5fa' }} />
                        <div>
                            <p className="text-[10px]" style={{ color: '#9ca3af' }}>Humidity</p>
                            <p className="text-xs font-semibold">{current.relative_humidity_2m}%</p>
                        </div>
                    </div>
                )}

                {daily?.sunrise?.[0] && (
                    <div className="flex items-center gap-1.5 text-sm">
                        <Sun className="w-4 h-4 shrink-0" style={{ color: '#fbbf24' }} />
                        <div>
                            <p className="text-[10px]" style={{ color: '#9ca3af' }}>Sunrise</p>
                            <p className="text-xs font-semibold">
                                {new Date(daily.sunrise[0]).toLocaleTimeString('en-US', { 
                                    hour: 'numeric', 
                                    minute: '2-digit',
                                    hour12: true 
                                })}
                            </p>
                        </div>
                    </div>
                )}

                {daily?.sunset?.[0] && (
                    <div className="flex items-center gap-1.5 text-sm">
                        <Sun className="w-4 h-4 shrink-0" style={{ color: '#fb923c' }} />
                        <div>
                            <p className="text-[10px]" style={{ color: '#9ca3af' }}>Sunset</p>
                            <p className="text-xs font-semibold">
                                {new Date(daily.sunset[0]).toLocaleTimeString('en-US', { 
                                    hour: 'numeric', 
                                    minute: '2-digit',
                                    hour12: true 
                                })}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
