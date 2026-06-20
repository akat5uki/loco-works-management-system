import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true, // Always send HttpOnly cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// On 401, redirect to session expired page — but only if not already there or on landing/login pages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      window.location.pathname !== "/login" &&
      window.location.pathname !== "/session-expired" &&
      window.location.pathname !== "/"
    ) {
      window.location.href = "/session-expired";
    }
    return Promise.reject(error);
  },
);

export default api;
