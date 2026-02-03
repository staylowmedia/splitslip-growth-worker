// scripts/x-oauth-start.js
import { TwitterApi } from 'twitter-api-v2';
import crypto from 'crypto';

function randomBase64Url(size = 32) {
  return crypto.randomBytes(size).toString('base64url');
}

const clientId = process.env.X_CLIENT_ID;
const clientSecret = process.env.X_CLIENT_SECRET;
const redirectUri = process.env.X_REDIRECT_URI;

if (!clientId || !clientSecret || !redirectUri) {
  console.error('Missing env vars: X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT_URI');
  process.exit(1);
}

const twitterClient = new TwitterApi({ clientId, clientSecret });

const scopes = (process.env.X_SCOPES || 'tweet.read tweet.write users.read offline.access')
  .split(' ')
  .filter(Boolean);

const state = randomBase64Url(16);
const codeVerifier = randomBase64Url(48);

const { url, codeChallenge } = await twitterClient.generateOAuth2AuthLink(redirectUri, {
  scope: scopes,
  state,
  codeVerifier,
});

// Print info you MUST keep for the next step
console.log('\nOpen this URL in your browser and approve:');
console.log(url);
console.log('\nSAVE THESE (needed to finish auth):');
console.log('X_OAUTH_STATE=' + state);
console.log('X_OAUTH_CODE_VERIFIER=' + codeVerifier);
console.log('X_OAUTH_CODE_CHALLENGE=' + codeChallenge);
