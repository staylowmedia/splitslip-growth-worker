// src/x-client.js
import { TwitterApi } from "twitter-api-v2";

export function getXClient() {
  // --- OAuth 1.0a user context (recommended for "bot posts") ---
  const appKey = (process.env.X_CONSUMER_KEY || "").trim();
  const appSecret = (process.env.X_CONSUMER_SECRET || "").trim();
  const accessToken = (process.env.X_ACCESS_TOKEN || "").trim();
  const accessSecret = (process.env.X_ACCESS_TOKEN_SECRET || "").trim();

  if (appKey && appSecret && accessToken && accessSecret) {
    return new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
  }

  // --- OAuth2 placeholder (optional later) ---
  const clientId = (process.env.X_CLIENT_ID || "").trim();
  const clientSecret = (process.env.X_CLIENT_SECRET || "").trim();
  const refreshToken = (process.env.X_REFRESH_TOKEN || "").trim();

  if (clientId && clientSecret && refreshToken) {
    // We'll implement OAuth2 refresh flow later if needed.
    return new TwitterApi({ clientId, clientSecret });
  }

  throw new Error(
    "No valid X auth found. Set X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET (OAuth1)."
  );
}
