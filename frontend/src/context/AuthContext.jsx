import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user on mount if token exists
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const response = await authAPI.getMe();
          setUser(response.data);
          localStorage.setItem("user", JSON.stringify(response.data));
        } catch (err) {
          console.error("Failed to load user:", err);
          // Token is invalid, clear it
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, [token]);

  const login = useCallback(async (credentials) => {
    setError(null);
    setLoading(true);

    try {
      const response = await authAPI.login(credentials);
      const { access_token } = response.data;

      // Store token
      localStorage.setItem("token", access_token);
      setToken(access_token);

      // Fetch user info (pass token directly to avoid race condition)
      const userResponse = await authAPI.getMe(access_token);
      setUser(userResponse.data);
      localStorage.setItem("user", JSON.stringify(userResponse.data));

      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.detail || "Login failed. Please try again.";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (userData) => {
      setError(null);
      setLoading(true);

      try {
        // Register the user
        await authAPI.register(userData);

        // Auto-login after registration
        const loginResult = await login({
          username: userData.username,
          password: userData.password,
        });

        return loginResult;
      } catch (err) {
        const message =
          err.response?.data?.detail ||
          "Registration failed. Please try again.";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [login],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const updateUser = useCallback(async (updateData) => {
    setError(null);

    try {
      const response = await authAPI.updateProfile(updateData);
      setUser(response.data);
      localStorage.setItem("user", JSON.stringify(response.data));
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.detail || "Failed to update profile.";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    updateUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
