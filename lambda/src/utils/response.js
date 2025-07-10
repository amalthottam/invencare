/**
 * Utility functions for creating standardized API responses
 */

export const createResponse = (statusCode, body, headers = {}) => {
  const defaultHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE",
    ...headers,
  };

  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(body),
  };
};

export const successResponse = (data, message = "Success") => {
  return createResponse(200, {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

export const errorResponse = (error, statusCode = 400) => {
  const errorMessage = error instanceof Error ? error.message : error;

  return createResponse(statusCode, {
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  });
};

export const validationErrorResponse = (validationErrors) => {
  return createResponse(422, {
    success: false,
    error: "Validation failed",
    validationErrors,
    timestamp: new Date().toISOString(),
  });
};

export const unauthorizedResponse = (message = "Unauthorized") => {
  return createResponse(401, {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  });
};

export const notFoundResponse = (message = "Resource not found") => {
  return createResponse(404, {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  });
};

export const corsResponse = () => {
  return createResponse(200, {});
};
