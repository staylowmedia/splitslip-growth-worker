// src/x-client.js
import { TwitterApi } from "twitter-api-v2";

export function getXClient() {
  // ---- Prefer OAuth 1.0a user context if present ----
  const o1Key = process.env.X_OAUTH1_CONSUMER_KEY;
  const o1Secret = process.env.X_OAUTH1_CONSUMER_SECRET;
  const o1Access = process.env.X_OAUTH1_ACCESS_TOKEN;
  const o1AccessSecret = process.env.X_OAUTH1_ACCESS_TOKEN_SECRET;

  if (o1Key && o1Secret && o1Access && o1AccessSecret) {
    return new TwitterApi({
      appKey: o1Key,
      appSecret: o1Secret,
      accessToken: o1Access,
      accessSecret: o1AccessSecret,
    });
  }

  // ---- Fallback: OAuth2 (refresh token) if present ----
  const cId = process.env.X_OAUTH2_CLIENT_ID;
  const cSecret = process.env.X_OAUTH2_CLIENT_SECRET;
  const refreshToken = process.env.X_OAUTH2_REFRESH_TOKEN;

  if (cId && cSecret && refreshToken) {
    // twitter-api-v2 kan bruke refresh token i OAuth2 flow,
    // men ofte håndteres token refresh i egen kode.
    // Her lar vi det være en "hook" du kan bygge videre på.
    return new TwitterApi({
      clientId: cId,
      clientSecret: cSecret,
    });
  }

  throw new Error(
    "No valid X auth found. Set OAuth1 vars (recommended) or OAuth2 vars."
  );
}
