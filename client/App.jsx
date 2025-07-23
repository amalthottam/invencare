import "./global.css";

import React from "react";
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

// AWS Cognito Integration
// import { Amplify } from 'aws-amplify';
// import { getCurrentUser } from 'aws-amplify/auth';
//
// Amplify.configure({
//   Auth: {
//     Cognito: {
//       userPoolId: 'us-east-1_XXXXXXXXX',
//       userPoolClientId: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
//       region: 'us-east-1',
//       signUpVerificationMethod: 'code',
//       loginWith: {
//         email: true,
//         username: false,
//         phone: false
//       },
//       userAttributes: {
//         email: {
//           required: true
//         }
//       },
//       allowGuestAccess: true,
//       passwordFormat: {
//         minLength: 8,
//         requireLowercase: true,
//         requireUppercase: true,
//         requireNumbers: true,
//         requireSpecialCharacters: true
//       }
//     }
//   }
// });

const queryClient = new QueryClient();

const App = () => {
  // AWS Cognito Authentication State Management
  // const [user, setUser] = useState(null);
  // const [isLoading, setIsLoading] = useState(true);
  //
  // useEffect(() => {
  //   checkAuthState();
  // }, []);
  //
  // const checkAuthState = async () => {
  //   try {
  //     const currentUser = await getCurrentUser();
  //     setUser(currentUser);
  //   } catch (error) {
  //     console.log('No authenticated user found');
  //     setUser(null);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductInfo />} />
          <Route path="/products/:id/edit" element={<ProductInfo />} />
          <Route path="/forecasting" element={<Forecasting />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/transactions" element={<Transactions />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
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
