/** Shared types for the Q&A doubt board. */

export type QuestionCategory = "doubt" | "general";
export type QuestionStatus = "open" | "resolved";
export type VoteTargetType = "question" | "answer";
export type VoteValue = 1 | -1;

// ─── Firestore document shapes ───────────────────────────────────────────────

export interface QAQuestion {
  id: string;
  academic_year: string;
  branch: string;
  semester: number;
  subject_name: string;
  resource_id?: string;
  resource_title?: string;
  resource_url?: string;
  topic_unit?: string;
  category: QuestionCategory;

  author_uid: string;
  author_name: string;
  body: string;
  attachments: string[];

  status: QuestionStatus;
  upvotes: number;
  answer_count: number;
  accepted_answer_id?: string;

  ai_auto_answered: boolean;
  ai_answer?: string;
  needs_human: boolean;

  created_at: string;
  last_activity_at: string;
}

export interface QAAnswer {
  id: string;
  question_id: string;
  author_uid: string;
  author_name: string;
  body: string;
  attachments: string[];
  upvotes: number;
  downvotes: number;
  is_accepted: boolean;
  created_at: string;
}

export interface QAVote {
  user_uid: string;
  target_type: VoteTargetType;
  target_id: string;
  value: VoteValue;
}

export interface QASavedItem {
  user_uid: string;
  question_id: string;
  created_at: string;
}

// ─── API request / response shapes ───────────────────────────────────────────

export type QuestionSortMode = "top" | "newest" | "unanswered";

export interface QAQuestionWithAnswers extends QAQuestion {
  answers: QAAnswer[];
  user_vote?: VoteValue | null;
  is_saved?: boolean;
}

// ─── Client-side ranking ─────────────────────────────────────────────────────

/** Deterministic ranking used in the Social tab and board view. */
export function rankQuestions(questions: QAQuestion[]): QAQuestion[] {
  return [...questions].sort((a, b) => {
    // 1. Unresolved before resolved
    if (a.status !== b.status) {
      return a.status === "open" ? -1 : 1;
    }
    // 2. Higher upvotes first
    if (a.upvotes !== b.upvotes) return b.upvotes - a.upvotes;
    // 3. Unanswered for longer → pushed up
    if (a.answer_count === 0 && b.answer_count > 0) return -1;
    if (b.answer_count === 0 && a.answer_count > 0) return 1;
    // 4. Older unanswered questions get priority (waiting longest)
    if (a.answer_count === 0 && b.answer_count === 0) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    // 5. Most recent activity
    return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
  });
}

export const QUESTION_CATEGORIES: { value: QuestionCategory; label: string; desc: string }[] = [
  { value: "doubt", label: "Doubt", desc: "Exam paper problems, past questions & step-by-step doubts" },
  { value: "general", label: "General", desc: "Syllabus scope, course queries & academic discussion" },
];

export const QUESTION_BODY_MAX = 5000;
export const ANSWER_BODY_MAX = 5000;
export const ATTACHMENT_MAX = 4;
