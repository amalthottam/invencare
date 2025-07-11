# AWS Cognito Setup and Login Implementation Guide

This guide provides complete instructions for setting up AWS Cognito authentication for the inventory management system and implementing a secure login screen.

## Overview

AWS Cognito provides user authentication, authorization, and user management for your web applications. This setup includes:

- User pools for authentication
- Role-based access control
- Secure login/logout functionality
- User management features

## Prerequisites

- AWS CLI installed and configured
- AWS account with appropriate permissions
- Node.js application setup

## Part 1: AWS Cognito Setup

### 1. Create User Pool

```bash
# Create user pool
aws cognito-idp create-user-pool \
  --pool-name "InvenCare-UserPool" \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  }' \
  --auto-verified-attributes email \
  --username-attributes email \
  --schema '[
    {
      "Name": "email",
      "AttributeDataType": "String",
      "Required": true,
      "Mutable": true
    },
    {
      "Name": "name",
      "AttributeDataType": "String",
      "Required": true,
      "Mutable": true
    },
    {
      "Name": "custom:role",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "custom:store_access",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    }
  ]' \
  --admin-create-user-config '{
    "AllowAdminCreateUserOnly": false,
    "InviteMessageAction": "EMAIL"
  }'

# Note the UserPoolId from the response
```

### 2. Create User Pool Client

```bash
# Create user pool client
aws cognito-idp create-user-pool-client \
  --user-pool-id us-east-1_XXXXXXXXX \
  --client-name "InvenCare-WebApp" \
  --generate-secret \
  --supported-identity-providers COGNITO \
  --callback-urls "http://localhost:8080/dashboard,https://yourdomain.com/dashboard" \
  --logout-urls "http://localhost:8080/login,https://yourdomain.com/login" \
  --allowed-o-auth-flows authorization_code_grant \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client \
  --explicit-auth-flows ADMIN_NO_SRP_AUTH USER_PASSWORD_AUTH \
  --prevent-user-existence-errors ENABLED

# Note the ClientId and ClientSecret from the response
```

### 3. Create Identity Pool

```bash
# Create identity pool
aws cognito-identity create-identity-pool \
  --identity-pool-name "InvenCare_IdentityPool" \
  --allow-unauthenticated-identities \
  --cognito-identity-providers ProviderName=cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX,ClientId=YOUR_CLIENT_ID
```

### 4. Create IAM Roles for Cognito

```bash
# Create authenticated user role
cat > cognito-authenticated-role-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "YOUR_IDENTITY_POOL_ID"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "authenticated"
        }
      }
    }
  ]
}
EOF

aws iam create-role \
  --role-name InvenCare_AuthenticatedRole \
  --assume-role-policy-document file://cognito-authenticated-role-trust-policy.json

# Create policy for authenticated users
cat > cognito-authenticated-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:*:*:function:invencare-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "execute-api:Invoke"
      ],
      "Resource": "arn:aws:execute-api:*:*:*"
    }
  ]
}
EOF

aws iam create-policy \
  --policy-name InvenCare_AuthenticatedPolicy \
  --policy-document file://cognito-authenticated-policy.json

aws iam attach-role-policy \
  --role-name InvenCare_AuthenticatedRole \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/InvenCare_AuthenticatedPolicy
```

### 5. Create User Groups and Assign Roles

```bash
# Create admin group
aws cognito-idp create-group \
  --user-pool-id us-east-1_XXXXXXXXX \
  --group-name "admin" \
  --description "System administrators with full access" \
  --precedence 1

# Create manager group
aws cognito-idp create-group \
  --user-pool-id us-east-1_XXXXXXXXX \
  --group-name "manager" \
  --description "Store managers with store-specific access" \
  --precedence 2

# Create employee group
aws cognito-idp create-group \
  --user-pool-id us-east-1_XXXXXXXXX \
  --group-name "employee" \
  --description "Store employees with limited access" \
  --precedence 3
```

## Part 2: Frontend Implementation

### 1. Install Dependencies

```bash
npm install aws-amplify @aws-amplify/ui-react
```

### 2. Configure Amplify

Create `src/aws-config.js`:

```javascript
const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_XXXXXXXXX",
      userPoolClientId: "xxxxxxxxxxxxxxxxxxxxxxxxxx",
      region: "us-east-1",
      signUpVerificationMethod: "code",
      loginWith: {
        email: true,
        username: false,
        phone: false,
      },
      userAttributes: {
        email: {
          required: true,
        },
        name: {
          required: true,
        },
      },
      allowGuestAccess: false,
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
    },
  },
};

export default awsConfig;
```

### 3. Update App.jsx with Cognito Integration

```javascript
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
```

### 4. Create Enhanced Login Component

