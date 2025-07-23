import React, { createContext, useContext, useState, useEffect } from "react";
import { getCurrentUser, fetchUserAttributes, signOut } from "aws-amplify/auth";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userAttributes, setUserAttributes] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      const currentUser = await getCurrentUser();

      if (currentUser) {
        const attributes = await fetchUserAttributes();

        // Validate user status
        const userStatus = attributes["custom:status"] || "active";

        if (userStatus === "inactive" || userStatus === "suspended") {
          console.log("User account is inactive, signing out");
          await signOut();
          setUser(null);
          setUserAttributes(null);
          setIsAuthenticated(false);
          return;
        }

        if (userStatus === "pending") {
          console.log("User account is pending approval");
          await signOut();
          setUser(null);
          setUserAttributes(null);
          setIsAuthenticated(false);
          return;
        }

        setUser(currentUser);
        setUserAttributes(attributes);
        setIsAuthenticated(true);
        console.log("User authenticated:", currentUser.username);
      } else {
        setUser(null);
        setUserAttributes(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.log("No authenticated user found");
      setUser(null);
      setUserAttributes(null);
      setIsAuthenticated(false);
      // Clean up any demo auth remnants
      localStorage.removeItem("isAuthenticated");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
      setUserAttributes(null);
      setIsAuthenticated(false);
      console.log("User signed out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
      // Force logout
      setUser(null);
      setUserAttributes(null);
      setIsAuthenticated(false);
    }
  };

  const getUserRole = () => {
    return userAttributes?.["custom:role"] || "employee";
  };

  const getStoreAccess = () => {
    return userAttributes?.["custom:store_access"] || "";
  };

  const getUserDisplayName = () => {
    if (!userAttributes) return "User";

    const firstName = userAttributes.given_name || userAttributes.name || "";
    const lastName = userAttributes.family_name || "";

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else {
      return user?.username || "User";
    }
  };

  const hasStoreAccess = (storeId) => {
    const storeAccess = getStoreAccess();

    if (!storeAccess) return false;
    if (storeAccess === "all") return true;

    const accessibleStores = storeAccess.split(",").map((s) => s.trim());
    return accessibleStores.includes(storeId);
  };

  const value = {
    user,
    userAttributes,
    isLoading,
    isAuthenticated,
    checkAuthState,
    logout,
    getUserRole,
    getStoreAccess,
    getUserDisplayName,
    hasStoreAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
