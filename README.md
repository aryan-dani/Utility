# Utility

A premium, minimalist academic workspace designed for students. Built with Next.js, Supabase, and AI.

## ✨ Features

- **🧠 AI Study Assistant**: Get instant explanations, generate flashcards, and summarize complex topics using Groq (Llama 3.3 70B).
- **📅 Weekly Planner**: A local-first, cloud-synced task board to keep your week organized.
- **📊 GPA Calculator**: Precision calculation for SGPA and CGPA with auto-populated subjects.
- **⏱ Focus Timer**: A beautiful Pomodoro timer with session tracking to keep you in the zone.
- **📚 Syllabus & Resources**: Instant access to your semester's curriculum, notes, PPTs, and question banks.
- **🌑 Dark Mode**: A sleek, high-contrast monochrome design system that's easy on the eyes.

## 🛠 Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Styling**: Vanilla CSS + Tailwind-like custom tokens
- **Database**: Supabase (PostgreSQL + Auth)
- **AI**: Groq API via Vercel AI SDK
- **Icons**: Lucide React
- **Animations**: Framer Motion

## 🚀 Getting Started

1. **Clone the repository**
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Set up Environment Variables**
   Create a `.env.local` file with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   SUPABASE_SERVICE_ROLE_KEY=your_key
   GROQ_API_KEY=your_groq_api_key
   NEXT_PUBLIC_ADMIN_EMAILS=email1,email2
   ```
4. **Run the development server**
   ```bash
   npm run dev
   ```

## 📝 License

Made with ❤️ by [Aryan Dani](https://www.aryandani.com).
