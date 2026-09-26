import ClipboardShareClient from "./ClipboardShareClient";

export const metadata = {
  title: "Shared clipboard",
  description: "A 24-hour clipboard share from Utility OS.",
};

export default async function ClipboardSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClipboardShareClient shareId={id} />;
}
