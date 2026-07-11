import { NextResponse } from "next/server";
import { RNetAuth } from "@rnet-ai/rnet-oauth-node";

const auth = new RNetAuth({
  clientId: process.env.RNET_CLIENT_ID!,
  clientSecret: process.env.RNET_CLIENT_SECRET!,
  redirectUri: process.env.RNET_REDIRECT_URI!,
});

export async function GET() {
  const { verifier, challenge } = auth.generatePKCE();

  const state = crypto.randomUUID();

  const authUrl = auth.getAuthorizationUrl(
    challenge,
    state
  );

  const response = NextResponse.redirect(authUrl);

  response.cookies.set("rnet_verifier", verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  response.cookies.set("rnet_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}