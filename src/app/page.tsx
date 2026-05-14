"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarCheck, BookOpen, FileText, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center min-h-[80vh]">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-4xl relative mb-24 flex flex-col items-center"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface text-muted text-sm font-medium mb-8 border border-border">
          <span className="w-2 h-2 rounded-full bg-primary"></span>
          Your Professional Utility Hub
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight mb-8 text-foreground">
          Master Your <br/>
          Semesters
        </h1>
        
        <p className="text-lg md:text-xl text-muted mb-12 max-w-2xl mx-auto leading-relaxed">
          A cleanly designed, structured academic workspace to effortlessly track syllabus progress, access course resources, and maintain a private weekly planner.
        </p>
        
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/planner">
            <motion.button 
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-3.5 bg-primary text-white rounded-md font-medium shadow-sm hover:shadow hover:bg-primary-hover transition-all flex items-center gap-2"
            >
              Open Utility <ArrowRight className="w-4 h-4" />
            </motion.button>
          </Link>
          <Link href="/syllabus">
            <motion.button 
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-3.5 bg-white border border-border text-foreground rounded-md font-medium hover:bg-surface transition-all shadow-sm"
            >
              View Syllabus
            </motion.button>
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white border border-border p-8 rounded-lg text-left group hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 rounded bg-surface flex items-center justify-center mb-6 border border-border text-foreground">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-semibold mb-3 text-foreground">1. Local Utility</h2>
          <p className="text-muted text-sm leading-relaxed">
            A beautiful, structured weekly board. It operates entirely locally on your browser. Add and manage tasks without needing a database.
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-white border border-border p-8 rounded-lg text-left group hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 rounded bg-surface flex items-center justify-center mb-6 border border-border text-foreground">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-semibold mb-3 text-foreground">2. Syllabus</h2>
          <p className="text-muted text-sm leading-relaxed">
            Get a clear, structured breakdown of units and topics for every single subject instantly at a glance. Stay ahead of your coursework.
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white border border-border p-8 rounded-lg text-left group hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 rounded bg-surface flex items-center justify-center mb-6 border border-border text-foreground">
            <FileText className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-semibold mb-3 text-foreground">3. Resources</h2>
          <p className="text-muted text-sm leading-relaxed">
            Automatically tracks your local directories. Drop a PPT or PDF in the Content folder and it natively appears in the Vault.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
