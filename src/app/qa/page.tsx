"use client";

import dynamic from "next/dynamic";

const QABoardView = dynamic(() => import("@/components/qa/QABoardView"), {
  ssr: false,
});

export default function QAPage() {
  return <QABoardView />;
}
