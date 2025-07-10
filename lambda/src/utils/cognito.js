import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || "us-east-1",
});

export class CognitoUtils {
  constructor(userPoolId) {
    this.userPoolId = userPoolId;
  }

  /**
   * Verify and decode JWT token from Authorization header
   */
  async verifyToken(event) {
    try {
      const authHeader =
        event.headers?.Authorization || event.headers?.authorization;
      if (!authHeader) {
        throw new Error("No authorization header provided");
      }

      const token = authHeader.replace("Bearer ", "");
      if (!token) {
        throw new Error("Invalid authorization header format");
      }

      // Get user info using the access token
      const getUserCommand = new GetUserCommand({
        AccessToken: token,
      });

      const user = await cognitoClient.send(getUserCommand);
      return {
        success: true,
        user,
        username: user.Username,
        attributes: this.parseUserAttributes(user.UserAttributes),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user by username (admin operation)
   */
  async getUserByUsername(username) {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });

      const user = await cognitoClient.send(command);
      return {
        success: true,
        user,
        attributes: this.parseUserAttributes(user.UserAttributes),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update user attributes
   */
  async updateUserAttributes(username, attributes) {
    try {
      const userAttributes = Object.entries(attributes).map(
        ([name, value]) => ({
          Name: name,
          Value: value,
        }),
      );

      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        UserAttributes: userAttributes,
      });

      await cognitoClient.send(command);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Disable user account
   */
  async disableUser(username) {
    try {
      const command = new AdminDisableUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });

      await cognitoClient.send(command);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Enable user account
   */
  async enableUser(username) {
    try {
      const command = new AdminEnableUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });

      await cognitoClient.send(command);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * List all users (with pagination)
   */
  async listUsers(limit = 20, paginationToken = null) {
    try {
      const command = new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Limit: limit,
        PaginationToken: paginationToken,
      });

      const result = await cognitoClient.send(command);
      return {
        success: true,
        users: result.Users.map((user) => ({
          username: user.Username,
          attributes: this.parseUserAttributes(user.Attributes),
          userStatus: user.UserStatus,
          enabled: user.Enabled,
          userCreateDate: user.UserCreateDate,
          userLastModifiedDate: user.UserLastModifiedDate,
        })),
        paginationToken: result.PaginationToken,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Parse user attributes array into object
   */
  parseUserAttributes(attributes) {
    if (!attributes) return {};

    return attributes.reduce((acc, attr) => {
      acc[attr.Name] = attr.Value;
      return acc;
    }, {});
  }

  /**
   * Extract user info from event context (for authenticated requests)
   */
  getUserFromEvent(event) {
    const requestContext = event.requestContext;

    // If using API Gateway with Cognito authorizer
    if (requestContext?.authorizer?.claims) {
      const claims = requestContext.authorizer.claims;
      return {
        username: claims["cognito:username"] || claims.sub,
        email: claims.email,
        name: claims.name,
        sub: claims.sub,
        groups: claims["cognito:groups"]
          ? claims["cognito:groups"].split(",")
          : [],
      };
    }

    return null;
  }
}

// Export default instance
export const cognitoUtils = new CognitoUtils(process.env.COGNITO_USER_POOL_ID);
