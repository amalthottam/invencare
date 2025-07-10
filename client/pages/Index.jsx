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
      // const user = await getCurrentUser();
      // if (user) {
      //   navigate("/dashboard");
      // } else {
      //   navigate("/login");
      // }

      // Demo authentication check (remove when implementing Cognito)
      const isAuthenticated = localStorage.getItem("isAuthenticated");

      if (isAuthenticated) {
        // Redirect to dashboard if already logged in
        navigate("/dashboard");
      } else {
        // Redirect to login if not authenticated
        navigate("/login");
      }
    } catch (error) {
      console.log("No authenticated user found");
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
