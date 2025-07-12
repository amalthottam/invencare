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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <Package className="h-7 w-7 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">InvenCare</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {confirmationStep
              ? "Confirm your account"
              : isSignUp
                ? "Create your supermarket inventory account"
                : "Sign in to your supermarket inventory system"}
          </p>
        </div>

        {/* Authentication form */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>
              {confirmationStep
                ? "Confirm Account"
                : isSignUp
                  ? "Sign up"
                  : "Sign in"}
            </CardTitle>
            <CardDescription>
              {confirmationStep
                ? "Enter the confirmation code sent to your email"
                : isSignUp
                  ? "Create an account to get started"
                  : "Enter your credentials to access your account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!confirmationStep && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        className="h-11 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
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
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        required
                        className="h-11"
                      />
                    </div>
                  )}
                </>
              )}

              {confirmationStep && (
                <div className="space-y-2">
                  <Label htmlFor="confirmationCode">Confirmation Code</Label>
                  <Input
                    id="confirmationCode"
                    name="confirmationCode"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={formData.confirmationCode}
                    onChange={handleInputChange}
                    required
                    className="h-11"
                    maxLength={6}
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                disabled={isLoading}
              >
                {isLoading
                  ? "Processing..."
                  : confirmationStep
                    ? "Confirm Account"
                    : isSignUp
                      ? "Sign up"
                      : "Sign in"}
              </Button>
            </form>

            {confirmationStep && (
              <div className="mt-4 text-center">
                <Button
                  variant="ghost"
                  onClick={handleResendCode}
                  disabled={isLoading}
                >
                  Resend confirmation code
                </Button>
              </div>
            )}

            <div className="mt-6 text-center">
              {!confirmationStep && (
                <Button
                  variant="ghost"
                  onClick={() => setIsSignUp(!isSignUp)}
                  disabled={isLoading}
                >
                  {isSignUp
                    ? "Already have an account? Sign in"
                    : "Don't have an account? Sign up"}
                </Button>
              )}

              <p className="text-xs text-muted-foreground mt-2">
                Demo credentials: Use any email and password
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>© 2024 InvenCare. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
