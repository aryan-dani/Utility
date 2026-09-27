"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Copy } from "lucide-react";
import { auth } from "@/lib/firebase/auth";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { notify } from "@/lib/toast";
import Link from "next/link";

const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID || "daniaryan212@okicici";
const UPI_NAME = process.env.NEXT_PUBLIC_UPI_NAME || "Aryan Dani";

const PRESETS = [20, 50, 100, 250] as const;

export default function SupportClient() {
  const [, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [qrLoading, setQrLoading] = useState(true);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTxnId, setFormTxnId] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setFormName(user.displayName || "");
        setFormEmail(user.email || "");
      }
    });
    return () => unsubscribe();
  }, []);

  const selectPreset = (value: number) => {
    setAmount(value);
    setCustomAmount("");
    setQrLoading(true);
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d+$/.test(val)) {
      setCustomAmount(val);
      const numVal = parseInt(val, 10);
      setAmount(Number.isNaN(numVal) ? 0 : numVal);
      setQrLoading(true);
    }
  };

  const handleCopyUPI = async () => {
    try {
      await notify.promise(navigator.clipboard.writeText(UPI_ID), {
        loading: "Copying…",
        success: "UPI ID copied",
        error: "Could not copy UPI ID",
        id: "support-upi-copy",
      });
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // notify.promise already surfaced the error
    }
  };

  const upiUrl = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=Support%20Utility`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}&margin=8`;

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      notify.error("Choose an amount first");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      notify.error("Sign in to send a support message");
      return;
    }

    setIsSubmitting(true);
    try {
      await notify.promise(
        (async () => {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/support", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              name: formName,
              email: formEmail,
              txnId: formTxnId.trim(),
              message: formMessage.trim(),
              amount,
            }),
          });
          if (!res.ok) throw new Error(await res.text());
        })(),
        {
          loading: "Sending message…",
          success: "Thanks. Message saved.",
          error: "Could not send message",
          id: "support-submit",
        }
      );
      setIsSubmitted(true);
      setFormTxnId("");
      setFormMessage("");
    } catch {
      // notify.promise already surfaced the error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-16">
      <section className="space-y-8">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">Amount</h2>
          <p className="text-sm text-muted mb-5">
            Pick a preset or enter your own.
          </p>

          <div
            className="inline-flex flex-wrap gap-1 p-1 border border-border bg-surface/60 rounded-lg"
            role="group"
            aria-label="Contribution amount"
          >
            {PRESETS.map((value) => {
              const active = !customAmount && amount === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectPreset(value)}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    active
                      ? "bg-foreground text-background font-medium"
                      : "text-foreground-subtle hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  ₹{value}
                </button>
              );
            })}
          </div>

          <div className="mt-4 relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              ₹
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={customAmount}
              onChange={handleCustomAmountChange}
              placeholder="Custom"
              className="w-full pl-7 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted focus:border-foreground/40"
            />
          </div>
        </div>

        <div className="border-t border-border pt-8 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-8 items-start">
          <div className="mx-auto sm:mx-0">
            <div className="relative w-[220px] h-[220px] bg-white p-2 border border-border flex items-center justify-center">
              {qrLoading && (
                <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
                  <div className="w-6 h-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
                </div>
              )}
              <Image
                src={qrCodeUrl}
                alt="UPI payment QR code"
                width={220}
                height={220}
                unoptimized
                onLoad={() => setQrLoading(false)}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="mt-3 text-center sm:text-left text-2xl font-semibold text-foreground tracking-tight">
              ₹{amount || "-"}
            </p>
          </div>

          <div className="space-y-3 sm:pt-2">
            <p className="text-sm text-foreground-subtle leading-relaxed max-w-sm">
              Scan with any UPI app, or copy the ID / open your app below.
            </p>
            <button
              type="button"
              onClick={handleCopyUPI}
              className="w-full sm:w-auto flex items-center justify-between gap-3 px-4 py-2.5 border border-border hover:border-border-strong bg-card text-sm text-foreground rounded-lg"
            >
              <span className="truncate">
                <span className="text-muted">UPI </span>
                <span className="font-medium">{UPI_ID}</span>
              </span>
              {isCopied ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <Copy className="w-4 h-4 text-muted shrink-0" />
              )}
            </button>
            <a
              href={upiUrl}
              className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-2.5 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90"
            >
              Open UPI app
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-border pt-10">
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Optional note
        </h2>
        <p className="text-sm text-muted mb-6 max-w-md">
          After you pay, leave a short message if you like. Not required.
        </p>

        {isSubmitted ? (
          <div className="py-6 space-y-2">
            <p className="text-sm font-medium text-foreground">Message saved.</p>
            <p className="text-sm text-muted">Thank you for supporting Utility.</p>
            <button
              type="button"
              onClick={() => setIsSubmitted(false)}
              className="text-sm text-foreground underline underline-offset-4 mt-2"
            >
              Send another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitMessage} className="space-y-4 max-w-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs text-muted mb-1.5">Name</span>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-muted mb-1.5">Email</span>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                />
              </label>
            </div>
            <label className="block">
              <span className="block text-xs text-muted mb-1.5">
                Transaction ID (optional)
              </span>
              <input
                type="text"
                value={formTxnId}
                onChange={(e) => setFormTxnId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-muted mb-1.5">Message</span>
              <textarea
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground resize-none"
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              className="px-5 py-2.5 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-40"
            >
              {isSubmitting ? "Sending…" : "Send note"}
            </button>
          </form>
        )}
      </section>

      <p className="pt-4">
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground underline underline-offset-4"
        >
          Back home
        </Link>
      </p>
    </div>
  );
}
