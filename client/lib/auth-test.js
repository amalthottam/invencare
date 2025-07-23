// Utility functions for testing Cognito authentication

export const testCognitoConfig = () => {
  console.group('🔐 AWS Cognito Configuration Test');
  
  try {
    const { Amplify } = require('aws-amplify');
    const config = Amplify.getConfig();
    
    console.log('✅ Amplify Configuration:');
    console.log('User Pool ID:', config.Auth?.Cognito?.userPoolId);
    console.log('Client ID:', config.Auth?.Cognito?.userPoolClientId);
    console.log('Region:', config.Auth?.Cognito?.region);
    
    return {
      success: true,
      config: config.Auth?.Cognito
    };
  } catch (error) {
    console.error('❌ Configuration Error:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    console.groupEnd();
  }
};

export const validateCredentials = (email, password) => {
  const errors = [];
  
  if (!email || !email.includes('@')) {
    errors.push('Valid email address is required');
  }
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const testUserAttributes = (attributes) => {
  console.group('👤 User Attributes Test');
  
  const requiredAttributes = ['custom:role', 'custom:store_access'];
  const missing = [];
  
  requiredAttributes.forEach(attr => {
    if (!attributes[attr]) {
      missing.push(attr);
    }
  });
  
  console.log('User Attributes:', attributes);
  console.log('Required Attributes Check:', missing.length === 0 ? '✅ All present' : `❌ Missing: ${missing.join(', ')}`);
  
  console.groupEnd();
  
  return {
    isValid: missing.length === 0,
    missing,
    attributes
  };
};
