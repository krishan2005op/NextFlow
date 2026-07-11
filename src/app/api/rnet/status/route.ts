import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const user = await db.user.findUnique({
    where: {
      clerkId,
    },
  });

  if (!user) {
    return NextResponse.json({
      connected: false,
    });
  }

  const connection = await db.aIConnection.findUnique({
    where: {
      userId: user.id,
    },
  });

  if (!connection) {
    return NextResponse.json({
      connected: false,
    });
  }

  return NextResponse.json({
    connected: true,
    provider: connection.provider,
  });
}