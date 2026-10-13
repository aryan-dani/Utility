import type { Metadata } from "next";
import { indexableMeta } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Install",
  ...indexableMeta("/install"),
};

export default function InstallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