```javascript
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signIn,
  signUp,
  confirmSignUp,
  resendSignUpCode,
} from "aws-amplify/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Mail, Lock, User, ShoppingCart } from "lucide-react";

export default function Login({ onAuthChange }) {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    confirmationCode: "",
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await signIn({
        username: formData.email,
        password: formData.password,
      });

      setSuccess("Sign in successful!");
      onAuthChange();
      navigate("/dashboard");
    } catch (error) {
      console.error("Sign in error:", error);
      setError(error.message || "Failed to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await signUp({
        username: formData.email,
        password: formData.password,
        attributes: {
          email: formData.email,
          name: formData.name,
          "custom:role": "employee", // Default role
          "custom:store_access": "", // Will be set by admin
        },
      });

      setSuccess(
        "Account created! Please check your email for verification code.",
      );
      setNeedsConfirmation(true);
    } catch (error) {
      console.error("Sign up error:", error);
      setError(error.message || "Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSignUp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await confirmSignUp({
        username: formData.email,
        confirmationCode: formData.confirmationCode,
      });

      setSuccess("Email verified! You can now sign in.");
      setNeedsConfirmation(false);
      setIsSignUp(false);
      setFormData({ ...formData, confirmationCode: "" });
    } catch (error) {
      console.error("Confirmation error:", error);
      setError(error.message || "Failed to verify email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError("");

    try {
      await resendSignUpCode({ username: formData.email });
      setSuccess("Verification code resent! Please check your email.");
    } catch (error) {
      console.error("Resend code error:", error);
      setError(error.message || "Failed to resend code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-4">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">InvenCare</h1>
          <p className="text-gray-600 mt-2">Inventory Management System</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {needsConfirmation
                ? "Verify Email"
                : isSignUp
                  ? "Create Account"
                  : "Welcome Back"}
            </CardTitle>
            <CardDescription className="text-center">
              {needsConfirmation
                ? "Enter the verification code sent to your email"
                : isSignUp
                  ? "Create your InvenCare account"
                  : "Sign in to access your dashboard"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error/Success Messages */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {needsConfirmation ? (
              /* Email Confirmation Form */
              <form onSubmit={handleConfirmSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="confirmationCode">Verification Code</Label>
                  <Input
                    id="confirmationCode"
                    name="confirmationCode"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={formData.confirmationCode}
                    onChange={handleInputChange}
                    required
                    className="text-center text-lg tracking-wider"
                    maxLength={6}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  disabled={isLoading}
                >
                  {isLoading ? "Verifying..." : "Verify Email"}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    disabled={isLoading}
                  >
                    Resend verification code
                  </button>
                </div>
              </form>
            ) : isSignUp ? (
              /* Sign Up Form */
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Password must be at least 8 characters with uppercase,
                    lowercase, numbers, and symbols
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            ) : (
              /* Sign In Form */
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing In..." : "Sign In"}
                </Button>
              </form>
            )}

            {/* Toggle between Sign In/Sign Up */}
            {!needsConfirmation && (
              <div className="text-center pt-4 border-t">
                <p className="text-sm text-gray-600">
                  {isSignUp
                    ? "Already have an account?"
                    : "Don't have an account?"}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError("");
                      setSuccess("");
                      setFormData({
                        email: "",
                        password: "",
                        name: "",
                        confirmationCode: "",
                      });
                    }}
                    className="ml-1 text-blue-600 hover:text-blue-700 hover:underline font-medium"
                  >
                    {isSignUp ? "Sign In" : "Sign Up"}
                  </button>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Demo Credentials */}
        <div className="mt-6 p-4 bg-white/60 backdrop-blur-sm rounded-lg border">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Demo Credentials
          </h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p>
              <strong>Admin:</strong> admin@invencare.com / Admin123!
            </p>
            <p>
              <strong>Manager:</strong> manager@invencare.com / Manager123!
            </p>
            <p>
              <strong>Employee:</strong> employee@invencare.com / Employee123!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 5. Update Navigation Component with User Context

```javascript
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Settings,
  LogOut,
  User,
  Building,
  Brain,
} from "lucide-react";

