// Axios client — same pattern as last project
// Automatically attaches the JWT token to every request via an interceptor.
// All API calls in the app import from here instead of using axios directly.

import axios from "axios";

const client = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:3000",
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
