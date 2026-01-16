import { google } from "googleapis";
import type { Secrets } from "../config";
import type { GoogleUserProfile } from "../db/users";

const SCOPES = ["openid", "email", "profile"];
const DEFAULT_REDIRECT_URI = "http://localhost:3001/api/auth/google/callback";

export function isGoogleAuthConfigured(secrets: Secrets): boolean {
  return Boolean(secrets.google_oauth_client_id && secrets.google_oauth_client_secret);
}

export function getGoogleAuthRedirectUri(_secrets: Secrets): string {
  return DEFAULT_REDIRECT_URI;
}

function createOAuth2Client(secrets: Secrets) {
  const clientId = secrets.google_oauth_client_id;
  const clientSecret = secrets.google_oauth_client_secret;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  return new google.auth.OAuth2(clientId, clientSecret, getGoogleAuthRedirectUri(secrets));
}

export function generateGoogleAuthUrl(secrets: Secrets, state: string): string {
  const oauth2Client = createOAuth2Client(secrets);

  return oauth2Client.generateAuthUrl({
    access_type: "online",
    scope: SCOPES,
    state,
    prompt: "select_account",
  });
}

export async function exchangeCodeForGoogleProfile(
  secrets: Secrets,
  code: string
): Promise<GoogleUserProfile> {
  const oauth2Client = createOAuth2Client(secrets);
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.id_token) {
    throw new Error("Google OAuth did not return an id_token");
  }

  const ticket = await oauth2Client.verifyIdToken({
    idToken: tokens.id_token,
    audience: secrets.google_oauth_client_id,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub) {
    throw new Error("Unable to verify Google profile");
  }

  return {
    sub: payload.sub,
    email: payload.email ?? null,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}
