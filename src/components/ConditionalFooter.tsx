"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

/** App shells that own the full viewport - hide the site footer. */
const HIDE_FOOTER_PREFIXES = [
  "/planner",
  "/ask",
  "/qa",
  "/visualize",
  "/login",
  "/signup",
  "/admin",
  "/profile",
  "/~offline",
];

export default function ConditionalFooter() {
  const pathname = usePathname();

  if (!pathname) return <Footer />;

  const hide = HIDE_FOOTER_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (hide) return null;

  return <Footer />;
}
