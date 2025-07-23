import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// AWS Cognito Authentication Check
// import { getCurrentUser } from 'aws-amplify/auth';

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      // AWS Cognito Authentication Check
      const { getCurrentUser } = await import('aws-amplify/auth');
      const user = await getCurrentUser();
      if (user) {
        console.log("User is authenticated, redirecting to dashboard");
        navigate("/dashboard");
      } else {
        navigate("/login");
      }
    } catch (error) {
      console.log("No authenticated user found, redirecting to login");
      // Remove any demo authentication remnants
      localStorage.removeItem("isAuthenticated");
      navigate("/login");
    }
  };

  // Show loading state while redirecting
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
