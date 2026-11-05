import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** pgvector column; stored as float[] in JS. */
const vector768 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(768)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    if (typeof value !== "string") return [];
    const inner = value.replace(/^\[/, "").replace(/\]$/, "");
    if (!inner) return [];
    return inner.split(",").map(Number);
  },
});

export const subjects = pgTable(
  "subjects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    academicYear: varchar("academic_year", { length: 16 }).notNull(),
    branch: varchar("branch", { length: 32 }).notNull(),
    semester: integer("semester").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("subjects_scope_idx").on(t.academicYear, t.branch, t.semester)],
);

export const resources = pgTable(
  "resources",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id").references(() => subjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category"),
    academicYear: varchar("academic_year", { length: 16 }).notNull(),
    branch: varchar("branch", { length: 32 }).notNull(),
    semester: integer("semester").notNull(),
    driveFileId: text("drive_file_id"),
    drivePath: text("drive_path"),
    driveModifiedAt: timestamp("drive_modified_at", { withTimezone: true }),
    mimeType: text("mime_type"),
    fileUrl: text("file_url"),
    /** Native mirror: { kind, hash, bytes, ext, convertedFrom? } */
    native: jsonb("native").$type<{
      kind: "pdf" | "image" | "text" | "notebook" | "other";
      hash: string;
      bytes: number;
      ext: string;
      convertedFrom?: string;
    } | null>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("resources_scope_idx").on(t.academicYear, t.branch, t.semester),
    index("resources_drive_idx").on(t.driveFileId),
  ],
);

export const resourceContent = pgTable("resource_content", {
  resourceId: text("resource_id")
    .primaryKey()
    .references(() => resources.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  aiSummary: text("ai_summary"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const resourceChunks = pgTable(
  "resource_chunks",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    sectionLabel: text("section_label"),
    sectionIndex: integer("section_index"),
    heading: text("heading"),
    chunkTokens: text("chunk_tokens").array().notNull().default([]),
    tokenCount: integer("token_count").notNull().default(0),
    academicYear: varchar("academic_year", { length: 16 }).notNull(),
    branch: varchar("branch", { length: 32 }).notNull(),
    semester: integer("semester").notNull(),
    embedding: vector768("embedding"),
    /** Generated tsvector for FTS — maintained by trigger in SQL migration. */
    searchTsv: text("search_tsv"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("chunks_resource_idx").on(t.resourceId),
    index("chunks_scope_idx").on(t.academicYear, t.branch, t.semester),
  ],
);

export const semanticCache = pgTable(
  "semantic_cache",
  {
    id: text("id").primaryKey(),
    academicYear: varchar("academic_year", { length: 16 }),
    branch: varchar("branch", { length: 32 }),
    semester: integer("semester"),
    resourceId: text("resource_id"),
    queryHash: text("query_hash").notNull(),
    queryText: text("query_text").notNull(),
    queryEmbedding: vector768("query_embedding"),
    responseJson: jsonb("response_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("semantic_cache_hash_idx").on(t.queryHash)],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    actionType: text("action_type").notNull(),
    loggedDate: varchar("logged_date", { length: 10 }).notNull(),
    count: integer("count").notNull().default(1),
    meta: jsonb("meta"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("activity_user_date_action_idx").on(
      t.userId,
      t.loggedDate,
      t.actionType,
    ),
    index("activity_user_date_idx").on(t.userId, t.loggedDate),
  ],
);

export const resourceUsage = pgTable(
  "resource_usage",
  {
    userId: text("user_id").notNull(),
    resourceId: text("resource_id").notNull(),
    count: integer("count").notNull().default(0),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.resourceId] })],
);

export const resourceTotals = pgTable("resource_totals", {
  resourceId: text("resource_id").primaryKey(),
  openCount: integer("open_count").notNull().default(0),
});

export const qaQuestions = pgTable(
  "qa_questions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    authorName: text("author_name"),
    academicYear: varchar("academic_year", { length: 16 }).notNull(),
    branch: varchar("branch", { length: 32 }).notNull(),
    semester: integer("semester").notNull(),
    subjectName: text("subject_name"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    upvotes: integer("upvotes").notNull().default(0),
    downvotes: integer("downvotes").notNull().default(0),
    answerCount: integer("answer_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("qa_q_scope_idx").on(t.academicYear, t.branch, t.semester, t.createdAt),
  ],
);

export const qaAnswers = pgTable(
  "qa_answers",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => qaQuestions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    authorName: text("author_name"),
    body: text("body").notNull(),
    upvotes: integer("upvotes").notNull().default(0),
    downvotes: integer("downvotes").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("qa_a_question_idx").on(t.questionId)],
);

export const qaVotes = pgTable(
  "qa_votes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    targetType: varchar("target_type", { length: 16 }).notNull(),
    targetId: text("target_id").notNull(),
    value: integer("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("qa_votes_unique_idx").on(t.userId, t.targetType, t.targetId),
  ],
);

export const qaSaved = pgTable(
  "qa_saved",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    questionId: text("question_id")
      .notNull()
      .references(() => qaQuestions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("qa_saved_unique_idx").on(t.userId, t.questionId)],
);

export const visualizeTelemetry = pgTable("visualize_telemetry", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  event: text("event").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const syncState = pgTable("sync_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const migrateCheckpoint = pgTable("migrate_checkpoint", {
  collection: text("collection").primaryKey(),
  cursor: text("cursor"),
  readsToday: integer("reads_today").notNull().default(0),
  readsDay: varchar("reads_day", { length: 10 }),
  done: boolean("done").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clipboards = pgTable("clipboards", {
  userId: text("user_id").primaryKey(),
  text: text("text").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  shareId: text("share_id"),
  shareExpiresAt: timestamp("share_expires_at", { withTimezone: true }),
  driveFileId: text("drive_file_id"),
  driveFileName: text("drive_file_name"),
});

export const clipboardShares = pgTable("clipboard_shares", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const plannerPlans = pgTable(
  "planner_plans",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    ownerEmail: text("owner_email"),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    title: text("title").notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    data: jsonb("data").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("planner_owner_month_idx").on(t.ownerId, t.year, t.month)],
);

export const plannerCollaborators = pgTable(
  "planner_collaborators",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plannerPlans.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
    role: varchar("role", { length: 16 }).notNull(),
    ownerId: text("owner_id").notNull(),
  },
  (t) => [uniqueIndex("planner_collab_unique_idx").on(t.planId, t.userEmail)],
);

export const plannerPresence = pgTable(
  "planner_presence",
  {
    planId: text("plan_id").notNull(),
    userId: text("user_id").notNull(),
    displayName: text("display_name"),
    seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.planId, t.userId] })],
);

export const communityDecks = pgTable("community_decks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  branch: varchar("branch", { length: 32 }).notNull(),
  semester: integer("semester").notNull(),
  authorName: text("author_name"),
  authorUid: text("author_uid").notNull(),
  flashcards: jsonb("flashcards").notNull().default([]),
  upvotes: integer("upvotes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const srsState = pgTable("srs_state", {
  userId: text("user_id").primaryKey(),
  decks: jsonb("decks").notNull().default([]),
  cards: jsonb("cards").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userNotes = pgTable("user_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  bytes: integer("bytes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studyPacks = pgTable(
  "study_packs",
  {
    id: text("id").primaryKey(),
    scopeKey: text("scope_key").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("study_packs_scope_idx").on(t.scopeKey, t.createdAt)],
);

export const healthMeta = pgTable("health_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});
