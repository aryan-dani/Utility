import ClipboardClient from "./ClipboardClient";

export const metadata = {
  title: "Clipboard",
  description: "Synced notes across your devices, with a 24-hour share code or link.",
};

export default function ClipboardPage() {
  return <ClipboardClient />;
}
