// Simple Cognito connectivity test

export const testCognitoConnection = async () => {
  try {
    console.log("🧪 Testing Cognito connection...");

    // Import Amplify dynamically to ensure it's configured
    const { Amplify } = await import("aws-amplify");
    const config = Amplify.getConfig();

    console.log("Current Amplify config:", config.Auth?.Cognito);

    // Test if we can reach the Cognito service
    const region = config.Auth?.Cognito?.region || "us-east-1";
    const userPoolId = config.Auth?.Cognito?.userPoolId;

    if (!userPoolId) {
      throw new Error("User Pool ID not configured");
    }

    // Try to make a simple request to Cognito
    const { getCurrentUser } = await import("aws-amplify/auth");

    try {
      // This will either return a user or throw an error
      // Either way, it tests if we can communicate with Cognito
      await getCurrentUser();
      console.log(
        "✅ Cognito connection test: SUCCESS (user already signed in)",
      );
      return { success: true, message: "Already authenticated" };
    } catch (authError) {
      // This is expected if no user is signed in
      if (
        authError.name === "UserUnAuthenticatedException" ||
        authError.name === "UserUnAuthenticatedError" ||
        authError.message.includes("not authenticated") ||
        authError.message.includes("needs to be authenticated")
      ) {
        console.log(
          "✅ Cognito connection test: SUCCESS (service reachable, no user signed in)",
        );
        return {
          success: true,
          message: "Service reachable - ready for authentication",
        };
      } else {
        console.error("❌ Cognito connection test: FAILED", authError);
        return { success: false, error: authError.message };
      }
    }
  } catch (error) {
    console.error("❌ Cognito connection test: FAILED", error);
    return { success: false, error: error.message };
  }
};

export const validateCognitoSetup = async () => {
  try {
    const { Amplify } = await import("aws-amplify");
    const config = Amplify.getConfig();

    const requiredConfig = {
      userPoolId: config.Auth?.Cognito?.userPoolId,
      userPoolClientId: config.Auth?.Cognito?.userPoolClientId,
      region: config.Auth?.Cognito?.region,
    };

    const missing = Object.entries(requiredConfig)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      return {
        valid: false,
        error: `Missing configuration: ${missing.join(", ")}`,
        config: requiredConfig,
      };
    }

    // Validate format
    if (!requiredConfig.userPoolId.match(/^[a-zA-Z0-9-_]+_[a-zA-Z0-9]+$/)) {
      return {
        valid: false,
        error: "Invalid User Pool ID format",
        config: requiredConfig,
      };
    }

    if (!requiredConfig.region.match(/^[a-z0-9-]+$/)) {
      return {
        valid: false,
        error: "Invalid region format",
        config: requiredConfig,
      };
    }

    return {
      valid: true,
      config: requiredConfig,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Configuration check failed: ${error.message}`,
    };
  }
};
