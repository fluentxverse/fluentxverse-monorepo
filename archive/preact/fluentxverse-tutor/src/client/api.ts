// Axios API root for client usage
// Uses the shared, HTTPS-safe API_BASE_URL from config
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export const api = axios.create({
	baseURL: API_BASE_URL,
	withCredentials: true
});
