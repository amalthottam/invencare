import "./global.css";

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Amplify } from "aws-amplify";
import { getCurrentUser, signOut } from "aws-amplify/auth";
import awsConfig from "./aws-config";

// Components
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductInfo from "./pages/ProductInfo";
import Forecasting from "./pages/Forecasting";
import Settings from "./pages/Settings";
import Transactions from "./pages/Transactions";
import NotFound from "./pages/NotFound";

// Configure Amplify
Amplify.configure(awsConfig);

const queryClient = new QueryClient();

const App = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [storeAccess, setStoreAccess] = useState([]);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Get user attributes
      const attributes = currentUser.attributes || {};
      setUserRole(attributes["custom:role"] || "employee");
      setStoreAccess(
        attributes["custom:store_access"]
          ? attributes["custom:store_access"].split(",")
          : [],
      );
    } catch (error) {
      console.log("No authenticated user found");
      setUser(null);
      setUserRole(null);
      setStoreAccess([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setUserRole(null);
      setStoreAccess([]);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route
            path="/login"
            element={<Login onAuthChange={checkAuthState} />}
          />
          {user ? (
            <>
              <Route
                path="/dashboard"
                element={
                  <Dashboard
                    user={user}
                    userRole={userRole}
                    storeAccess={storeAccess}
                    onSignOut={handleSignOut}
                  />
                }
              />
              <Route
                path="/products"
                element={
                  <Products
                    user={user}
                    userRole={userRole}
                    storeAccess={storeAccess}
                    onSignOut={handleSignOut}
                  />
                }
              />
              <Route
                path="/products/:id"
                element={
                  <ProductInfo
                    user={user}
                    userRole={userRole}
                    storeAccess={storeAccess}
                    onSignOut={handleSignOut}
                  />
                }
              />
              <Route
                path="/products/:id/edit"
                element={
                  <ProductInfo
                    user={user}
                    userRole={userRole}
                    storeAccess={storeAccess}
                    onSignOut={handleSignOut}
                  />
                }
              />
              <Route
                path="/forecasting"
                element={
                  <Forecasting
                    user={user}
                    userRole={userRole}
                    storeAccess={storeAccess}
                    onSignOut={handleSignOut}
                  />
                }
              />
              <Route
                path="/settings"
                element={
                  <Settings
                    user={user}
                    userRole={userRole}
                    storeAccess={storeAccess}
                    onSignOut={handleSignOut}
                  />
                }
              />
              <Route
                path="/transactions"
                element={
                  <Transactions
                    user={user}
                    userRole={userRole}
                    storeAccess={storeAccess}
                    onSignOut={handleSignOut}
                  />
                }
              />
            </>
          ) : (
            <Route path="*" element={<Login onAuthChange={checkAuthState} />} />
          )}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

createRoot(document.getElementById("root")).render(<App />);
