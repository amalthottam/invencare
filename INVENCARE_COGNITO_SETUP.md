# InvenCare AWS Cognito Integration Setup

Complete setup guide for integrating AWS Cognito authentication into the InvenCare inventory management application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [AWS Cognito Setup](#aws-cognito-setup)
3. [Environment Configuration](#environment-configuration)
4. [Frontend Integration](#frontend-integration)
5. [Backend Integration](#backend-integration)
6. [Database Schema Updates](#database-schema-updates)
7. [Testing & Validation](#testing--validation)
8. [Deployment](#deployment)

## Prerequisites

### 1. Install Required Dependencies

```bash
# Core AWS dependencies
npm install aws-amplify @aws-amplify/ui-react
npm install @aws-sdk/client-cognito-identity-provider
npm install amazon-cognito-identity-js

# Additional utilities
npm install jwt-decode
npm install --save-dev @types/aws-lambda
```

### 2. AWS Account Requirements

- AWS Account with appropriate permissions
- AWS CLI configured with credentials
- Access to create IAM roles and policies
- Cognito service permissions

## AWS Cognito Setup

### Step 1: Create Cognito User Pool

```bash
# Create the InvenCare User Pool
aws cognito-idp create-user-pool \
  --pool-name "InvenCare-Users" \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false
    }
  }' \
  --auto-verified-attributes email \
  --username-attributes email \
  --account-recovery-setting '{
    "RecoveryMechanisms": [
      {
        "Name": "verified_email",
        "Priority": 1
      }
    ]
  }' \
  --user-attribute-update-settings '{
    "AttributesRequireVerificationBeforeUpdate": ["email"]
  }' \
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
      "Name": "role",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "department",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "company",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    }
  ]'
```

### Step 2: Create User Pool Client

```bash
# Create User Pool Client for InvenCare
aws cognito-idp create-user-pool-client \
  --user-pool-id us-east-1_XXXXXXXXX \
  --client-name "InvenCare-Web-Client" \
  --generate-secret false \
  --supported-identity-providers COGNITO \
  --callback-urls "http://localhost:8080/auth/callback,https://your-domain.com/auth/callback" \
  --logout-urls "http://localhost:8080/auth/logout,https://your-domain.com/auth/logout" \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client true \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_PASSWORD_AUTH \
  --prevent-user-existence-errors ENABLED
```

### Step 3: Create Identity Pool

```bash
# Create Identity Pool for AWS service access
aws cognito-identity create-identity-pool \
  --identity-pool-name "InvenCare_Identity_Pool" \
  --allow-unauthenticated-identities false \
  --cognito-identity-providers ProviderName=cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXXXX,ClientId=XXXXXXXXXXXXXXXXXXXXXXXXXX,ServerSideTokenCheck=false
```

### Step 4: Create IAM Roles

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
          "cognito-identity.amazonaws.com:aud": "us-east-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
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
  --role-name InvenCare-Cognito-Authenticated-Role \
  --assume-role-policy-document file://cognito-authenticated-role-trust-policy.json

# Create policy for authenticated users
cat > invencare-user-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::invencare-uploads/\${cognito-identity.amazonaws.com:sub}/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:us-east-1:*:function:invencare-*"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name InvenCare-Cognito-Authenticated-Role \
  --policy-name InvenCareUserPolicy \
  --policy-document file://invencare-user-policy.json
```

## Environment Configuration

### Update .env file

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key

# Cognito Configuration (Frontend)
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_COGNITO_IDENTITY_POOL_ID=us-east-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
VITE_COGNITO_DOMAIN=invencare-auth.auth.us-east-1.amazoncognito.com

# Backend Configuration
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
COGNITO_REGION=us-east-1

# InvenCare Specific
VITE_APP_NAME=InvenCare
VITE_API_ENDPOINT=http://localhost:8080/api
```

## Frontend Integration

### Step 1: Update App.jsx with Authentication

```jsx
// client/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/AuthContext";
import { Amplify } from "aws-amplify";
import awsConfig from "@/lib/aws-config";
import ProtectedRoute from "@/components/ProtectedRoute";

// Import your existing pages
import Index from "@/pages/Index";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Transactions from "@/pages/Transactions";
import Forecasting from "@/pages/Forecasting";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

// Configure Amplify
Amplify.configure(awsConfig);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route
            path="/login"
            element={
              <ProtectedRoute requireAuth={false}>
                <Login />
              </ProtectedRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <Products />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Transactions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/forecasting"
            element={
              <ProtectedRoute>
                <Forecasting />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

### Step 2: Update Navigation Component

```jsx
// client/components/Navigation.jsx - Add authentication
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

const Navigation = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const result = await signOut();
    if (result.success) {
      navigate("/");
    }
  };

  if (!isAuthenticated) {
    return null; // Don't show navigation for unauthenticated users
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="text-xl font-bold text-gray-900">
              InvenCare
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-gray-700 hover:text-gray-900">
              Dashboard
            </Link>
            <Link to="/products" className="text-gray-700 hover:text-gray-900">
              Products
            </Link>
            <Link
              to="/transactions"
              className="text-gray-700 hover:text-gray-900"
            >
              Transactions
            </Link>
            <Link
              to="/forecasting"
              className="text-gray-700 hover:text-gray-900"
            >
              Forecasting
            </Link>
            <Link to="/settings" className="text-gray-700 hover:text-gray-900">
              Settings
            </Link>

            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span className="text-sm text-gray-700">
                {user?.attributes?.name || user?.username}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-gray-700 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
```

### Step 3: Create Authentication Pages

Create a comprehensive login page:

```jsx
// client/pages/Login.jsx
import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff } from "lucide-react";

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    confirmPassword: "",
  });
  const [confirmationCode, setConfirmationCode] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const { signIn, signUp, confirmSignUp, isLoading, error, clearError } =
    useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/dashboard";

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) clearError();
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    const result = await signIn(formData.username, formData.password);

    if (result.success && result.isSignedIn) {
      navigate(from, { replace: true });
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      return; // Handle password mismatch
    }

    const result = await signUp(
      formData.username,
      formData.password,
      formData.email,
      formData.name,
    );

    if (result.success) {
      if (!result.isSignUpComplete) {
        setNeedsConfirmation(true);
      }
    }
  };

  const handleConfirmSignUp = async (e) => {
    e.preventDefault();
    const result = await confirmSignUp(formData.username, confirmationCode);

    if (result.success && result.isSignUpComplete) {
      // Auto sign in after confirmation
      await signIn(formData.username, formData.password);
      navigate(from, { replace: true });
    }
  };

  if (needsConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Confirm Your Account</CardTitle>
            <CardDescription>
              We've sent a confirmation code to {formData.email}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleConfirmSignUp}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="confirmationCode">Confirmation Code</Label>
                <Input
                  id="confirmationCode"
                  type="text"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Account
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isSignUp ? "Create Account" : "Sign In"}</CardTitle>
          <CardDescription>
            {isSignUp
              ? "Create your InvenCare account to get started"
              : "Welcome back to InvenCare"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Username/Email</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your email"
                required
              />
            </div>

            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  required
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? "Create Account" : "Sign In"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setIsSignUp(!isSignUp);
                clearError();
              }}
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Need an account? Sign up"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
```

## Backend Integration

### Update server/index.js

```javascript
// server/index.js - Add Cognito middleware
import express from "express";
import cors from "cors";
import { CognitoJwtVerifier } from "aws-jwt-verify";

// Create Cognito JWT verifier
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
});

