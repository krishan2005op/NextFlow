import { RNetAuth } from "@rnet-ai/rnet-oauth-node";
import { db } from "@/lib/db";

const auth = new RNetAuth({
  clientId: process.env.RNET_CLIENT_ID!,
  clientSecret: process.env.RNET_CLIENT_SECRET!,
  redirectUri: process.env.RNET_REDIRECT_URI!,
});

export async function getValidAccessToken(userId: string) {
  const connection = await db.aIConnection.findUnique({
    where: {
      userId,
    },
  });

  if (!connection) {
    throw new Error("rNet connection not found");
  }

  if (!connection.accessToken) {
    throw new Error("Missing access token");
  }

  if (!connection.refreshToken) {
    throw new Error("Missing refresh token");
  }

  if (
    connection.expiresAt &&
    connection.expiresAt.getTime() > Date.now() + 60_000
  ) {
    return connection.accessToken;
  }

  console.log("========== REFRESHING RNET TOKEN ==========");

  const refreshed = await auth.refreshAccessToken(
    connection.refreshToken
  );

  await db.aIConnection.update({
    where: {
      userId,
    },
    data: {
      accessToken: refreshed.access_token,
      refreshToken:
        refreshed.refresh_token ??
        connection.refreshToken,
      expiresAt: refreshed.expires_in
        ? new Date(
            Date.now() + refreshed.expires_in * 1000
          )
        : null,
    },
  });

  console.log("========== TOKEN REFRESHED ==========");

  return refreshed.access_token;
}