import Link from "next/link";
import type { ComponentProps } from "react";

export type AppLinkProps = ComponentProps<typeof Link>;

/**
 * next/link with prefetch off by default - avoids RSC/ISR origin + edge
 * traffic from in-viewport chrome links on Hobby.
 */
export default function AppLink({ prefetch = false, ...props }: AppLinkProps) {
  return <Link prefetch={prefetch} {...props} />;
}
