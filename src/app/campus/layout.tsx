import type { Metadata } from "next";
import { indexableMeta } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Campus",
  ...indexableMeta("/campus"),
};

export default function CampusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
