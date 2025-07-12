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
import {
  Package,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ShoppingCart,
} from "lucide-react";

export default function Login({ onAuthChange }) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
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

  const handleSubmit = needsConfirmation
    ? handleConfirmSignUp
    : isSignUp
      ? handleSignUp
      : handleSignIn;

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
              <div className="p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-md">
                {success}
              </div>
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
