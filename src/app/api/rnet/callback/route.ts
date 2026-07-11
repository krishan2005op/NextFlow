import { NextRequest, NextResponse } from "next/server";
import { RNetAuth } from "@rnet-ai/rnet-oauth-node";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
const auths = new RNetAuth({
  clientId: process.env.RNET_CLIENT_ID!,
  clientSecret: process.env.RNET_CLIENT_SECRET!,
  redirectUri: process.env.RNET_REDIRECT_URI!,
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.json(
      { error: "Missing authorization code" },
      { status: 400 }
    );
  }

  const storedVerifier = request.cookies.get("rnet_verifier")?.value;
  const storedState = request.cookies.get("rnet_state")?.value;

  if (!storedVerifier) {
    return NextResponse.json(
      { error: "Missing PKCE verifier" },
      { status: 400 }
    );
  }

  if (storedState !== state) {
    return NextResponse.json(
      { error: "Invalid OAuth state" },
      { status: 400 }
    );
  }

  try {
    const tokens = await auths.exchangeCodeForToken(
      code,
      storedVerifier
    );
    const { userId: clerkId } = await auth();

if (!clerkId) {
  return NextResponse.json(
    { error: "User not authenticated" },
    { status: 401 }
  );
}

const user = await db.user.findUnique({
  where: {
    clerkId,
  },
});

if (!user) {
  return NextResponse.json(
    { error: "User not found" },
    { status: 404 }
  );
}
    await db.aIConnection.upsert({
  where: {
    userId: user.id,
  },
  update: {
  provider: "RNET",
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresAt: tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null,
},

create: {
  userId: user.id,
  provider: "RNET",
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresAt: tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null,
},
});
return NextResponse.redirect(
  new URL("/dashboard", request.url)
);

  } catch (error) {
  console.error("========== RNET ERROR ==========");
  console.error(error);

  if (error instanceof Error) {
    console.error(error.message);
    console.error(error.stack);
  }

  console.error("================================");

  return NextResponse.json(
    {
      error: "Failed to exchange code for token",
    },
    { status: 500 }
  );
}
}