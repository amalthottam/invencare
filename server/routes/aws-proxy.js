import { createApiResponse, createApiError } from "../../shared/api.js";

// Proxy endpoint to generate forecasts via AWS API
export const generateForecast = async (req, res) => {
  try {
    console.log("Proxying forecast generation request to AWS...");
    
    const { forecasting_days = 30 } = req.body;

    // Make the request to AWS API Gateway
    const response = await fetch(
      "https://guo98gn0q0.execute-api.us-east-1.amazonaws.com/production/forecast/refresh-predictions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "lPACRhgg5y8dqG6OMOUXFNWPpJdH7IP1cdNPRsW7",
        },
        body: JSON.stringify({
          forecasting_days: forecasting_days,
        }),
      }
    );

    console.log("AWS API Response:", response.status, response.statusText);

    if (response.ok) {
      const responseData = await response.json();
      console.log("AWS API Success:", responseData);
      
      res.json(
        createApiResponse(
          responseData,
          "Forecast generation started successfully",
        )
      );
    } else {
      const errorText = await response.text();
      console.error("AWS API Error Response:", errorText);
      throw new Error(`AWS API failed with status: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error("Failed to generate forecast via proxy:", error);
    res.status(500).json(createApiError(error));
  }
};
