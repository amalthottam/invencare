import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Package, Eye, EyeOff } from "lucide-react";

// AWS Cognito Authentication
import { signIn, signUp, confirmSignUp, resendSignUpCode, fetchUserAttributes } from 'aws-amplify/auth';
import { useToast } from "@/components/ui/use-toast";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    confirmationCode: "",
    firstName: "",
    lastName: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // AWS Cognito Sign In
  const handleSignIn = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Debug: Check Amplify configuration
      console.log('🔐 Starting sign in process...');
      console.log('Email:', formData.email);

      // Check if Amplify is properly configured
      const { Amplify } = await import('aws-amplify');
      const config = Amplify.getConfig();
      console.log('Amplify Config:', config.Auth?.Cognito);

      // AWS Cognito Sign In Implementation with Store Access Validation
      console.log('Attempting signIn...');

      // Try with explicit options to handle potential auth flow issues
      const signInOptions = {
        username: formData.email,
        password: formData.password,
        options: {
          authFlowType: 'USER_SRP_AUTH' // Explicitly specify auth flow
        }
      };

      console.log('Sign in options:', signInOptions);
      const { isSignedIn, nextStep } = await signIn(signInOptions);

      console.log('Sign in result:', { isSignedIn, nextStep });

      if (isSignedIn) {
        // After successful sign-in, fetch user attributes to validate store access
        const userAttributes = await fetchUserAttributes();
        const userStatus = userAttributes['custom:status'];
        const storeAccess = userAttributes['custom:store_access'];
        const userRole = userAttributes['custom:role'];

        console.log('User attributes:', userAttributes);

        // Validate user account status
        if (userStatus === 'inactive' || userStatus === 'suspended') {
          const { signOut } = await import('aws-amplify/auth');
          await signOut();
          toast({
            title: "Account Inactive",
            description: "Your account has been deactivated. Please contact your administrator.",
            variant: "destructive",
          });
          return;
        }

        if (userStatus === 'pending') {
          const { signOut } = await import('aws-amplify/auth');
          await signOut();
          toast({
            title: "Account Pending Approval",
            description: "Your account is pending admin approval. Please wait for activation.",
            variant: "destructive",
          });
          return;
        }

        // Validate store access
        if (!storeAccess || (storeAccess !== 'all' && !storeAccess.includes('store_'))) {
          const { signOut } = await import('aws-amplify/auth');
          await signOut();
          toast({
            title: "No Store Access",
            description: "You don't have access to any stores. Please contact your administrator.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Success",
          description: `Welcome back! You have ${storeAccess === 'all' ? 'full' : 'limited'} store access.`,
          variant: "success",
        });

        // Remove demo authentication
        localStorage.removeItem("isAuthenticated");
        navigate("/dashboard");
      } else {
        // Handle MFA or other next steps
        console.log('Sign in next step:', nextStep);
        toast({
          title: "Additional verification required",
          description: "Please complete the additional authentication step.",
          variant: "warning",
        });
      }
    } catch (error) {
      console.error("Sign in error:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack,
      });

      let errorMessage = "Failed to sign in";

      // Handle specific Cognito errors
      if (error.name === 'UserNotFoundException') {
        errorMessage = "User not found. Please check your email address.";
      } else if (error.name === 'NotAuthorizedException') {
        errorMessage = "Incorrect email or password.";
      } else if (error.name === 'UserNotConfirmedException') {
        errorMessage = "Please confirm your email address before signing in.";
      } else if (error.name === 'TooManyRequestsException') {
        errorMessage = "Too many sign-in attempts. Please try again later.";
      } else if (error.name === 'NetworkError') {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Sign In Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // AWS Cognito Sign Up with Store Assignment
  const handleSignUp = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate password confirmation
      if (formData.password !== formData.confirmPassword) {
        toast({
          title: "Password Mismatch",
          description: "Passwords do not match. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // AWS Cognito Sign Up Implementation with Store-Based Attributes
      const { isSignUpComplete, userId, nextStep } = await signUp({
        username: formData.email,
        password: formData.password,
        options: {
          userAttributes: {
            email: formData.email,
            given_name: formData.firstName || '',
            family_name: formData.lastName || '',
            'custom:role': 'employee', // Default role for new signups
            'custom:store_access': 'store_001', // Initial access to store_001 only
            'custom:status': 'pending' // Account needs admin approval
          },
        },
      });

      // Note: In production, new employee accounts should require admin approval
      // before gaining access to store systems and inventory data

      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setConfirmationStep(true);
        toast({
          title: "Confirmation Required",
          description: "Please check your email for confirmation code. Admin approval may be required.",
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Sign up error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to sign up",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // AWS Cognito Confirm Sign Up
  const handleConfirmSignUp = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // AWS Cognito Confirm Sign Up Implementation
      const { isSignUpComplete, nextStep } = await confirmSignUp({
        username: formData.email,
        confirmationCode: formData.confirmationCode,
      });

      if (isSignUpComplete) {
        toast({
          title: "Success",
          description: "Account confirmed! Please sign in. Your account is pending admin approval.",
          variant: "success",
        });
        setIsSignUp(false);
        setConfirmationStep(false);
      }
    } catch (error) {
      console.error("Confirmation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to confirm account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // AWS Cognito Resend Confirmation Code
  const handleResendCode = async () => {
    try {
      await resendSignUpCode({ username: formData.email });
      toast({
        title: "Code Sent",
        description: "Confirmation code resent to your email",
        variant: "success",
      });
    } catch (error) {
      console.error("Resend code error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to resend code",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = confirmationStep
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
                  {isSignUp && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          type="text"
                          placeholder="First name"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          required
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          type="text"
                          placeholder="Last name"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required
                          className="h-11"
                        />
                      </div>
                    </div>
                  )}

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
                Use your AWS Cognito credentials
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
