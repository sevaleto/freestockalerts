/**
 * Facebook / Instagram / Messenger open links in an embedded webview where
 * Google OAuth is blocked ("disallowed_useragent"). Detect it so we can hide
 * the Google button and keep the email path front and center.
 */
export function isInAppBrowser(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|MicroMessenger/i.test(ua);
}
