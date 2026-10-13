import type { Metadata } from "next";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  robots: PRIVATE_ROBOTS,
};

export default function ClipboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
