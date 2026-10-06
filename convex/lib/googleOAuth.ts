const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

declare const process: { env: Record<string, string | undefined> };

export const LEGACY_GMAIL_READONLY_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly";
export const GOOGLE_CALENDAR_LIST_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
export const GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.readonly";
export const GOOGLE_CALENDAR_EVENTS_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";
export const GOOGLE_IDENTITY_SCOPES = ["openid", "email"] as const;
export type GoogleOAuthCapability = "calendar_read" | "calendar_write";
export type StoredGoogleOAuthCapability = GoogleOAuthCapability | "gmail";

export function getGoogleCapabilityScopes(capability: GoogleOAuthCapability) {
  if (capability === "calendar_read") {
    return [GOOGLE_CALENDAR_LIST_READONLY_SCOPE, GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE];
  }
  return [GOOGLE_CALENDAR_LIST_READONLY_SCOPE, GOOGLE_CALENDAR_EVENTS_SCOPE];
}

export function hasGoogleCapability(
  scopes: readonly string[],
  capability: GoogleOAuthCapability,
) {
  const scopeSet = new Set(scopes);
  if (capability === "calendar_read") {
    return (
      scopeSet.has(GOOGLE_CALENDAR_LIST_READONLY_SCOPE) &&
      (scopeSet.has(GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE) ||
        scopeSet.has(GOOGLE_CALENDAR_EVENTS_SCOPE))
    );
  }
  return getGoogleCapabilityScopes(capability).every((scope) => scopeSet.has(scope));
}

export function hasLegacyGmailScope(scopes: readonly string[]) {
  return scopes.includes(LEGACY_GMAIL_READONLY_SCOPE);
}

export class GoogleIntegrationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "GoogleIntegrationError";
  }
}

function requireEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new GoogleIntegrationError("GOOGLE_CONFIGURATION_MISSING");
  return value;
}

export function getGoogleOAuthConfiguration() {
  return {
    clientId: requireEnvironmentValue("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: requireEnvironmentValue("GOOGLE_OAUTH_CLIENT_SECRET"),
    redirectUri: requireEnvironmentValue("GOOGLE_OAUTH_REDIRECT_URI"),
  };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new GoogleIntegrationError("GOOGLE_ENCRYPTION_KEY_INVALID");
  }
}

async function getEncryptionKey() {
  const bytes = base64ToBytes(
    requireEnvironmentValue("GOOGLE_TOKEN_ENCRYPTION_KEY"),
  );
  if (bytes.byteLength !== 32) {
    throw new GoogleIntegrationError("GOOGLE_ENCRYPTION_KEY_INVALID");
  }
  return await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptRefreshToken(refreshToken: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(refreshToken),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    keyVersion: process.env.GOOGLE_TOKEN_KEY_VERSION?.trim() || undefined,
  };
}

export async function decryptRefreshToken(ciphertext: string, iv: string) {
  try {
    const key = await getEncryptionKey();
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(iv) },
      key,
      base64ToBytes(ciphertext),
    );
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    if (error instanceof GoogleIntegrationError) throw error;
    throw new GoogleIntegrationError("GOOGLE_CREDENTIAL_DECRYPT_FAILED");
  }
}

export function createOAuthState() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export async function hashOAuthState(state: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(state),
  );
  return bytesToBase64(new Uint8Array(digest));
}

export function buildGoogleAuthorizationUrl(
  state: string,
  capability: GoogleOAuthCapability,
) {
  const { clientId, redirectUri } = getGoogleOAuthConfiguration();
  const parameters = new URLSearchParams({
    access_type: "offline",
    client_id: clientId,
    prompt: "consent select_account",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [...GOOGLE_IDENTITY_SCOPES, ...getGoogleCapabilityScopes(capability)].join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${parameters.toString()}`;
}

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

async function readGoogleErrorCode(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function exchangeAuthorizationCode(code: string) {
  const configuration = getGoogleOAuthConfiguration();
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: configuration.redirectUri,
    }),
  });
  if (!response.ok) {
    throw new GoogleIntegrationError("GOOGLE_CODE_EXCHANGE_FAILED");
  }
  const tokens = (await response.json()) as GoogleTokenResponse;
  if (!tokens.access_token) {
    throw new GoogleIntegrationError("GOOGLE_CODE_EXCHANGE_FAILED");
  }
  return tokens;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const configuration = getGoogleOAuthConfiguration();
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    const code = await readGoogleErrorCode(response);
    throw new GoogleIntegrationError(
      code === "invalid_grant"
        ? "GOOGLE_REAUTH_REQUIRED"
        : "GOOGLE_TOKEN_REFRESH_FAILED",
    );
  }
  const tokens = (await response.json()) as GoogleTokenResponse;
  if (!tokens.access_token) {
    throw new GoogleIntegrationError("GOOGLE_TOKEN_REFRESH_FAILED");
  }
  return tokens.access_token;
}

export async function getGoogleAccountIdentity(accessToken: string) {
  const response = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new GoogleIntegrationError("GOOGLE_IDENTITY_FAILED");
  }
  const identity = (await response.json()) as { sub?: string; email?: string };
  if (!identity.sub) {
    throw new GoogleIntegrationError("GOOGLE_IDENTITY_FAILED");
  }
  return { googleAccountId: identity.sub, email: identity.email };
}
