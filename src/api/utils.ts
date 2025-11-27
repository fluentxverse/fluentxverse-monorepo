import axios from 'axios'

// Configure Axios client to send cookies with requests
export const client = axios.create({
  baseURL: 'http://localhost:8765',
  withCredentials: true
})