import ClipboardClient from "./ClipboardClient";

export const metadata = {
  title: "Clipboard",
  description: "Synced notes across your devices, with optional 24-hour share links.",
};

export default function ClipboardPage() {
  return <ClipboardClient />;
}
