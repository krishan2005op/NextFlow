import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Dashboard - NextFlow",
  description: "Manage your AI workflows",
};

export default async function DashboardPage() {
  const { userId: clerkId } = await auth();

  let rnetConnected = false;

  if (clerkId) {
    const user = await db.user.findUnique({
  where: {
    clerkId,
  },
});

const connection = user
  ? await db.aIConnection.findUnique({
      where: {
        userId: user.id,
      },
    })
  : null;

rnetConnected = !!connection;
  }

  return (
    <DashboardClient
      rnetConnected={rnetConnected}
    />
  );
}