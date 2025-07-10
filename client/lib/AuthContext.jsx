import React, { createContext, useContext, useReducer, useEffect } from "react";
import authService from "./auth";

// Auth state management
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  tokens: null,
};

// Auth reducer
function authReducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_USER":
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        tokens: action.payload.tokens,
        isLoading: false,
        error: null,
      };
    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    case "CLEAR_USER":
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        tokens: null,
        error: null,
        isLoading: false,
      };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

// Create context
const AuthContext = createContext();

// Auth provider component
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const isAuthenticated = await authService.checkAuthState();
      if (isAuthenticated) {
        const userResult = await authService.getCurrentUser();
        const sessionResult = await authService.fetchUserSession();

        if (userResult.success && sessionResult.success) {
          dispatch({
            type: "SET_USER",
            payload: {
              user: userResult.user,
              tokens: sessionResult.tokens,
            },
          });
        } else {
          dispatch({ type: "CLEAR_USER" });
        }
      } else {
        dispatch({ type: "CLEAR_USER" });
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      dispatch({ type: "SET_ERROR", payload: error.message });
      dispatch({ type: "CLEAR_USER" });
    }
  };

  const signUp = async (username, password, email, name) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });

    try {
      const result = await authService.signUp(username, password, email, name);
      dispatch({ type: "SET_LOADING", payload: false });

      if (!result.success) {
        dispatch({ type: "SET_ERROR", payload: result.error });
      }

      return result;
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, error: error.message };
    }
  };

  const confirmSignUp = async (username, confirmationCode) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });

    try {
      const result = await authService.confirmSignUp(
        username,
        confirmationCode,
      );
      dispatch({ type: "SET_LOADING", payload: false });

      if (!result.success) {
        dispatch({ type: "SET_ERROR", payload: result.error });
      }

      return result;
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, error: error.message };
    }
  };

  const signIn = async (username, password) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });

    try {
      const result = await authService.signIn(username, password);

      if (result.success && result.isSignedIn) {
        const userResult = await authService.getCurrentUser();
        const sessionResult = await authService.fetchUserSession();

        if (userResult.success && sessionResult.success) {
          dispatch({
            type: "SET_USER",
            payload: {
              user: userResult.user,
              tokens: sessionResult.tokens,
            },
          });
        }
      } else if (!result.success) {
        dispatch({ type: "SET_ERROR", payload: result.error });
        dispatch({ type: "SET_LOADING", payload: false });
      }

      return result;
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const result = await authService.signOut();
      dispatch({ type: "CLEAR_USER" });
      return result;
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, error: error.message };
    }
  };

  const resetPassword = async (username) => {
    dispatch({ type: "CLEAR_ERROR" });

    try {
      const result = await authService.resetPassword(username);

      if (!result.success) {
        dispatch({ type: "SET_ERROR", payload: result.error });
      }

      return result;
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
      return { success: false, error: error.message };
    }
  };

  const confirmResetPassword = async (
    username,
    confirmationCode,
    newPassword,
  ) => {
    dispatch({ type: "CLEAR_ERROR" });

    try {
      const result = await authService.confirmResetPassword(
        username,
        confirmationCode,
        newPassword,
      );

      if (!result.success) {
        dispatch({ type: "SET_ERROR", payload: result.error });
      }

      return result;
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
      return { success: false, error: error.message };
    }
  };

  const updatePassword = async (oldPassword, newPassword) => {
    dispatch({ type: "CLEAR_ERROR" });

    try {
      const result = await authService.updatePassword(oldPassword, newPassword);

      if (!result.success) {
        dispatch({ type: "SET_ERROR", payload: result.error });
      }

      return result;
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
      return { success: false, error: error.message };
    }
  };

  const deleteUser = async () => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const result = await authService.deleteUser();

      if (result.success) {
        dispatch({ type: "CLEAR_USER" });
      } else {
        dispatch({ type: "SET_ERROR", payload: result.error });
        dispatch({ type: "SET_LOADING", payload: false });
      }

      return result;
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
      dispatch({ type: "SET_LOADING", payload: false });
      return { success: false, error: error.message };
    }
  };

  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  const getIdToken = async () => {
    return await authService.getIdToken();
  };

  const getAccessToken = async () => {
    return await authService.getAccessToken();
  };

  const value = {
    ...state,
    signUp,
    confirmSignUp,
    signIn,
    signOut,
    resetPassword,
    confirmResetPassword,
    updatePassword,
    deleteUser,
    clearError,
    getIdToken,
    getAccessToken,
    refreshAuth: checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
