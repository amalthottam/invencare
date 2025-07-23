import "./global.css";

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductInfo from "./pages/ProductInfo";
import Forecasting from "./pages/Forecasting";
import Settings from "./pages/Settings";
import Transactions from "./pages/Transactions";
import NotFound from "./pages/NotFound";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/lib/auth-context";
import ProtectedRoute from "./components/ProtectedRoute";

// AWS Cognito Integration
import { Amplify } from 'aws-amplify';
import { getCurrentUser } from 'aws-amplify/auth';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_FW7AOCFuJ',
      userPoolClientId: '2l941887qehovv1b3i24a42rib',
      region: 'us-east-1',
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
        username: false,
        phone: false
      },
      userAttributes: {
        email: {
          required: true
        }
      },
      allowGuestAccess: true,
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true
      }
    }
  }
});

const queryClient = new QueryClient();

const App = () => {
  // AWS Cognito Authentication State Management
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      console.log('Current user found:', currentUser);
    } catch (error) {
      console.log('No authenticated user found');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/products/:id" element={<ProtectedRoute><ProductInfo /></ProtectedRoute>} />
            <Route path="/products/:id/edit" element={<ProtectedRoute><ProductInfo /></ProtectedRoute>} />
            <Route path="/forecasting" element={<ProtectedRoute><Forecasting /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

// Only create root if it doesn't exist to prevent double initialization
const container = document.getElementById("root");
let root = container._reactRoot;

if (!root) {
  root = createRoot(container);
  container._reactRoot = root;
}

root.render(<App />);
