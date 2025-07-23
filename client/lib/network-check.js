// Network connectivity and AWS service checks

export const checkNetworkConnectivity = async () => {
  try {
    // Test basic internet connectivity
    const response = await fetch("https://httpbin.org/get", {
      method: "GET",
      mode: "cors",
      cache: "no-cache",
    });

    if (response.ok) {
      console.log("✅ Internet connectivity: OK");
      return true;
    } else {
      console.warn("⚠️ Internet connectivity: Issues detected");
      return false;
    }
  } catch (error) {
    console.error("❌ Internet connectivity: Failed", error);
    return false;
  }
};

export const checkCognitoEndpoint = async (region = "us-east-1") => {
  try {
    // Test if we can reach Cognito service endpoint
    const cognitoUrl = `https://cognito-idp.${region}.amazonaws.com/`;

    // Use a simple HEAD request to check if the service is reachable
    const response = await fetch(cognitoUrl, {
      method: "HEAD",
      mode: "no-cors", // Cognito doesn't allow CORS for HEAD requests
      cache: "no-cache",
    });

    console.log("✅ Cognito endpoint reachable");
    return true;
  } catch (error) {
    console.error("❌ Cognito endpoint check failed:", error);
    return false;
  }
};

export const debugCognitoConfig = async () => {
  try {
    const { Amplify } = await import("aws-amplify");
    const config = Amplify.getConfig();

    console.group("🔍 Cognito Configuration Debug");
    console.log("User Pool ID:", config.Auth?.Cognito?.userPoolId);
    console.log("Client ID:", config.Auth?.Cognito?.userPoolClientId);
    console.log("Region:", config.Auth?.Cognito?.region);
    console.log("Login With:", config.Auth?.Cognito?.loginWith);
    console.log("Password Format:", config.Auth?.Cognito?.passwordFormat);
    console.groupEnd();

    // Validate required fields
    const required = {
      userPoolId: config.Auth?.Cognito?.userPoolId,
      userPoolClientId: config.Auth?.Cognito?.userPoolClientId,
      region: config.Auth?.Cognito?.region,
    };

    const missing = Object.entries(required)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      console.error("❌ Missing configuration:", missing);
      return { valid: false, missing };
    }

    console.log("✅ Configuration appears valid");
    return { valid: true, config: required };
  } catch (error) {
    console.error("❌ Configuration check failed:", error);
    return { valid: false, error: error.message };
  }
};

export const performPreAuthChecks = async () => {
  console.group("🔬 Pre-Authentication Diagnostics");

  const results = {
    network: await checkNetworkConnectivity(),
    cognitoEndpoint: await checkCognitoEndpoint(),
    config: await debugCognitoConfig(),
  };

  console.log("Diagnostic Results:", results);
  console.groupEnd();

  return results;
};
