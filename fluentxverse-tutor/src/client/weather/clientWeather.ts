//** API EDEN TREATY IMPORT */
import { refreshAccessToken } from "@/client/tokenRefresh";
import { api } from "../api";

//** TYPE INTERFACE */
import type { WeatherData, ForecastData } from "@server/weather.services/weather.interface";


export async function getCookie(name: string): Promise<string | undefined> {
    // First try to get the cookie
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    let value = match ? decodeURIComponent(match[2]) : undefined;
    

    console.log("tae value", value)
    // If cookie is missing or empty, try to refresh the token
    if (!value) {
        console.log("value is empty")   
        console.debug(`[getCookie] ${name} cookie not found or empty, attempting token refresh`);
        try {
            await refreshAccessToken();
            
            // Try to get the cookie again after refresh
            const newMatch = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            value = newMatch ? decodeURIComponent(newMatch[2]) : undefined;
            
            if (!value) {
                console.warn(`[getCookie] ${name} still not available after token refresh`);
            }
        } catch (error) {
            console.error('[getCookie] Error during token refresh:', error);
            // Re-throw the error to be handled by the caller
            throw error;
        }
    }
    
    return value;
}

export async function getCurrentWeather(location: string): Promise<WeatherData | Error> {
    try {
        const cookie = await getCookie("accessToken");
        
        const res = await api.weather.current({ location }).get({
            headers: { authorization: `Bearer ${cookie}` },
        });
        if (!res.data) throw new Error("Failed to fetch current weather");
        return res.data as WeatherData;
    } catch (error) {
        return error as Error;
    }
}

export async function getForecastWeather(location: string): Promise<ForecastData | Error> {
    try {
        const cookie = await getCookie("accessToken");
        const res = await api.weather.forecast({ location }).get({
            headers: { authorization: `Bearer ${cookie}` },
        });
        if (!res.data) throw new Error("Failed to fetch weather forecast");
        return res.data as ForecastData;
    } catch (error) {
        return error as Error;
    }
}