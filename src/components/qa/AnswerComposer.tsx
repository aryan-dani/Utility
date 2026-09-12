"use client";

import { useState, useRef } from "react";
import { Send, ImagePlus, X, Loader2 } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { ANSWER_BODY_MAX, ATTACHMENT_MAX } from "@/lib/qa/types";
import { compressImageFile } from "@/lib/qa/imageUtils";

interface AnswerComposerProps {
  onSubmit: (body: string, attachments: string[]) => Promise<void>;
  placeholder?: string;
}

export default function AnswerComposer({ onSubmit, placeholder }: AnswerComposerProps) {
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (attachments.length >= ATTACHMENT_MAX) break;
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 15 * 1024 * 1024) continue;

      try {
        const compressed = await compressImageFile(file);
        setAttachments((prev) => {
          if (prev.length >= ATTACHMENT_MAX) return prev;
          return [...prev, compressed];
        });
      } catch (err) {
        console.error("Failed to process attachment", err);
      }
    }

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!body.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(body.trim(), attachments);
      setBody("");
      setAttachments([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-t border-border bg-surface/40 p-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, ANSWER_BODY_MAX))}
        placeholder={placeholder || "Write your answer…"}
        className="min-h-[80px] resize-y mb-3"
        disabled={isSubmitting}
      />

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((url, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Attachment ${i + 1}`}
                className="w-16 h-16 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center text-muted hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={attachments.length >= ATTACHMENT_MAX || isSubmitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-surface border border-border transition-colors disabled:opacity-50"
            title="Attach image (handwritten solution, diagram, etc.)"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Image
          </button>
          <span className="text-3xs text-muted">
            {body.length}/{ANSWER_BODY_MAX}
          </span>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!body.trim() || isSubmitting}
          className="rounded-xl"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Post Answer
        </Button>
      </div>
    </div>
  );
}
