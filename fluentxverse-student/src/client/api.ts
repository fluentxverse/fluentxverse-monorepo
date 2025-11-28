// Axios API root for client usage
import axios from 'axios';

export const api = axios.create({
	baseURL: 'http://localhost:8765',
	withCredentials: true
});
