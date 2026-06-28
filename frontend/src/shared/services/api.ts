import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  withCredentials: true, // Always send HttpOnly cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// On 401, redirect to session expired or admin login page based on context
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const pathname = window.location.pathname;
      // Do not redirect if already on login/expired pages
      if (
        pathname !== "/login" &&
        pathname !== "/admin/login" &&
        pathname !== "/session-expired" &&
        pathname !== "/"
      ) {
        if (pathname.startsWith("/admin")) {
          window.location.href = "/admin/login";
        } else {
          window.location.href = "/session-expired";
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;
