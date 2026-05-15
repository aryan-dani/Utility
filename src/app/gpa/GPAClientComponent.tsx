'use client';

import { useState, useEffect, useMemo } from 'react';
import { SubjectItem } from '@/lib/dataFetcher';
import { 
  Calculator, 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  ChevronRight, 
  Info,
  GraduationCap,
  TrendingUp
} from 'lucide-react';
import { FadeIn, ScaleButton } from '@/components/Animations';

interface GPAClientProps {
  initialSubjects: SubjectItem[];
  branch: string;
  semester: number;
}

interface SubjectEntry {
  id: string;
  name: string;
  credits: number;
  grade: string;
}

const GRADES = [
  { label: 'O (Outstanding)', value: 'O', points: 10 },
  { label: 'A+ (Excellent)', value: 'A+', points: 9 },
  { label: 'A (Very Good)', value: 'A', points: 8 },
  { label: 'B+ (Good)', value: 'B+', points: 7 },
  { label: 'B (Above Average)', value: 'B', points: 6 },
  { label: 'C (Average)', value: 'C', points: 5 },
  { label: 'P (Pass)', value: 'P', points: 4 },
  { label: 'F (Fail)', value: 'F', points: 0 },
];

export default function GPAClient({ initialSubjects, branch, semester }: GPAClientProps) {
  const [activeTab, setActiveTab] = useState<'sgpa' | 'cgpa'>('sgpa');
  const [entries, setEntries] = useState<SubjectEntry[]>([]);
  const [cgpaEntries, setCgpaEntries] = useState<{ sem: number; sgpa: number; credits: number }[]>([]);

  // Initialize entries from initialSubjects or LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem(`gpa_v1_${branch}_${semester}`);
    if (saved) {
      try {
        setEntries(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved GPA data', e);
        initDefaultEntries();
      }
    } else {
      initDefaultEntries();
    }

    const savedCgpa = localStorage.getItem(`cgpa_v1_${branch}`);
    if (savedCgpa) {
      try {
        setCgpaEntries(JSON.parse(savedCgpa));
      } catch (e) {
        console.error('Failed to parse saved CGPA data', e);
      }
    }
  }, [initialSubjects, branch, semester]);

  const initDefaultEntries = () => {
    const defaults = initialSubjects.map(s => ({
      id: Math.random().toString(36).substr(2, 9),
      name: s.name,
      credits: 4, // Default to 4 credits
      grade: ''
    }));
    setEntries(defaults);
  };

  // Save to LocalStorage
  useEffect(() => {
    if (entries.length > 0) {
      localStorage.setItem(`gpa_v1_${branch}_${semester}`, JSON.stringify(entries));
    }
    if (cgpaEntries.length > 0) {
      localStorage.setItem(`cgpa_v1_${branch}`, JSON.stringify(cgpaEntries));
    }
  }, [entries, cgpaEntries, branch, semester]);

  const addEntry = () => {
    setEntries([
      ...entries,
      { id: Math.random().toString(36).substr(2, 9), name: '', credits: 1, grade: '' }
    ]);
  };

  const removeEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
  };

  const updateEntry = (id: string, field: keyof SubjectEntry, value: any) => {
    setEntries(entries.map(e => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const resetEntries = () => {
    if (confirm('Reset all grades and credits?')) {
      initDefaultEntries();
    }
  };

  const sgpa = useMemo(() => {
    let totalPoints = 0;
    let totalCredits = 0;
    let gradedCount = 0;

    entries.forEach(e => {
      const gradeObj = GRADES.find(g => g.value === e.grade);
      if (gradeObj) {
        totalPoints += gradeObj.points * e.credits;
        totalCredits += e.credits;
        gradedCount++;
      }
    });

    if (totalCredits === 0) return 0;
    return parseFloat((totalPoints / totalCredits).toFixed(2));
  }, [entries]);

  const cgpa = useMemo(() => {
    let totalSGPAPoints = 0;
    let totalCredits = 0;
    
    cgpaEntries.forEach(e => {
      totalSGPAPoints += e.sgpa * e.credits;
      totalCredits += e.credits;
    });

    if (totalCredits === 0) return 0;
    return parseFloat((totalSGPAPoints / totalCredits).toFixed(2));
  }, [cgpaEntries]);

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-10 min-h-[80vh]">
      <FadeIn>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Calculator className="w-8 h-8 text-foreground" />
              GPA Calculator
            </h1>
            <p className="text-muted text-sm mt-2">
              Calculate your SGPA and CGPA with precision. Data is saved locally in your browser.
            </p>
          </div>

          <div className="flex bg-surface border border-border p-1 rounded-xl shadow-sm">
            <button
              onClick={() => setActiveTab('sgpa')}
              className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'sgpa' ? 'bg-foreground text-background shadow-md scale-[1.02]' : 'text-muted hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              SGPA
            </button>
            <button
              onClick={() => setActiveTab('cgpa')}
              className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'cgpa' ? 'bg-foreground text-background shadow-md scale-[1.02]' : 'text-muted hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              CGPA
            </button>
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Input */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'sgpa' ? (
            <FadeIn delay={0.1}>
              <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-surface/50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-muted" />
                    <h2 className="font-bold text-sm uppercase tracking-wider text-foreground">
                      Semester {semester} — {branch}
                    </h2>
                  </div>
                  <button 
                    onClick={resetEntries}
                    className="text-xs text-muted hover:text-foreground flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>

                <div className="p-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted font-bold bg-surface/30">
                        <th className="px-6 py-3 font-bold">Subject Name</th>
                        <th className="px-4 py-3 w-24">Credits</th>
                        <th className="px-4 py-3 w-40">Grade</th>
                        <th className="px-4 py-3 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-surface/20 transition-colors group">
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={entry.name}
                              onChange={(e) => updateEntry(entry.id, 'name', e.target.value)}
                              placeholder="Subject name"
                              className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted/30 font-medium"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={entry.credits}
                              onChange={(e) => updateEntry(entry.id, 'credits', parseInt(e.target.value) || 0)}
                              className="w-full bg-surface/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-mono outline-none focus:ring-1 focus:ring-primary transition-all"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="relative">
                              <select
                                value={entry.grade}
                                onChange={(e) => updateEntry(entry.id, 'grade', e.target.value)}
                                className="appearance-none w-full bg-surface/50 border border-border rounded-lg pl-3 pr-8 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all hover:bg-surface"
                              >
                                <option value="" disabled>Grade</option>
                                {GRADES.map(g => (
                                  <option key={g.value} value={g.value}>{g.label}</option>
                                ))}
                              </select>
                              <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-muted">
                                <ChevronRight className="w-3 h-3 rotate-90" />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button 
                              onClick={() => removeEntry(entry.id)}
                              className="text-muted/40 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 rounded-md"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-surface/30 border-t border-border">
                  <button
                    onClick={addEntry}
                    className="w-full py-3 border border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface hover:border-border-strong transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Custom Subject
                  </button>
                </div>
              </div>
            </FadeIn>
          ) : (
            <FadeIn delay={0.1}>
              <div className="bg-card border border-border rounded-2xl shadow-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Semester-wise SGPAs
                  </h2>
                  <button 
                    onClick={() => {
                      const sem = cgpaEntries.length + 1;
                      setCgpaEntries([...cgpaEntries, { sem, sgpa: 0, credits: 20 }]);
                    }}
                    className="text-sm font-semibold text-foreground flex items-center gap-1.5 hover:underline"
                  >
                    <Plus className="w-4 h-4" />
                    Add Semester
                  </button>
                </div>

                {cgpaEntries.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-border rounded-xl bg-surface/30">
                    <p className="text-muted text-sm">Add your semester results to calculate CGPA</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cgpaEntries.map((e, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-border bg-surface/30">
                        <div className="font-bold text-sm text-foreground shrink-0 w-24">
                          Sem {e.sem}
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted">SGPA</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="10"
                              value={e.sgpa || ''}
                              placeholder="0.00"
                              onChange={(ev) => setCgpaEntries(cgpaEntries.map((item, i) => i === idx ? { ...item, sgpa: parseFloat(ev.target.value) || 0 } : item))}
                              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono outline-none focus:ring-1 focus:ring-foreground"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted">Total Credits</label>
                            <input
                              type="number"
                              value={e.credits || ''}
                              placeholder="20"
                              onChange={(ev) => setCgpaEntries(cgpaEntries.map((item, i) => i === idx ? { ...item, credits: parseInt(ev.target.value) || 0 } : item))}
                              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono outline-none focus:ring-1 focus:ring-foreground"
                            />
                          </div>
                        </div>
                        <button 
                          onClick={() => setCgpaEntries(cgpaEntries.filter((_, i) => i !== idx))}
                          className="text-muted hover:text-red-500 transition-colors p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FadeIn>
          )}
        </div>

        {/* Right Column: Result */}
        <div className="space-y-6">
          <FadeIn delay={0.2}>
            <div className="bg-foreground text-background rounded-2xl shadow-xl p-8 relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-background/5 rounded-full -mr-16 -mt-16 blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-background/10 rounded-full -ml-12 -mb-12 blur-xl" />
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <p className="text-background/60 text-xs font-bold uppercase tracking-widest mb-2">
                  Estimated {activeTab === 'sgpa' ? 'SGPA' : 'CGPA'}
                </p>
                <div className="text-7xl font-black tracking-tighter mb-4">
                  {activeTab === 'sgpa' ? sgpa.toFixed(2) : cgpa.toFixed(2)}
                </div>
                
                <div className="h-px w-full bg-background/20 my-6" />
                
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div>
                    <p className="text-background/50 text-[10px] font-bold uppercase mb-1">Status</p>
                    <p className="font-bold text-sm">
                      {(activeTab === 'sgpa' ? sgpa : cgpa) >= 8.5 ? 'Distinction' : (activeTab === 'sgpa' ? sgpa : cgpa) >= 6.5 ? 'First Class' : 'Pass'}
                    </p>
                  </div>
                  <div>
                    <p className="text-background/50 text-[10px] font-bold uppercase mb-1">Percentage</p>
                    <p className="font-bold text-sm">
                      {((activeTab === 'sgpa' ? sgpa : cgpa) * 9.5).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="bg-surface border border-border rounded-2xl p-6">
              <h3 className="font-bold text-xs uppercase tracking-wider text-foreground mb-4 flex items-center gap-2">
                <Info className="w-3.5 h-3.5" />
                Quick Info
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-foreground/20 mt-1.5 shrink-0" />
                  <p className="text-xs text-muted leading-relaxed">
                    Percentage is calculated as <span className="text-foreground font-medium">GPA × 9.5</span>.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-foreground/20 mt-1.5 shrink-0" />
                  <p className="text-xs text-muted leading-relaxed">
                    O grade is 10 pts, A+ is 9 pts, A is 8 pts, etc.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-foreground/20 mt-1.5 shrink-0" />
                  <p className="text-xs text-muted leading-relaxed">
                    CGPA calculation uses weighted average based on semester credits.
                  </p>
                </li>
              </ul>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
