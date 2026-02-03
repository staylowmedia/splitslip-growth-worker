// scripts/x-oauth-finish.js
import { TwitterApi } from 'twitter-api-v2';

const clientId = process.env.X_CLIENT_ID;
const clientSecret = process.env.X_CLIENT_SECRET;
const redirectUri = process.env.X_REDIRECT_URI;

const code = process.env.X_OAUTH_CODE; // paste from callback URL ?code=...
const codeVerifier = process.env.X_OAUTH_CODE_VERIFIER;

if (!clientId || !clientSecret || !redirectUri) {
  console.error('Missing env vars: X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT_URI');
  process.exit(1);
}
if (!code || !codeVerifier) {
  console.error('Missing env vars: X_OAUTH_CODE and/or X_OAUTH_CODE_VERIFIER');
  process.exit(1);
}

const twitterClient = new TwitterApi({ clientId, clientSecret });

const { client: loggedClient, accessToken, refreshToken, expiresIn } =
  await twitterClient.loginWithOAuth2({
    code,
    codeVerifier,
    redirectUri,
  });

const me = await loggedClient.v2.me();

console.log('\n✅ OAuth success!');
console.log('User:', me?.data?.username);
console.log('\nAdd these to Render environment variables:');
console.log('X_REFRESH_TOKEN=' + refreshToken);
console.log('X_ACCESS_TOKEN=' + accessToken);
console.log('X_TOKEN_EXPIRES_IN=' + expiresIn);