// Middleware to verify Cognito tokens
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const payload = await verifier.verify(token);
    req.user = {
      sub: payload.sub,
      username: payload.username,
      email: payload.email,
      groups: payload["cognito:groups"] || [],
    };

    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(403).json({ error: "Invalid token" });
  }
};

export function createServer() {
  const app = express();

  // Existing middleware
  app.use(cors());
  app.use(express.json());

  // Protected API routes
  app.get("/api/user/profile", authenticateToken, (req, res) => {
    res.json({
      success: true,
      user: req.user,
    });
  });

  app.get("/api/products", authenticateToken, (req, res) => {
    // Your existing products logic with user context
    const userId = req.user.sub;
    // Filter products by user/organization
    res.json({ success: true, products: [], userId });
  });

  app.get("/api/transactions", authenticateToken, (req, res) => {
    // Your existing transactions logic with user context
    const userId = req.user.sub;
    res.json({ success: true, transactions: [], userId });
  });

  // Other existing routes...

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`InvenCare server running on port ${PORT}`);
  });

  return app;
}
```

## Testing & Validation

### 1. Test Authentication Flow

```bash
# Install testing dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest
```

### 2. Manual Testing Checklist

- [ ] User can sign up with email/password
- [ ] Email verification works
- [ ] User can sign in after verification
- [ ] Protected routes redirect to login
- [ ] User can access dashboard after login
- [ ] User can sign out
- [ ] Tokens are properly stored and used
- [ ] API calls include authentication headers

## Deployment

### 1. Environment Variables for Production

```env
# Production environment
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_COGNITO_IDENTITY_POOL_ID=us-east-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
VITE_COGNITO_DOMAIN=invencare-auth.auth.us-east-1.amazoncognito.com
VITE_API_ENDPOINT=https://your-api-domain.com/api
```

### 2. Security Considerations

1. **HTTPS Only**: Ensure all production URLs use HTTPS
2. **CORS Configuration**: Update CORS settings for production domains
3. **Token Storage**: Tokens are stored securely by Amplify
4. **Rate Limiting**: Implement rate limiting on auth endpoints
5. **Monitoring**: Set up CloudWatch for authentication metrics

## Next Steps

1. **Run Setup Commands**: Execute the AWS CLI commands above
2. **Install Dependencies**: Run `npm install` with new packages
3. **Update Environment**: Configure your `.env` file
4. **Test Integration**: Test the authentication flow
5. **Deploy**: Deploy to your production environment

## Support

For issues with:

- **AWS Cognito**: Check CloudWatch logs and Cognito console
- **Frontend Integration**: Verify Amplify configuration
- **Backend Issues**: Check token verification and CORS settings
- **Environment**: Ensure all environment variables are set correctly

Remember to replace placeholder values (XXXXXXXXX) with your actual AWS resource IDs.
