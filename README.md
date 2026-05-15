# Academic OS (Utility)

A premium, minimalist academic workspace designed for university students. Built with Next.js 15, Supabase, and advanced AI integration to transform how students interact with their study materials.

## ✨ Core Features

- **🧠 Document Intelligence (RAG)**: The AI assistant has direct access to your uploaded PDFs, PPTs, and DOCs. Ask specific questions about your curriculum and get answers grounded in your actual course materials.
- **⚡ Parallel Indexing Engine**: A high-performance Node.js runtime that parses and indexes entire semesters of content into a searchable vector-like database in seconds.
- **📚 Modern Resource Vault**: A modular, categorized interface for Class Presentations, Handwritten Notes, and Question Banks with instant AI-generated summaries for every document.
- **📅 Weekly Planner**: A local-first, cloud-synced task board to keep your week organized.
- **📊 GPA Calculator**: Precision calculation for SGPA and CGPA with auto-populated subjects.
- **⏱ Focus Timer**: A beautiful Pomodoro timer with session tracking to keep you in the zone.
- **🌑 Premium Design**: A sleek, high-contrast monochrome design system with glassmorphism and smooth animations.

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Vanilla CSS + Tailwind CSS (Typography + Custom Design System)
- **Database**: Supabase (PostgreSQL + RLS + Storage)
- **AI Engine**: Groq API (Llama 3.3 70B) via Vercel AI SDK
- **Icons**: Lucide React
- **Animations**: Framer Motion

## 🚀 Deployment & Setup

### 1. Environment Variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROQ_API_KEY=your_groq_api_key
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com
```

### 2. Database & Sync
This project includes an autonomous runtime to sync your storage buckets with the database:
```bash
# Sync your storage bucket with the DB
node runtime/index.mjs sync

# Index document contents for AI (RAG)
node runtime/index.mjs index
```

### 3. Run Locally
```bash
npm install
npm run dev
```

## 🔐 License

Proprietary License - All Rights Reserved. See [LICENSE](LICENSE) for details.

Made with ❤️ by [Aryan Dani](https://www.aryandani.com).
