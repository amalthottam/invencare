import fetch from "node-fetch";
import { Agent } from "https";
import { createApiResponse, createApiError } from "../../shared/api.js";

const httpsAgent = new Agent({ keepAlive: false });

const AWS_API_URL = "https://guo98gn0q0.execute-api.us-east-1.amazonaws.com/production/forecast/refresh-predictions";
const API_KEY = "lPACRhgg5y8dqG6OMOUXFNWPpJdH7IP1cdNPRsW7";

// Retry wrapper for transient fetch errors
async function fetchWithRetry(url, options, retries = 1, delay = 200) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (retries > 0) {
      console.warn(`Fetch failed. Retrying after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay);
    }
    throw error;
  }
}

export const generateForecast = async (req, res) => {
  try {
    console.log("Proxying forecast generation request to AWS...");

    const { forecasting_days = 30 } = req.body;

    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "Connection": "close", // Optional: disables keep-alive from your side
      },
      agent: httpsAgent,
      body: JSON.stringify({ forecasting_days }),
    };

    const response = await fetchWithRetry(AWS_API_URL, requestOptions);

    console.log("AWS API Response:", response.status, response.statusText);

    if (response.ok) {
      const responseData = await response.json();
      console.log("AWS API Success:", responseData);

      return res.json(
        createApiResponse(
          responseData,
          "Forecast generation started successfully"
        )
      );
    } else {
      const errorText = await response.text();
      console.error("AWS API Error Response:", errorText);
      throw new Error(
        `AWS API failed with status: ${response.status} - ${errorText}`
      );
    }
  } catch (error) {
    console.error("❌ Failed to generate forecast via proxy:", error);
    return res.status(500).json(createApiError(error));
  }
};
