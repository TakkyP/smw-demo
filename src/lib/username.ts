// Firebase Authentication identifies password users by email.
// We let people log in with a plain username and map it to a synthetic email.

const DOMAIN = process.env.NEXT_PUBLIC_USERNAME_EMAIL_DOMAIN || "worklist.local";

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${DOMAIN}`;
}
