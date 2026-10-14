import { redirect } from "next/navigation";
import { normalizeShareCode } from "@/lib/clipboard";

export default async function ShortClipboardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/clipboard/s/${normalizeShareCode(code)}`);
}
