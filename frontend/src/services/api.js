import axios from "axios";

// Create axios instance with base configuration
const api = axios.create({
  baseURL: "/api",
  timeout: 30000, // 30 second timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Helper to create config with specific token (for use right after login)
const createAuthConfig = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// Request interceptor to add auth token and handle content type
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Don't override Content-Type for FormData (let browser set it with boundary)
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
  },
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors
    if (!error.response) {
      console.error("Network error:", error.message);
      return Promise.reject({
        response: {
          data: { detail: "Network error. Please check your connection." },
        },
      });
    }

    // Handle 401 Unauthorized - clear token and redirect to login
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      // Don't redirect if already on login/register pages
      if (currentPath !== "/login" && currentPath !== "/register") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }

    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers["retry-after"];
      error.response.data = {
        detail: `Too many requests. Please try again ${retryAfter ? `in ${retryAfter} seconds` : "later"}.`,
      };
    }

    return Promise.reject(error);
  },
);

// Auth API
export const authAPI = {
  register: (userData) => api.post("/auth/register", userData),

  login: (credentials) => {
    const formData = new URLSearchParams();
    formData.append("username", credentials.username);
    formData.append("password", credentials.password);
    return api.post("/auth/login", formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  },

  // Accept optional token parameter for use immediately after login
  getMe: (token = null) => {
    if (token) {
      return api.get("/auth/me", createAuthConfig(token));
    }
    return api.get("/auth/me");
  },

  updateProfile: (data) => api.put("/auth/me", data),

  getUserById: (userId) => api.get(`/auth/user/${userId}`),

  getUserByUsername: (username) => api.get(`/auth/user/username/${username}`),
};

// Posts API
export const postsAPI = {
  getFeed: (page = 1, pageSize = 20) =>
    api.get("/posts", { params: { page, page_size: pageSize } }),

  getPost: (postId) => api.get(`/posts/${postId}`),

  createPost: (content, image = null) => {
    const formData = new FormData();
    formData.append("content", content);
    if (image) {
      formData.append("image", image);
    }
    return api.post("/posts", formData);
  },

  updatePost: (postId, content) => {
    const formData = new FormData();
    formData.append("content", content);
    return api.put(`/posts/${postId}`, formData);
  },

  deletePost: (postId) => api.delete(`/posts/${postId}`),

  getUserPosts: (userId, page = 1, pageSize = 20) =>
    api.get(`/posts/user/${userId}`, { params: { page, page_size: pageSize } }),
};

// Comments API
export const commentsAPI = {
  getPostComments: (postId) => api.get(`/comments/post/${postId}`),

  createComment: (postId, content) =>
    api.post(`/comments/${postId}`, { content }),

  updateComment: (commentId, content) =>
    api.put(`/comments/${commentId}`, { content }),

  deleteComment: (commentId) => api.delete(`/comments/${commentId}`),
};

// Likes API
export const likesAPI = {
  likePost: (postId) => api.post(`/likes/${postId}`),

  unlikePost: (postId) => api.delete(`/likes/${postId}`),

  toggleLike: (postId) => api.post(`/likes/${postId}/toggle`),

  getLikeStatus: (postId) => api.get(`/likes/${postId}/status`),
};

// Health check
export const healthAPI = {
  check: () => api.get("/health"),
};

export default api;
