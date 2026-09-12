"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  ImagePlus,
  X,
  Loader2,
  UploadCloud,
  Eye,
  BookOpen,
  FileText,
} from "lucide-react";
import { Button, Modal, Textarea, Input, Select } from "@/components/ui";
import {
  QUESTION_CATEGORIES,
  QUESTION_BODY_MAX,
  ATTACHMENT_MAX,
  type QuestionCategory,
} from "@/lib/qa/types";
import { compressImageFile } from "@/lib/qa/imageUtils";
import type { ResourceItem } from "@/lib/dataFetcher";
import QAImageViewer from "./QAImageViewer";

interface QuestionComposerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    subject_name: string;
    resource_id?: string;
    resource_title?: string;
    resource_url?: string;
    category: QuestionCategory;
    topic_unit: string;
    body: string;
    attachments: string[];
  }) => Promise<void>;
  initialSubject?: string;
  subjectName?: string;
  availableSubjects?: string[];
  availableResources?: ResourceItem[];
}

export default function QuestionComposer({
  open,
  onClose,
  onSubmit,
  initialSubject,
  subjectName,
  availableSubjects = [],
  availableResources = [],
}: QuestionComposerProps) {
  const effectiveInitial = initialSubject || subjectName;
  const [subject, setSubject] = useState(
    () => effectiveInitial || availableSubjects[0] || "General",
  );
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [customSubject, setCustomSubject] = useState("");

  const [selectedResourceId, setSelectedResourceId] = useState<string>("none");
  const [customReference, setCustomReference] = useState("");

  const [category, setCategory] = useState<QuestionCategory>("doubt");
  const [topicUnit, setTopicUnit] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Sync initialSubject when modal opens or initial subject changes (React-recommended pattern)
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitial, setPrevInitial] = useState(effectiveInitial);

  if (open !== prevOpen || effectiveInitial !== prevInitial) {
    setPrevOpen(open);
    setPrevInitial(effectiveInitial);
    if (open) {
      if (effectiveInitial && effectiveInitial !== "all") {
        setSubject(effectiveInitial);
        setIsCustomSubject(false);
      } else if (availableSubjects.length > 0) {
        setSubject(availableSubjects[0]);
        setIsCustomSubject(false);
      }
    }
  }

  // Derived list of resources for the currently active subject
  const currentActiveSubject = isCustomSubject ? customSubject.trim() : subject;

  const subjectResources = useMemo(() => {
    if (!currentActiveSubject || availableResources.length === 0) return [];
    const lower = currentActiveSubject.toLowerCase();
    return availableResources.filter((r) => {
      const matchSubject = (r.subject_name || "").toLowerCase() === lower;
      const isDoc =
        r.category === "notes" ||
        r.category === "ppt" ||
        r.category === "question-bank";
      return matchSubject && isDoc;
    });
  }, [availableResources, currentActiveSubject]);

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

  const handleSubmit = async () => {
    if (!body.trim() || isSubmitting) return;

    const resolvedSubject =
      (isCustomSubject ? customSubject.trim() : subject.trim()) || "General";

    let resource_id: string | undefined = undefined;
    let resource_title: string | undefined = undefined;
    let resource_url: string | undefined = undefined;

    if (selectedResourceId === "custom") {
      resource_title = customReference.trim() || undefined;
    } else if (selectedResourceId && selectedResourceId !== "none") {
      const match = subjectResources.find((r) => r.id === selectedResourceId);
      if (match) {
        resource_id = match.id;
        resource_title = match.title;
        resource_url = match.file_url;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        subject_name: resolvedSubject,
        resource_id,
        resource_title,
        resource_url,
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
      setSelectedResourceId("none");
      setCustomReference("");
      setIsCustomSubject(false);
      setCustomSubject("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-0.5">
              Ask Doubt or Academic Discussion
            </p>
            <p className="text-base font-bold text-foreground flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <span>{currentActiveSubject || "Select Subject"}</span>
            </p>
          </div>
        }
      >
        <div
          className="space-y-5 relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handlePaste}
        >
          {/* Drag and drop overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-30 bg-card/95 border-2 border-dashed border-foreground/40 rounded-2xl flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
              <UploadCloud className="w-10 h-10 text-foreground animate-bounce mb-2" />
              <p className="text-sm font-bold text-foreground">Drop image file here</p>
              <p className="text-xs text-muted">Supports PNG, JPG, WebP (auto-compressed)</p>
            </div>
          )}

          {/* Subject Selection Row */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-muted" />
                <span>Subject Name</span>
              </label>
              {availableSubjects.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomSubject((v) => !v);
                    if (!isCustomSubject) setCustomSubject("");
                  }}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  {isCustomSubject ? "Pick from catalog" : "+ Custom Subject"}
                </button>
              )}
            </div>

            {isCustomSubject || availableSubjects.length === 0 ? (
              <Input
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value.slice(0, 120))}
                placeholder="e.g. Distributed Systems or Machine Learning"
                className="rounded-xl"
                autoFocus={isCustomSubject}
              />
            ) : (
              <Select<string>
                value={subject}
                onChange={(val) => {
                  if (val === "__custom__") {
                    setIsCustomSubject(true);
                    setCustomSubject("");
                  } else {
                    setSubject(val);
                  }
                }}
                options={[
                  ...availableSubjects.map((s) => ({ value: s, label: s })),
                  { value: "__custom__", label: "+ Enter custom subject name…" },
                ]}
                size="md"
                className="w-full"
              />
            )}
          </div>

          {/* Optional: Referenced Notes or PPT */}
          <div className="rounded-xl border border-border/70 bg-surface/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted" />
                <span>Referenced Notes / PPT</span>
                <span className="font-normal text-muted text-[11px]">(optional)</span>
              </label>
              {subjectResources.length > 0 && (
                <span className="text-[10px] text-muted">
                  {subjectResources.length} files available for this subject
                </span>
              )}
            </div>

            {subjectResources.length > 0 ? (
              <div className="space-y-2">
                <Select<string>
                  value={selectedResourceId}
                  onChange={setSelectedResourceId}
                  options={[
                    { value: "none", label: "None: not referring to a specific note or PPT" },
                    ...subjectResources.map((res) => ({
                      value: res.id,
                      label: `${res.category === "ppt" ? "📊 [PPT] " : "📄 [Notes] "}${res.title}`,
                    })),
                    { value: "custom", label: "✍️ Specific slide, page, or other reference…" },
                  ]}
                  size="sm"
                  className="w-full"
                />

                {selectedResourceId === "custom" && (
                  <Input
                    value={customReference}
                    onChange={(e) => setCustomReference(e.target.value.slice(0, 180))}
                    placeholder="e.g. Unit 2 PPT Slide 15 or Handout Pg 8"
                    className="rounded-xl text-xs"
                    autoFocus
                  />
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  value={customReference}
                  onChange={(e) => {
                    setCustomReference(e.target.value.slice(0, 180));
                    setSelectedResourceId(e.target.value.trim() ? "custom" : "none");
                  }}
                  placeholder="e.g. Module 1 Slide 24 or Unit 3 Handwritten Notes"
                  className="rounded-xl text-xs"
                />
                <p className="text-[10px] text-muted">
                  Mention the specific slide, handout, or notes page if your doubt is based on them.
                </p>
              </div>
            )}
          </div>

          {/* Category selection cards */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">
              Question Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUESTION_CATEGORIES.map((cat) => {
                const isSelected = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`flex flex-col text-left p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-foreground text-background border-foreground shadow-sm"
                        : "bg-surface/40 hover:bg-surface/80 border-border/80 text-foreground"
                    }`}
                  >
                    <span className="text-xs font-bold leading-tight">{cat.label}</span>
                    <span
                      className={`text-[10px] leading-normal mt-0.5 ${
                        isSelected ? "text-background/80" : "text-muted"
                      }`}
                    >
                      {cat.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topic / Unit */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Topic or Exam Year / Unit{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <Input
              value={topicUnit}
              onChange={(e) => setTopicUnit(e.target.value.slice(0, 80))}
              placeholder="e.g. Dec 2024 PYQ Q.3(a) or Unit 3 (Mathematical Induction)"
              className="rounded-xl"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">
                Question Statement & Details
              </label>
              <span className="text-[10px] text-muted">
                Tip: Paste screenshots directly (Ctrl+V)
              </span>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, QUESTION_BODY_MAX))}
              placeholder="Type your question statement, formula details, or steps where you're stuck…"
              className="min-h-[120px] resize-y rounded-xl"
            />
            <p className="text-[10px] text-muted mt-1 text-right">
              {body.length} / {QUESTION_BODY_MAX}
            </p>
          </div>

          {/* Attachments & Drag-Drop area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">
                Attachments{" "}
                <span className="font-normal text-muted">
                  ({attachments.length}/{ATTACHMENT_MAX})
                </span>
              </label>
            </div>

            {/* Attachment preview grid */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mb-3">
                {attachments.map((url, i) => (
                  <div
                    key={i}
                    className="relative group w-20 h-20 rounded-xl overflow-hidden border border-border bg-surface/60 shadow-xs"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Attachment ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewImageIndex(i)}
                        className="p-1 rounded-md bg-white/20 hover:bg-white/40 text-white transition-all"
                        title="View Fullscreen"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="p-1 rounded-md bg-destructive/80 hover:bg-destructive text-white transition-all"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Image Dropzone Button */}
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
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-border hover:border-foreground/40 bg-surface/30 hover:bg-surface/60 transition-all text-xs text-muted hover:text-foreground disabled:opacity-50 group"
            >
              <ImagePlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>
                <strong className="text-foreground">Click to upload</strong> or drag & drop handwritten notes / paper photos
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4 mt-6">
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
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Post Question
          </Button>
        </div>
      </Modal>

      {/* Fullscreen Image Preview Lightbox */}
      <QAImageViewer
        open={previewImageIndex !== null}
        images={attachments}
        initialIndex={previewImageIndex ?? 0}
        onClose={() => setPreviewImageIndex(null)}
      />
    </>
  );
}
