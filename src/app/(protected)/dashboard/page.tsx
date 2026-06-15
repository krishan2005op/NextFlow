import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - NextFlow",
  description: "Manage your AI workflows",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
