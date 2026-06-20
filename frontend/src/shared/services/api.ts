import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true, // Always send HttpOnly cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// On 401, redirect to login — but only if not already there or on the landing page
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      window.location.pathname !== "/login" &&
      window.location.pathname !== "/"
    ) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
