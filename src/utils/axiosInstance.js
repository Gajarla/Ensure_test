import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL, // or your domain
  withCredentials: true, // include cookies & credentials
  headers: {
    'Content-Type': 'application/json'
  }
});

export default axiosInstance;
