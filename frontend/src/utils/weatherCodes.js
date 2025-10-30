/**
 * Weather code mappings for Open-Meteo API
 * These codes are standardized by Open-Meteo and map to WMO Weather interpretation codes
 * https://open-meteo.com/en/docs
 */

export const weatherCodes = {
    0: { description: "Clear sky", icon: "sun" },
    1: { description: "Mainly clear", icon: "sun" },
    2: { description: "Partly cloudy", icon: "cloud-sun" },
    3: { description: "Overcast", icon: "cloud" },
    45: { description: "Foggy", icon: "cloud-fog" },
    48: { description: "Depositing rime fog", icon: "cloud-fog" },
    51: { description: "Light drizzle", icon: "cloud-drizzle" },
    53: { description: "Moderate drizzle", icon: "cloud-drizzle" },
    55: { description: "Dense drizzle", icon: "cloud-rain" },
    56: { description: "Light freezing drizzle", icon: "cloud-drizzle" },
    57: { description: "Dense freezing drizzle", icon: "cloud-rain" },
    61: { description: "Slight rain", icon: "cloud-rain" },
    63: { description: "Moderate rain", icon: "cloud-rain" },
    65: { description: "Heavy rain", icon: "cloud-rain" },
    66: { description: "Light freezing rain", icon: "cloud-rain" },
    67: { description: "Heavy freezing rain", icon: "cloud-rain" },
    71: { description: "Slight snow", icon: "snowflake" },
    73: { description: "Moderate snow", icon: "snowflake" },
    75: { description: "Heavy snow", icon: "snowflake" },
    77: { description: "Snow grains", icon: "snowflake" },
    80: { description: "Slight rain showers", icon: "cloud-rain" },
    81: { description: "Moderate rain showers", icon: "cloud-rain" },
    82: { description: "Violent rain showers", icon: "cloud-rain" },
    85: { description: "Slight snow showers", icon: "snowflake" },
    86: { description: "Heavy snow showers", icon: "snowflake" },
    95: { description: "Thunderstorm", icon: "cloud-lightning" },
    96: { description: "Thunderstorm with slight hail", icon: "cloud-lightning" },
    99: { description: "Thunderstorm with heavy hail", icon: "cloud-lightning" },
};

/**
 * Get weather description from code
 * @param {number} code - Weather code
 * @returns {string} Weather description
 */
export const getWeatherDescription = (code) => {
    if (code === undefined || code === null) return "Clear";
    const codes = Object.keys(weatherCodes).map(Number).sort((a, b) => b - a);
    const matchedCode = codes.find(c => code >= c) || 0;
    return weatherCodes[matchedCode]?.description || "Clear";
};

/**
 * Get weather icon type from code
 * @param {number} code - Weather code
 * @returns {string} Icon type
 */
export const getWeatherIconType = (code) => {
    if (code === undefined || code === null) return "sun";
    const codes = Object.keys(weatherCodes).map(Number).sort((a, b) => b - a);
    const matchedCode = codes.find(c => code >= c) || 0;
    return weatherCodes[matchedCode]?.icon || "sun";
};
