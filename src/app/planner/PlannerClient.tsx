"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Check, Trash2 } from "lucide-react";

type Todo = {
  id: string;
  text: string;
  done: boolean;
};

type WeekData = Record<string, Todo[]>;

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function PlannerPage() {
  const [weekData, setWeekData] = useState<WeekData>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("neo_planner_week");
    if (saved) {
      setWeekData(JSON.parse(saved));
    } else {
      const init: WeekData = {};
      DAYS.forEach((d) => (init[d] = []));
      setWeekData(init);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("neo_planner_week", JSON.stringify(weekData));
    }
  }, [weekData, mounted]);

  const addTodo = (day: string) => {
    setWeekData((prev) => ({
      ...prev,
      [day]: [
        ...prev[day],
        { id: Math.random().toString(36).substr(2, 9), text: "", done: false },
      ],
    }));
  };

  const updateTodoText = (day: string, id: string, text: string) => {
    setWeekData((prev) => ({
      ...prev,
      [day]: prev[day].map((t) => (t.id === id ? { ...t, text } : t)),
    }));
  };

  const toggleTodo = (day: string, id: string) => {
    setWeekData((prev) => ({
      ...prev,
      [day]: prev[day].map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  };

  const deleteTodo = (day: string, id: string) => {
    setWeekData((prev) => ({
      ...prev,
      [day]: prev[day].filter((t) => t.id !== id),
    }));
  };

  const clearAll = () => {
    if (confirm("Are you sure you want to clear the entire week?")) {
      const init: WeekData = {};
      DAYS.forEach((d) => (init[d] = []));
      setWeekData(init);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 w-full px-6 py-8 max-w-[1600px] mx-auto min-h-[90vh]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Weekly Board
          </h1>
          <p className="text-muted text-sm mt-1">
            Organize your week locally. No database required.
          </p>
        </div>
        <button
          onClick={clearAll}
          className="px-4 py-2 bg-white border border-border text-red-600 hover:bg-red-50 hover:border-red-200 rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
        >
          <Trash2 className="w-4 h-4" /> Clear Board
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 items-start">
        {DAYS.map((day) => (
          <div 
            key={day} 
            className="flex flex-col bg-surface border border-border rounded-lg overflow-hidden h-full min-h-[60vh]"
          >
            {/* Column Header */}
            <div className="px-3 py-3 border-b border-border flex justify-between items-center bg-surface-hover">
              <span className="font-semibold text-sm text-foreground">{day}</span>
              <button
                onClick={() => addTodo(day)}
                className="w-6 h-6 rounded bg-white border border-border flex items-center justify-center hover:bg-gray-50 transition-colors text-muted hover:text-foreground shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tasks List */}
            <div className="flex flex-col gap-2 p-2 flex-1">
              <AnimatePresence>
                {weekData[day]?.map((todo) => (
                  <motion.div
                    key={todo.id}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`flex items-start gap-2 group relative bg-white border rounded-md p-2.5 shadow-sm transition-all ${
                      todo.done ? "border-border opacity-75" : "border-border"
                    }`}
                  >
                    <button
                      onClick={() => toggleTodo(day, todo.id)}
                      className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded-sm border flex items-center justify-center transition-colors cursor-pointer ${
                        todo.done 
                          ? "bg-primary border-primary text-white" 
                          : "bg-white border-muted hover:border-primary"
                      }`}
                    >
                      {todo.done && <Check className="w-3 h-3" />}
                    </button>

                    <textarea
                      value={todo.text}
                      onChange={(e) =>
                        updateTodoText(day, todo.id, e.target.value)
                      }
                      placeholder="To-do..."
                      rows={1}
                      className={`bg-transparent outline-none resize-none overflow-hidden text-sm w-full transition-all pt-0 ${
                        todo.done ? "line-through text-muted" : "text-foreground font-medium"
                      }`}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto";
                        target.style.height = target.scrollHeight + "px";
                      }}
                    />

                    <button
                      onClick={() => deleteTodo(day, todo.id)}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-muted hover:text-red-500 transition-colors p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {weekData[day]?.length === 0 && (
                <div
                  className="h-full w-full flex-1 flex flex-col items-center justify-center border border-dashed border-border rounded-md p-4 text-muted cursor-pointer hover:border-primary hover:text-primary hover:bg-primary/5 transition-all group min-h-[100px]"
                  onClick={() => addTodo(day)}
                >
                  <Plus className="w-5 h-5 mb-1 opacity-50 group-hover:opacity-100" />
                  <span className="text-xs font-medium">Add task</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
