const returnPathKey = 'shukatsu-manager:google-oauth-return-path';

function safeReturnPath(path: string | null | undefined) {
  return path?.startsWith('/') && !path.startsWith('//') ? path : null;
}

export function startGoogleOAuth(authorizationUrl: string, returnPath: string) {
  const safePath = safeReturnPath(returnPath);
  if (safePath) window.sessionStorage.setItem(returnPathKey, safePath);
  window.location.assign(authorizationUrl);
}

export function takeGoogleOAuthReturnPath() {
  const path = safeReturnPath(window.sessionStorage.getItem(returnPathKey));
  window.sessionStorage.removeItem(returnPathKey);
  return path;
}
