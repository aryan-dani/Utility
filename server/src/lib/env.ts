import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(18100),
  DATABASE_URL: z.string().min(1),
  UTILITY_API_SECRET: z.string().min(16),
  CORS_ORIGINS: z
    .string()
    .default(
      "https://utilityos.tech,https://www.utilityos.tech,https://planner-flax-six.vercel.app",
    ),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  ADMIN_EMAILS: z.string().default(""),
  VERCEL_REVALIDATE_URL: z.string().url().optional().or(z.literal("")),
  CRON_SECRET: z.string().optional(),
  FILES_ROOT: z.string().default("/data/files"),
  GOTENBERG_URL: z.string().default("http://gotenberg:3000"),
  TZ: z.string().default("Asia/Kolkata"),
  HEALTHCHECKS_SYNC_URL: z.string().optional(),
  HEALTHCHECKS_BACKUP_URL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid server env: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

export function corsOrigins(): string[] {
  return env()
    .CORS_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function adminEmails(): string[] {
  return env()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
