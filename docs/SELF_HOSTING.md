# Self-hosting Crescent

This guide walks through getting Crescent running with Gmail-based listing ingestion.

## Prerequisites

- Docker + Docker Compose
- A domain or LAN IP where the app will be reachable. The redirect URIs registered with your OAuth provider must match the public URL exactly.
- A Google Cloud project with OAuth client credentials (free).

## 1. Bring up the stack

```bash
git clone https://github.com/bulbousoars/Crescent.git
cd Crescent
cp .env.example .env
```

Generate a token-encryption key (32 bytes, base64):

```bash
openssl rand -base64 32
```

Set the value as `MAIL_ENCRYPTION_KEY` in `.env`. **Do not lose this key** — it decrypts every stored OAuth refresh token. Backing it up safely is on you. If you ever rotate it, every connected account must reconnect.

Set `INGESTION_API_TOKEN` and `ADMIN_API_TOKEN` (different values, both random). The admin token gates `/admin/*`; the ingestion token gates the legacy `POST /api/ingestion/zillow-email` endpoint.

Set `NEXT_PUBLIC_APP_URL` to the URL the app is reachable at — for example `https://crescent.example.com`. This is used to build OAuth redirect URIs.

Bring it up:

```bash
docker compose up -d --build
```

The app listens on `${APP_BIND:-0.0.0.0}:${APP_PORT:-3000}`. The worker container starts paused until you connect an account.

## 2. Create a Google Cloud OAuth client

1. Go to <https://console.cloud.google.com/> and create or pick a project.
2. **APIs & Services → Library → Gmail API →** enable.
3. **APIs & Services → OAuth consent screen**:
   - User type: External (or Internal if you have Workspace)
   - App name, support email, developer contact email
   - Scopes: add `.../auth/gmail.modify`, `openid`, `email`, `profile`
   - Test users: add the email of the mailbox you'll connect
   - Publish only when you're ready to skip the 7-day refresh-token expiry
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: Web application
   - Authorized redirect URI: `${NEXT_PUBLIC_APP_URL}/api/admin/mail/callback/gmail`
     - For example: `https://crescent.example.com/api/admin/mail/callback/gmail`
5. Copy the **Client ID** and **Client Secret** into `.env`:

```bash
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
```

Restart the app:

```bash
docker compose up -d
```

## 3. Connect a Gmail account

1. Visit `${NEXT_PUBLIC_APP_URL}/admin/login` and enter your `ADMIN_API_TOKEN`.
2. You'll land on `/admin/mail`. Click **Connect a Gmail account**.
3. Sign in with the Google account whose mailbox should be polled. Approve the requested scopes.
4. You'll land back on `/admin/mail` with the new account listed.

The worker container picks up the account on its next tick (default 60 seconds) and begins polling. By default it looks for mail from `instant-updates@mail.zillow.com` and `my-saved-home@mail.zillow.com` and applies the label `Crescent/Processed` to each message it ingests.

## 4. Verify

After the first poll cycle:

- `/admin/mail` should show a recent **Last sync** timestamp and an incrementing **Messages seen** count.
- New listings appear at `/` and `/data`.
- In the connected Gmail account, processed messages now carry the `Crescent/Processed` label.

If anything fails the **Last error** column on `/admin/mail` shows the reason. The worker uses exponential backoff on consecutive errors (max 15 minutes between retries).

## Operational notes

- **Refresh-token expiry.** Google OAuth refresh tokens expire after 7 days for projects in *Testing*. Move the consent screen to *Production* when you're ready — otherwise reconnect every week.
- **Token rotation.** When the worker refreshes an access token, the new ciphertext is written back to `MailAccount.encryptedTokens` atomically.
- **Adding more mailboxes.** Repeat step 3. Each `MailAccount` is polled independently.
- **Disabling an account.** Set `enabled = false` on the row. The worker will skip it on the next tick.
- **Manual reprocess.** Remove the `Crescent/Processed` label from any message in Gmail; the worker will pick it up again on the next poll.

## What's not implemented yet

- Microsoft Graph (Outlook / Microsoft 365) provider.
- Generic IMAP fallback.
- Gmail Pub/Sub push subscriptions (currently the worker polls).
- HUD FMR rent enrichment in-app (the n8n workflow used to do this; the Crescent worker does not yet).
