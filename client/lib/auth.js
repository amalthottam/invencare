import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  resendSignUpCode,
  getCurrentUser,
  fetchAuthSession,
  resetPassword,
  confirmResetPassword,
  updatePassword,
  deleteUser,
} from "aws-amplify/auth";

class AuthService {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.userAttributes = null;
  }

  // Sign up a new user
  async signUp(username, password, email, name) {
    try {
      const { isSignUpComplete, userId, nextStep } = await signUp({
        username,
        password,
        options: {
          userAttributes: {
            email,
            name,
          },
          autoSignIn: true,
        },
      });

      return {
        success: true,
        isSignUpComplete,
        userId,
        nextStep,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Confirm sign up with verification code
  async confirmSignUp(username, confirmationCode) {
    try {
      const { isSignUpComplete, nextStep } = await confirmSignUp({
        username,
        confirmationCode,
      });

      return {
        success: true,
        isSignUpComplete,
        nextStep,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Resend confirmation code
  async resendConfirmationCode(username) {
    try {
      await resendSignUpCode({
        username,
      });

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Sign in user
  async signIn(username, password) {
    try {
      const { isSignedIn, nextStep } = await signIn({
        username,
        password,
      });

      if (isSignedIn) {
        await this.fetchUserSession();
      }

      return {
        success: true,
        isSignedIn,
        nextStep,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Sign out user
  async signOut(global = false) {
    try {
      await signOut({ global });
      this.currentUser = null;
      this.isAuthenticated = false;
      this.userAttributes = null;

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get current user
  async getCurrentUser() {
    try {
      const user = await getCurrentUser();
      this.currentUser = user;
      await this.fetchUserSession();

      return {
        success: true,
        user,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Fetch user session and tokens
  async fetchUserSession() {
    try {
      const session = await fetchAuthSession();
      this.isAuthenticated = true;

      return {
        success: true,
        session,
        tokens: session.tokens,
        credentials: session.credentials,
      };
    } catch (error) {
      this.isAuthenticated = false;
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Reset password
  async resetPassword(username) {
    try {
      const output = await resetPassword({ username });

      return {
        success: true,
        nextStep: output.nextStep,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Confirm reset password
  async confirmResetPassword(username, confirmationCode, newPassword) {
    try {
      await confirmResetPassword({
        username,
        confirmationCode,
        newPassword,
      });

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Update password
  async updatePassword(oldPassword, newPassword) {
    try {
      await updatePassword({
        oldPassword,
        newPassword,
      });

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Delete user account
  async deleteUser() {
    try {
      await deleteUser();
      this.currentUser = null;
      this.isAuthenticated = false;
      this.userAttributes = null;

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get ID token for API calls
  async getIdToken() {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString();
    } catch (error) {
      console.error("Error getting ID token:", error);
      return null;
    }
  }

  // Get access token for API calls
  async getAccessToken() {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString();
    } catch (error) {
      console.error("Error getting access token:", error);
      return null;
    }
  }

  // Check if user is authenticated
  async checkAuthState() {
    try {
      const user = await getCurrentUser();
      if (user) {
        this.currentUser = user;
        await this.fetchUserSession();
        return true;
      }
      return false;
    } catch (error) {
      this.isAuthenticated = false;
      return false;
    }
  }

  // Get user attributes
  getUserAttributes() {
    return this.userAttributes;
  }

  // Check if user is authenticated (synchronous)
  isUserAuthenticated() {
    return this.isAuthenticated;
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