const Navigation = ({ user, userRole, storeAccess, onSignOut }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    { name: "Dashboard", icon: Home, href: "/dashboard" },
    { name: "Products", icon: ShoppingCart, href: "/products" },
    { name: "Transactions", icon: Receipt, href: "/transactions" },
    { name: "Forecasting", icon: Brain, href: "/forecasting" },
    { name: "Settings", icon: Settings, href: "/settings" },
  ];

  const isActive = (href) => location.pathname === href;

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "manager":
        return "bg-blue-100 text-blue-800";
      case "employee":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 shadow-lg z-40">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">InvenCare</h1>
              <p className="text-sm text-gray-500">Inventory System</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        {user && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.attributes?.name || user.username}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user.attributes?.email}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge className={getRoleBadgeColor(userRole)}>
                {userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}
              </Badge>
              {storeAccess.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Building className="h-3 w-3 mr-1" />
                  {storeAccess.length} store{storeAccess.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <button
                    onClick={() => navigate(item.href)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      isActive(item.href)
                        ? "bg-blue-100 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <Button
            onClick={onSignOut}
            variant="ghost"
            className="w-full justify-start text-gray-700 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Navigation;
```

## Part 3: Role-Based Access Control

### 1. Create Access Control Hook

```javascript
// hooks/useAccessControl.js
import { useMemo } from "react";

export const useAccessControl = (userRole, storeAccess) => {
  return useMemo(() => {
    const isAdmin = userRole === "admin";
    const isManager = userRole === "manager";
    const isEmployee = userRole === "employee";

    return {
      // Page access
      canAccessDashboard: true,
      canAccessProducts: true,
      canAccessTransactions: true,
      canAccessForecasting: isAdmin || isManager,
      canAccessSettings: isAdmin || isManager,
      canAccessReports: isAdmin || isManager,

      // Feature access
      canCreateTransactions: true,
      canEditProducts: isAdmin || isManager,
      canDeleteProducts: isAdmin,
      canViewAllStores: isAdmin,
      canManageUsers: isAdmin,
      canExportData: isAdmin || isManager,

      // Store access
      accessibleStores: isAdmin ? "all" : storeAccess,
      canAccessStore: (storeId) => {
        if (isAdmin) return true;
        return storeAccess.includes(storeId);
      },

      // User role info
      userRole,
      storeAccess,
      isAdmin,
      isManager,
      isEmployee,
    };
  }, [userRole, storeAccess]);
};
```

### 2. Protect Routes with Access Control

```javascript
// components/ProtectedRoute.jsx
import React from "react";
import { useAccessControl } from "../hooks/useAccessControl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldX } from "lucide-react";

const ProtectedRoute = ({
  children,
  requiredPermission,
  userRole,
  storeAccess,
  fallback,
}) => {
  const access = useAccessControl(userRole, storeAccess);

  const hasPermission = requiredPermission ? access[requiredPermission] : true;

  if (!hasPermission) {
    return (
      fallback || (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <Alert className="border-red-200 bg-red-50">
              <ShieldX className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                You don't have permission to access this page. Please contact
                your administrator.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )
    );
  }

  return children;
};

export default ProtectedRoute;
```

## Part 4: Environment Variables

Add these to your `.env` file:

```bash
# AWS Cognito Configuration
VITE_AWS_REGION=us-east-1
VITE_AWS_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_AWS_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_AWS_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional: For server-side authentication
AWS_REGION=us-east-1
AWS_USER_POOL_ID=us-east-1_XXXXXXXXX
AWS_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Part 5: Testing Authentication

### Create Test Users

```bash
# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username admin@invencare.com \
  --user-attributes Name=email,Value=admin@invencare.com Name=name,Value="System Admin" Name=custom:role,Value=admin Name=custom:store_access,Value="store_001,store_002,store_003,store_004" \
  --temporary-password TempPass123! \
  --message-action SUPPRESS

# Create manager user
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username manager@invencare.com \
  --user-attributes Name=email,Value=manager@invencare.com Name=name,Value="Store Manager" Name=custom:role,Value=manager Name=custom:store_access,Value="store_001,store_002" \
  --temporary-password TempPass123! \
  --message-action SUPPRESS

# Create employee user
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username employee@invencare.com \
  --user-attributes Name=email,Value=employee@invencare.com Name=name,Value="Store Employee" Name=custom:role,Value=employee Name=custom:store_access,Value="store_001" \
  --temporary-password TempPass123! \
  --message-action SUPPRESS
```

### Set Permanent Passwords

```bash
# Set permanent password for admin
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username admin@invencare.com \
  --password Admin123! \
  --permanent

# Set permanent password for manager
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username manager@invencare.com \
  --password Manager123! \
  --permanent

# Set permanent password for employee
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username employee@invencare.com \
  --password Employee123! \
  --permanent
```

## Security Best Practices

1. **Use HTTPS in production**
2. **Enable MFA for admin users**
3. **Regularly rotate secrets**
4. **Monitor authentication logs**
5. **Implement proper session management**
6. **Use least privilege access**
7. **Enable CloudTrail for audit logs**

## Troubleshooting

### Common Issues

1. **Invalid client configuration** - Check user pool client settings
2. **Authentication errors** - Verify environment variables
3. **Permission denied** - Check IAM roles and policies
4. **Email verification** - Ensure SES is configured for production

This completes the AWS Cognito setup and login implementation for your inventory management system.
