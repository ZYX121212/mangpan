const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";

export function validPlayerId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{10,80}$/.test(value);
}

export async function opaquePlayerId(userId: string) {
  const bytes = new TextEncoder().encode(`mangpan-player:${userId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `user_${Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function requestPlayerId(
  request: Request,
  fallback: unknown,
): Promise<string | undefined> {
  const authenticated = request.headers.get(USER_ID_HEADER);
  if (authenticated) return opaquePlayerId(authenticated);
  return validPlayerId(fallback) ? fallback : undefined;
}

export function requestDisplayName(request: Request) {
  const encoded = request.headers.get(USER_FULL_NAME_HEADER);
  if (
    !encoded ||
    request.headers.get(USER_FULL_NAME_ENCODING_HEADER) !==
      "percent-encoded-utf-8"
  )
    return null;
  try {
    return decodeURIComponent(encoded).trim().slice(0, 24) || null;
  } catch {
    return null;
  }
}
