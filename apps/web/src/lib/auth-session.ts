import { getCurrentUser, refreshAccessToken } from "@/lib/api";
import { clearSession, getSession, saveSession, type AuthSession } from "@/lib/session";

export async function ensureAuthenticatedSession(): Promise<AuthSession> {
  const session = getSession();
  if (!session) {
    throw new Error("NO_SESSION");
  }

  try {
    const user = await getCurrentUser(session.accessToken);
    const nextSession: AuthSession = { ...session, user };
    saveSession(nextSession);
    return nextSession;
  } catch {
    try {
      const refreshed = await refreshAccessToken(session.refreshToken);
      const user = await getCurrentUser(refreshed.access_token);
      const nextSession: AuthSession = {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        user,
      };
      saveSession(nextSession);
      return nextSession;
    } catch {
      clearSession();
      throw new Error("SESSION_EXPIRED");
    }
  }
}
