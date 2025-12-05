// Axios API root for client usage
import axios from 'axios';

// Dynamically determine API host - use same host as the page but on port 8765
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return `http://${host}:8765`;
  }
  return 'http://localhost:8765';
};

export const api = axios.create({
	baseURL: getApiBaseUrl(),
	withCredentials: true
});
