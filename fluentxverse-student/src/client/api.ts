// Axios API root for client usage
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export const api = axios.create({
	baseURL: API_BASE_URL,
	withCredentials: true
});

// Interceptors to log request timing and emit UI event
api.interceptors.request.use((config) => {
	// Attach a high-resolution start time
	(config as any).meta = { startTime: performance.now(), sentAt: new Date().toISOString() };
	return config;
});

api.interceptors.response.use(
	(response) => {
		const meta = (response.config as any).meta || {};
		const endTime = performance.now();
		const receivedAt = new Date().toISOString();
		const totalMs = endTime - (meta.startTime || endTime);

		// Console log for developers
		// eslint-disable-next-line no-console
		console.log(
			`[API Timing] ${response.config.method?.toUpperCase()} ${response.config.url} — sent: ${meta.sentAt}, received: ${receivedAt}, total: ${totalMs.toFixed(0)} ms`
		);

		// Emit a browser event so UI can display the latest timing
		if (typeof window !== 'undefined') {
			window.dispatchEvent(
				new CustomEvent('api-timing', {
					detail: {
						method: response.config.method?.toUpperCase() || 'GET',
						url: response.config.url || '',
						sentAt: meta.sentAt,
						receivedAt,
						durationMs: Math.round(totalMs)
					}
				})
			);
		}
		return response;
	},
	(error) => {
		const cfg = error.config || {};
		const meta = (cfg as any).meta || {};
		const endTime = performance.now();
		const receivedAt = new Date().toISOString();
		const totalMs = endTime - (meta.startTime || endTime);

		// eslint-disable-next-line no-console
		console.warn(
			`[API Timing] ${cfg.method?.toUpperCase() || 'REQUEST'} ${cfg.url || ''} — sent: ${meta.sentAt}, received: ${receivedAt}, total: ${totalMs.toFixed(0)} ms (error)`
		);

		if (typeof window !== 'undefined') {
			window.dispatchEvent(
				new CustomEvent('api-timing', {
					detail: {
						method: cfg.method?.toUpperCase() || 'REQUEST',
						url: cfg.url || '',
						sentAt: meta.sentAt,
						receivedAt,
						durationMs: Math.round(totalMs),
						error: true
					}
				})
			);
		}
		return Promise.reject(error);
	}
);
