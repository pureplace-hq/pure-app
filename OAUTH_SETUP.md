# GitLab OAuth Setup Guide

This project uses **Authorization Code Flow with PKCE** for secure frontend-only OAuth authentication with GitLab.

## What's Implemented

✅ **PKCE Flow** - Secure OAuth for public clients (no client secret needed)
✅ **State Validation** - CSRF protection
✅ **Token Exchange** - Code to token exchange client-side
✅ **Session Management** - Token storage in sessionStorage
✅ **User Info Display** - Fetches and displays GitLab user profile
✅ **Logout** - Clears tokens and session

## Setup Instructions

### 1. Create a GitLab OAuth Application

1. Go to GitLab.com (or your self-hosted instance)
2. Navigate to **Settings** → **Applications** or use: https://gitlab.com/-/profile/applications
3. Click **"Add new application"**
4. Fill in the details:
   - **Name**: Your app name (e.g., "My SvelteKit App")
   - **Redirect URI**: `http://localhost:5173/auth/callback`
   - **Confidential**: **UNCHECK** this (we're using PKCE for public clients)
   - **Scopes**: Select `read_user`, `read_api`, and `write_repository`
5. Click **"Save application"**
6. Copy the **Application ID** (you won't need the secret for PKCE)

### 2. Configure Your Application

Copy the `.env.example` file to `.env` and update with your Application ID:

```bash
cp .env.example .env
```

**Edit `.env` file:**
```bash
VITE_GITLAB_CLIENT_ID=your-application-id-here
VITE_GITLAB_URL=https://gitlab.com
VITE_REDIRECT_URI=http://localhost:5173/auth/callback
```

### 3. Update URLs for Self-Hosted GitLab (Optional)

If using self-hosted GitLab, update the `.env` file:

```bash
VITE_GITLAB_URL=https://gitlab.your-domain.com
```

### 4. Run the Application

**Important:** Restart your dev server after changing `.env` file!

```bash
npm run dev
```

Visit http://localhost:5173 and click "Login with GitLab"

## How the PKCE Flow Works

1. **User clicks "Login with GitLab"**
   - Generates random `state` (CSRF protection)
   - Generates random `code_verifier` (PKCE secret)
   - Creates `code_challenge` (SHA-256 hash of verifier)
   - Stores `state` and `code_verifier` in sessionStorage
   - Redirects to GitLab with `code_challenge`

2. **User authenticates on GitLab**
   - GitLab shows authorization screen
   - User approves requested scopes

3. **GitLab redirects to callback**
   - Returns `code` and `state` as URL parameters
   - App validates `state` matches stored value
   - App exchanges `code` + `code_verifier` for `access_token`
   - No client secret required (PKCE validates the verifier)

4. **App stores token and fetches user info**
   - Stores `access_token` in sessionStorage
   - Fetches user profile from GitLab API
   - Displays user information

## Security Features

- ✅ **No Client Secret** - PKCE doesn't require secrets in frontend code
- ✅ **CSRF Protection** - State parameter prevents cross-site attacks
- ✅ **Code Verifier** - PKCE challenge/verifier prevents code interception
- ✅ **Token Validation** - App verifies token by fetching user profile

## Token Storage

Tokens are stored in `sessionStorage` (cleared when browser tab closes).

**Stored items:**
- `gitlab_access_token` - OAuth access token
- `gitlab_refresh_token` - Refresh token (if provided by GitLab)

**For production**, consider:
- Using `localStorage` for persistent sessions
- Implementing token refresh logic
- Adding token expiration handling
- Using secure HTTP-only cookies (requires backend)

## API Calls

To make authenticated GitLab API calls:

```typescript
const accessToken = sessionStorage.getItem('gitlab_access_token');

const response = await fetch('https://gitlab.com/api/v4/projects', {
  headers: {
    Authorization: `Bearer ${accessToken}`
  }
});
```

## Troubleshooting

**Error: "Invalid state parameter"**
- SessionStorage was cleared between redirect and callback
- Possible CSRF attack detected
- Solution: Try logging in again

**Error: "Missing code verifier"**
- SessionStorage doesn't persist across browser restarts
- Solution: Try logging in again

**Token Invalid**
- Token may have expired
- Solution: Implement refresh token logic or re-authenticate

**Redirect URI Mismatch**
- Ensure GitLab app has exact redirect URI: `http://localhost:5173/auth/callback`
- Check for trailing slashes and protocol (http vs https)

## Project Structure

```
src/routes/
├── +page.svelte              # Login page with user session management
└── auth/
    └── callback/
        └── +page.svelte      # OAuth callback handler
```

## Next Steps

Consider implementing:

- [ ] Environment variables for configuration
- [ ] Token refresh logic using refresh tokens
- [ ] Protected routes/middleware
- [ ] Better error handling and user feedback
- [ ] Token revocation on logout
- [ ] Auto-refresh tokens before expiration
- [ ] Store user state in a Svelte store for app-wide access

## Resources

- [Arctic OAuth Library](https://arctic.js.org/)
- [GitLab OAuth Documentation](https://docs.gitlab.com/ee/api/oauth2.html)
- [OAuth 2.0 PKCE RFC](https://datatracker.ietf.org/doc/html/rfc7636)
