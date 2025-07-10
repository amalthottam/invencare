import { cognitoUtils } from "../utils/cognito.js";
import {
  successResponse,
  errorResponse,
  corsResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../utils/response.js";
import { z } from "zod";

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone_number: z.string().optional(),
  custom_attributes: z.record(z.string()).optional(),
});

const userPreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "auto"]).optional(),
  language: z.string().optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
  dashboard_layout: z.array(z.string()).optional(),
});

/**
 * Get current user profile
 */
export const getUserProfile = async (event) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return corsResponse();
    }

    // Verify authentication
    const authResult = await cognitoUtils.verifyToken(event);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error);
    }

    const { user, attributes } = authResult;

    // Build user profile response
    const profile = {
      username: user.Username,
      email: attributes.email,
      name: attributes.name,
      phone_number: attributes.phone_number,
      email_verified: attributes.email_verified === "true",
      phone_number_verified: attributes.phone_number_verified === "true",
      user_status: user.UserStatus,
      created_at: user.UserCreateDate,
      updated_at: user.UserLastModifiedDate,
      preferences: JSON.parse(attributes["custom:preferences"] || "{}"),
      custom_attributes: Object.entries(attributes)
        .filter(([key]) => key.startsWith("custom:"))
        .reduce((acc, [key, value]) => {
          const customKey = key.replace("custom:", "");
          if (customKey !== "preferences") {
            acc[customKey] = value;
          }
          return acc;
        }, {}),
    };

    return successResponse(profile, "User profile retrieved successfully");
  } catch (error) {
    console.error("Get user profile error:", error);
    return errorResponse(error.message, 500);
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (event) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return corsResponse();
    }

    // Verify authentication
    const authResult = await cognitoUtils.verifyToken(event);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error);
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      return errorResponse("Invalid JSON in request body");
    }

    const validation = updateProfileSchema.safeParse(requestBody);
    if (!validation.success) {
      return validationErrorResponse(validation.error.errors);
    }

    const updateData = validation.data;
    const { username } = authResult;

    // Prepare attributes for update
    const attributesToUpdate = {};

    if (updateData.name) {
      attributesToUpdate.name = updateData.name;
    }

    if (updateData.email) {
      attributesToUpdate.email = updateData.email;
    }

    if (updateData.phone_number) {
      attributesToUpdate.phone_number = updateData.phone_number;
    }

    // Handle custom attributes
    if (updateData.custom_attributes) {
      Object.entries(updateData.custom_attributes).forEach(([key, value]) => {
        attributesToUpdate[`custom:${key}`] = value;
      });
    }

    // Update user attributes in Cognito
    if (Object.keys(attributesToUpdate).length > 0) {
      const updateResult = await cognitoUtils.updateUserAttributes(
        username,
        attributesToUpdate,
      );

      if (!updateResult.success) {
        return errorResponse(updateResult.error);
      }
    }

    return successResponse(
      { username, updated_attributes: attributesToUpdate },
      "User profile updated successfully",
    );
  } catch (error) {
    console.error("Update user profile error:", error);
    return errorResponse(error.message, 500);
  }
};

/**
 * Update user preferences
 */
export const updateUserPreferences = async (event) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return corsResponse();
    }

    // Verify authentication
    const authResult = await cognitoUtils.verifyToken(event);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error);
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      return errorResponse("Invalid JSON in request body");
    }

    const validation = userPreferencesSchema.safeParse(requestBody);
    if (!validation.success) {
      return validationErrorResponse(validation.error.errors);
    }

    const preferences = validation.data;
    const { username } = authResult;

    // Get current preferences
    const userResult = await cognitoUtils.getUserByUsername(username);
    if (!userResult.success) {
      return errorResponse(userResult.error);
    }

    const currentPreferences = JSON.parse(
      userResult.attributes["custom:preferences"] || "{}",
    );

    // Merge with new preferences
    const updatedPreferences = {
      ...currentPreferences,
      ...preferences,
    };

    // Update preferences in Cognito
    const updateResult = await cognitoUtils.updateUserAttributes(username, {
      "custom:preferences": JSON.stringify(updatedPreferences),
    });

    if (!updateResult.success) {
      return errorResponse(updateResult.error);
    }

    return successResponse(
      { username, preferences: updatedPreferences },
      "User preferences updated successfully",
    );
  } catch (error) {
    console.error("Update user preferences error:", error);
    return errorResponse(error.message, 500);
  }
};

/**
 * Get user preferences
 */
export const getUserPreferences = async (event) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return corsResponse();
    }

    // Verify authentication
    const authResult = await cognitoUtils.verifyToken(event);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error);
    }

    const { attributes } = authResult;

    const preferences = JSON.parse(attributes["custom:preferences"] || "{}");

    return successResponse(
      preferences,
      "User preferences retrieved successfully",
    );
  } catch (error) {
    console.error("Get user preferences error:", error);
    return errorResponse(error.message, 500);
  }
};

/**
 * Delete user account
 */
export const deleteUserAccount = async (event) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return corsResponse();
    }

    // Verify authentication
    const authResult = await cognitoUtils.verifyToken(event);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error);
    }

    const { username } = authResult;

    // Disable user account (soft delete)
    const disableResult = await cognitoUtils.disableUser(username);
    if (!disableResult.success) {
      return errorResponse(disableResult.error);
    }

    // Here you might want to:
    // 1. Clean up user data from other services
    // 2. Send notification emails
    // 3. Log the deletion for audit purposes

    return successResponse(
      { username, status: "disabled" },
      "User account deleted successfully",
    );
  } catch (error) {
    console.error("Delete user account error:", error);
    return errorResponse(error.message, 500);
  }
};

/**
 * Admin function to list users
 */
export const listUsers = async (event) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return corsResponse();
    }

    // Verify authentication
    const authResult = await cognitoUtils.verifyToken(event);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error);
    }

    // Check if user has admin permissions
    const userFromContext = cognitoUtils.getUserFromEvent(event);
    if (!userFromContext?.groups?.includes("admin")) {
      return unauthorizedResponse("Admin privileges required");
    }

    // Parse query parameters
    const { limit = "20", paginationToken } = event.queryStringParameters || {};

    const result = await cognitoUtils.listUsers(
      parseInt(limit),
      paginationToken,
    );

    if (!result.success) {
      return errorResponse(result.error);
    }

    return successResponse(
      {
        users: result.users,
        pagination_token: result.paginationToken,
        has_more: !!result.paginationToken,
      },
      "Users retrieved successfully",
    );
  } catch (error) {
    console.error("List users error:", error);
    return errorResponse(error.message, 500);
  }
};
