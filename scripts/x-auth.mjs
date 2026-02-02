import 'dotenv/config'
import readline from 'node:readline'
import { TwitterApi } from 'twitter-api-v2'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((res) => rl.question(q, res))

async function main() {
  const appKey = process.env.X_CONSUMER_KEY
  const appSecret = process.env.X_CONSUMER_SECRET
  if (!appKey || !appSecret) throw new Error('Missing X_CONSUMER_KEY / X_CONSUMER_SECRET in .env')

  const client = new TwitterApi({ appKey, appSecret })

  // OAuth 1.0a
  const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(
    'https://splitslip.com/oauth/x/callback'
  )

  console.log('\n1) Open this URL and authorize the app:\n', url)
  console.log('\n2) After authorizing, you’ll be redirected. Copy the "oauth_verifier" from the URL.\n')

  const verifier = await ask('Paste oauth_verifier here: ')
  rl.close()

  const loginClient = new TwitterApi({
    appKey,
    appSecret,
    accessToken: oauth_token,
    accessSecret: oauth_token_secret,
  })

  const { accessToken, accessSecret, screenName, userId } = await loginClient.login(verifier.trim())

  console.log('\n✅ SAVE THESE (put them in Render env vars):')
  console.log('X_ACCESS_TOKEN=', accessToken)
  console.log('X_ACCESS_TOKEN_SECRET=', accessSecret)
  console.log('\nAuthorized account:', screenName, '(userId:', userId + ')')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
