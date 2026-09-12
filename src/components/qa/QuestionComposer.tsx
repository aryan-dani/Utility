"use client";

import { useState, useRef } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { Button, Modal, Textarea, Segmented, Input } from "@/components/ui";
import {
  QUESTION_CATEGORIES,
  QUESTION_BODY_MAX,
  ATTACHMENT_MAX,
  type QuestionCategory,
} from "@/lib/qa/types";
import { compressImageFile } from "@/lib/qa/imageUtils";

interface QuestionComposerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    category: QuestionCategory;
    topic_unit: string;
    body: string;
    attachments: string[];
  }) => Promise<void>;
  subjectName: string;
}

export default function QuestionComposer({
  open,
  onClose,
  onSubmit,
  subjectName,
}: QuestionComposerProps) {
  const [category, setCategory] = useState<QuestionCategory>("doubt");
  const [topicUnit, setTopicUnit] = useState("");
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
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!body.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        category,
        topic_unit: topicUnit.trim(),
        body: body.trim(),
        attachments,
      });
      // Reset form
      setCategory("doubt");
      setTopicUnit("");
      setBody("");
      setAttachments([]);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Ask a question
          </p>
          <p className="text-base font-bold text-foreground">{subjectName}</p>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-muted mb-2">
            Category
          </label>
          <Segmented
            value={category}
            onChange={setCategory}
            size="sm"
            aria-label="Question category"
            options={QUESTION_CATEGORIES.map((c) => ({
              value: c.value,
              label: c.label,
            }))}
          />
        </div>

        {/* Topic / Unit */}
        <div>
          <label className="block text-xs font-semibold text-muted mb-2">
            Topic / Unit{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <Input
            value={topicUnit}
            onChange={(e) => setTopicUnit(e.target.value.slice(0, 80))}
            placeholder="e.g. Unit 3 — Linked Lists"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-xs font-semibold text-muted mb-2">
            Your question
          </label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, QUESTION_BODY_MAX))}
            placeholder="Describe your doubt, paste the problem statement, or ask about syllabus scope…"
            className="min-h-[120px] resize-y"
          />
          <p className="text-3xs text-muted mt-1 text-right">
            {body.length}/{QUESTION_BODY_MAX}
          </p>
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-xs font-semibold text-muted mb-2">
            Attachments{" "}
            <span className="font-normal text-muted">
              (handwritten work, diagrams — up to {ATTACHMENT_MAX})
            </span>
          </label>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((url, i) => (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Attachment ${i + 1}`}
                    className="w-20 h-20 rounded-lg border border-border object-cover"
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
            disabled={attachments.length >= ATTACHMENT_MAX}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-surface border border-dashed border-border transition-colors disabled:opacity-50"
          >
            <ImagePlus className="w-4 h-4" />
            Add image
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-5 mt-6">
        <Button variant="secondary" size="sm" onClick={onClose} className="rounded-xl">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!body.trim() || isSubmitting}
          className="rounded-xl"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : null}
          Ask Question
        </Button>
      </div>
    </Modal>
  );
}
