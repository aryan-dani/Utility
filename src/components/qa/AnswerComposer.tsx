"use client";

import { useState, useRef, useCallback } from "react";
import {
  Send,
  ImagePlus,
  X,
  Loader2,
  UploadCloud,
  Eye,
  Bold,
  Code,
  Quote,
  List,
} from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { ANSWER_BODY_MAX, ATTACHMENT_MAX } from "@/lib/qa/types";
import { compressImageFile } from "@/lib/qa/imageUtils";
import QAImageViewer from "./QAImageViewer";

interface AnswerComposerProps {
  onSubmit: (body: string, attachments: string[]) => Promise<void>;
  placeholder?: string;
}

export default function AnswerComposer({ onSubmit, placeholder }: AnswerComposerProps) {
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const processImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 15 * 1024 * 1024) return;
    try {
      const compressed = await compressImageFile(file);
      setAttachments((prev) => {
        if (prev.length >= ATTACHMENT_MAX) return prev;
        return [...prev, compressed];
      });
    } catch (err) {
      console.error("Failed to process attachment", err);
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (attachments.length >= ATTACHMENT_MAX) break;
      await processImageFile(file);
    }
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (attachments.length >= ATTACHMENT_MAX) break;
      await processImageFile(file);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await processImageFile(file);
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const insertFormatting = (prefix: string, suffix = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.slice(start, end) || "text";
    const replacement = `${prefix}${selected}${suffix}`;
    const nextValue = text.slice(0, start) + replacement + text.slice(end);
    setBody(nextValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length,
      );
    }, 0);
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
    <>
      <div
        className="relative rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        {/* Drag and drop active banner */}
        {isDragging && (
          <div className="absolute inset-0 z-20 bg-card/95 border-2 border-dashed border-foreground/40 rounded-2xl flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
            <UploadCloud className="w-8 h-8 text-foreground animate-bounce mb-2" />
            <p className="text-xs font-bold text-foreground">Drop image file to attach</p>
            <p className="text-3xs text-muted">PNG, JPG, WebP supported</p>
          </div>
        )}

        {/* Formatting toolbar */}
        <div className="flex items-center gap-1 mb-2.5 pb-2 border-b border-border/50">
          <button
            type="button"
            onClick={() => insertFormatting("**", "**")}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface/80 active:scale-95 transition-all"
            title="Bold (**text**)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("`", "`")}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface/80 active:scale-95 transition-all"
            title="Inline code (`code`)"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("> ")}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface/80 active:scale-95 transition-all"
            title="Quote (> quote)"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("- ")}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface/80 active:scale-95 transition-all"
            title="Bullet list (- item)"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1" />

          <span className="text-[10px] text-muted font-mono">
            {body.length}/{ANSWER_BODY_MAX}
          </span>
        </div>

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, ANSWER_BODY_MAX))}
          placeholder={
            placeholder ||
            "Write a helpful step-by-step solution, theorem proof, or explanation… (Paste screenshots with Ctrl+V)"
          }
          className="min-h-[100px] resize-y mb-3 border-0 bg-transparent p-0 focus:ring-0 text-sm shadow-none"
          disabled={isSubmitting}
        />

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2.5 mb-3 pt-2 border-t border-border/50">
            {attachments.map((url, i) => (
              <div
                key={i}
                className="relative group w-18 h-18 rounded-xl overflow-hidden border border-border bg-surface shadow-xs"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Attachment ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewImageIndex(i)}
                    className="p-1 rounded-md bg-white/20 hover:bg-white/40 text-white transition-all"
                    title="View Fullscreen"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="p-1 rounded-md bg-destructive/80 hover:bg-destructive text-white transition-all"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted hover:text-foreground hover:bg-surface border border-border/70 transition-all disabled:opacity-50 active:scale-95 shadow-xs"
              title="Attach handwritten solution or screenshot"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Attach Image</span>
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!body.trim() || isSubmitting}
            className="rounded-xl px-4 py-2 font-semibold shadow-sm"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Post Answer
          </Button>
        </div>
      </div>

      {/* Lightbox for attachments */}
      <QAImageViewer
        open={previewImageIndex !== null}
        images={attachments}
        initialIndex={previewImageIndex ?? 0}
        onClose={() => setPreviewImageIndex(null)}
      />
    </>
  );
}
