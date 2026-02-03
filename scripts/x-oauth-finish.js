// scripts/x-oauth-finish.js
import { TwitterApi } from 'twitter-api-v2';

const clientId = (process.env.X_CLIENT_ID || '').trim();
const clientSecret = (process.env.X_CLIENT_SECRET || '').trim();
const redirectUri = (process.env.X_REDIRECT_URI || '').trim();

// From callback URL: ?code=...
const code = decodeURIComponent((process.env.X_OAUTH_CODE || '').trim());
const codeVerifier = (process.env.X_OAUTH_CODE_VERIFIER || '').trim();

// Safe debug (length only)
console.log('code length:', code.length);
console.log('codeVerifier length:', codeVerifier.length);

if (!clientId || !clientSecret || !redirectUri) {
  console.error('Missing env vars: X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT_URI');
  process.exit(1);
}
if (!code || !codeVerifier) {
  console.error('Missing env vars: X_OAUTH_CODE and/or X_OAUTH_CODE_VERIFIER');
  process.exit(1);
}

// Extra sanity checks (common copy/paste mistakes)
if (code.includes('code=')) {
  console.error('X_OAUTH_CODE looks wrong: it contains "code=" — paste ONLY the value after code=');
  process.exit(1);
}
if (code.includes('&') || code.includes('?')) {
  console.error('X_OAUTH_CODE looks wrong: it contains "&" or "?" — paste ONLY the code value');
  process.exit(1);
}
if (codeVerifier.length < 20) {
  console.error('X_OAUTH_CODE_VERIFIER looks too short — make sure you pasted the full verifier from start script');
  process.exit(1);
}

const twitterClient = new TwitterApi({ clientId, clientSecret });

try {
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
} catch (err) {
  // Print a helpful error without dumping secrets
  console.error('\n❌ OAuth failed.');
  console.error(err?.data || err?.message || err);
  process.exit(1);
}
