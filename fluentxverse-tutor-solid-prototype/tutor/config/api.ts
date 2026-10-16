import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { productionEndpoints, tutorEndpoints } from './productionDomains';
// API Configuration
// IMPORTANT: Never default to an http:// API when the page is served over https://
// (browsers will block it as Mixed Content).
// Each production domain uses its own API host to keep session cookies same-site.
export const isProductionHost = (hostname: string) => Boolean(productionEndpoints(hostname));
const getApiBaseUrl = () => {
    const hostname = typeof window === 'undefined' ? '' : window.location?.hostname || '';
    return tutorEndpoints(hostname, import.meta.env.VITE_TUTOR_API_URL).apiUrl;
};
export const API_BASE_URL = getApiBaseUrl();
export const API_CONFIG = {
    BASE_URL: getApiBaseUrl(),
    ENDPOINTS: {
        STUDENTS: '/api/students',
        SESSIONS: '/api/sessions'
    },
    TIMEOUT: 10000
};
// Helper function to get auth token
export const getAuthToken = (): string | null => {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
};
// Helper function to get API headers
export const getApiHeaders = (includeAuth = true): HeadersInit => {
    const headers: HeadersInit = {
        'Content-Type': 'application/json'
    };
    if (includeAuth) {
        const token = getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    return headers;
};
// Helper function to handle API responses
export const handleApiResponse = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
        try {
            const errorData = JSON.parse(errorText);
            if (errorData.error) {
                errorMessage = errorData.error;
            }
        }
        catch {
            // If it's not JSON, use the text as error message
            if (errorText) {
                errorMessage = errorText;
            }
        }
        if (response.status === 401) {
            errorMessage = 'Unauthorized. Please log in again.';
        }
        throw new Error(errorMessage);
    }
    const data: T = await response.json();
    return data;
};
