'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  ChevronLeft, 
  Target, 
  TrendingUp, 
  Zap, 
  Info,
  GraduationCap,
  History,
  RotateCcw,
  Search
} from 'lucide-react';
import { FadeIn, ScaleButton, StaggerContainer, StaggerItem } from '@/components/Animations';

interface Subject {
  id: string;
  name: string;
  credits: number;
}

interface BranchData {
  name: string;
  totalCredits: number;
  completed: Subject[];
  finals: Subject[];
}

const COURSE_DATA: Record<string, BranchData> = {
  'CORE': { 
    name: 'Computer Engineering (CORE)', 
    totalCredits: 23,
    completed: [
      {id:'c_oopl',name:'OOPL',credits:3}, 
      {id:'c_dbmsl',name:'DBMSL',credits:1}, 
      {id:'c_pbl',name:'PBL',credits:1}, 
      {id:'c_cs',name:'CS',credits:1}, 
      {id:'c_ue',name:'UE',credits:3}, 
      {id:'c_ruip',name:'RUIP',credits:2}, 
      {id:'c_iks',name:'IKS',credits:2}
    ],
    finals: [
      {id:'c_dbms',name:'DBMS',credits:3}, 
      {id:'c_daa',name:'DAA',credits:3}, 
      {id:'c_ps',name:'PS',credits:4}
    ]
  },
  'CSF': { 
    name: 'Cybersecurity & Forensics (CSF)', 
    totalCredits: 22,
    completed: [
      {id:'csf_dbmsl',name:'DBMS Lab',credits:1}, 
      {id:'csf_osl',name:'OS Lab',credits:1}, 
      {id:'csf_esiot',name:'ES & IoT Lab',credits:1}, 
      {id:'csf_pbl2',name:'PBL-II',credits:1}, 
      {id:'csf_cog',name:'Cognitive Skills',credits:1}, 
      {id:'csf_ruip',name:'Rural Immersion',credits:2}, 
      {id:'csf_iks',name:'IKS',credits:2}, 
      {id:'csf_ue3',name:'UE-III',credits:3}
    ],
    finals: [
      {id:'csf_prob',name:'Prob & Stats',credits:4}, 
      {id:'csf_dbms',name:'DBMS',credits:3}, 
      {id:'csf_os',name:'Operating System',credits:3}
    ]
  },
  'AIDS': { 
    name: 'AI & Data Science (AIDS)', 
    totalCredits: 21, // Adjusted (22 - 1 for LTS)
    completed: [
      {id:'ai_detl',name:'DET Lab',credits:1}, 
      {id:'ai_aiesl',name:'AI & ES Lab',credits:1}, 
      {id:'ai_pbl2',name:'PBL-II',credits:1}, 
      {id:'ai_ue3',name:'UE-III',credits:3}, 
      {id:'ai_cog',name:'Cognitive Skills',credits:1}, 
      {id:'ai_ruip',name:'Rural Immersion',credits:1}, 
      // LTS removed as requested
      {id:'ai_iks',name:'IKS',credits:2}
    ],
    finals: [
      {id:'ai_prob',name:'Prob & Stats',credits:4}, 
      {id:'ai_det',name:'Data Eng. Tech.',credits:2}, 
      {id:'ai_aies',name:'AI & Expert Sys.',credits:2}, 
      {id:'ai_daa',name:'DAA',credits:3}
    ]
  }
};

function getGradePoint(marks: number) {
  if(marks >= 90) return 10; 
  if(marks >= 80) return 9; 
  if(marks >= 70) return 8;
  if(marks >= 60) return 7; 
  if(marks >= 50) return 6; 
  if(marks >= 40) return 5; 
  return 0;
}

function getThreshold(gp: number) {
  if(gp === 10) return 90; 
  if(gp === 9) return 80; 
  if(gp === 8) return 70;
  if(gp === 7) return 60; 
  if(gp === 6) return 50; 
  if(gp === 5) return 40; 
  return 0;
}

export default function GPAClient() {
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [simSelections, setSimSelections] = useState<Record<string, number>>({});
  const [isCalculated, setIsCalculated] = useState(false);

  const currentBranch = useMemo(() => 
    selectedBranch ? COURSE_DATA[selectedBranch] : null, 
  [selectedBranch]);

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('gpa_strategy_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.branch) setSelectedBranch(parsed.branch);
        if (parsed.marks) setMarks(parsed.marks);
      } catch (e) {
        console.error('Failed to load GPA data', e);
      }
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    if (selectedBranch) {
      localStorage.setItem('gpa_strategy_v1', JSON.stringify({
        branch: selectedBranch,
        marks: marks
      }));
    }
  }, [selectedBranch, marks]);

  const handleMarkChange = (id: string, value: string) => {
    const num = parseFloat(value) || 0;
    setMarks(prev => ({ ...prev, [id]: num }));
  };

  const calculateStrategy = () => {
    if (!currentBranch) return;
    
    // Default simulator selections to best possible GP
    const initialSim: Record<string, number> = {};
    currentBranch.finals.forEach(sub => {
      const current = marks[sub.id] || 0;
      const maxPossible = current + 40;
      initialSim[sub.id] = maxPossible < 40 ? 0 : getGradePoint(maxPossible);
    });
    
    setSimSelections(initialSim);
    setIsCalculated(true);
    
    // Scroll to results
    setTimeout(() => {
      document.getElementById('strategy-results')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const bestCaseGPA = useMemo(() => {
    if (!currentBranch) return 0;
    let totalPoints = 0;
    
    currentBranch.completed.forEach(sub => {
      totalPoints += getGradePoint(marks[sub.id] || 0) * sub.credits;
    });
    
    currentBranch.finals.forEach(sub => {
      const maxPossible = (marks[sub.id] || 0) + 40;
      const bestGP = maxPossible < 40 ? 0 : getGradePoint(maxPossible);
      totalPoints += bestGP * sub.credits;
    });
    
    return parseFloat((totalPoints / currentBranch.totalCredits).toFixed(2));
  }, [currentBranch, marks]);

  const simulatedGPA = useMemo(() => {
    if (!currentBranch) return 0;
    let totalPoints = 0;
    
    currentBranch.completed.forEach(sub => {
      totalPoints += getGradePoint(marks[sub.id] || 0) * sub.credits;
    });
    
    currentBranch.finals.forEach(sub => {
      totalPoints += (simSelections[sub.id] || 0) * sub.credits;
    });
    
    return parseFloat((totalPoints / currentBranch.totalCredits).toFixed(2));
  }, [currentBranch, marks, simSelections]);

  if (!selectedBranch) {
    return (
      <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-12">
        <FadeIn>
          <div className="text-center mb-12">
            <h1 className="text-4xl font-black tracking-tight text-foreground mb-4 flex items-center justify-center gap-3">
              <Calculator className="w-10 h-10" />
              Sem IV Strategy
            </h1>
            <p className="text-muted text-lg max-w-xl mx-auto">
              Select your branch to calculate your potential GPA and build a study strategy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(COURSE_DATA).map(([key, data]) => (
              <ScaleButton
                key={key}
                onClick={() => setSelectedBranch(key)}
                className="group relative bg-card border border-border p-8 rounded-3xl shadow-card hover:border-foreground/50 transition-all text-left"
              >
                <div className="w-12 h-12 bg-surface border border-border rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <GraduationCap className="w-6 h-6 text-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2 leading-tight">
                  {data.name}
                </h3>
                <p className="text-muted text-xs font-bold uppercase tracking-widest">
                  {data.totalCredits} Credits Total
                </p>
              </ScaleButton>
            ))}
          </div>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-10 min-h-screen">
      <FadeIn>
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10">
          <div>
            <button 
              onClick={() => {
                setSelectedBranch(null);
                setIsCalculated(false);
              }}
              className="group flex items-center gap-2 text-muted hover:text-foreground text-sm font-bold uppercase tracking-wider mb-4 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Change Branch
            </button>
            <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
              {currentBranch?.name}
            </h1>
            <p className="text-muted text-sm mt-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Calculation based on Sem IV curriculum credits and passing rules.
            </p>
          </div>

          <div className="flex gap-3">
            <ScaleButton
              onClick={() => {
                setMarks({});
                setIsCalculated(false);
              }}
              className="bg-surface border border-border text-muted hover:text-foreground px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Marks
            </ScaleButton>

          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Completed Subjects */}
          <div className="bg-card border border-border rounded-3xl shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-surface/30 flex items-center gap-3">
              <History className="w-5 h-5 text-muted" />
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                Completed Subjects
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentBranch?.completed.map(sub => (
                <div key={sub.id} className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted block pl-1">
                    {sub.name} <span className="opacity-50">({sub.credits} Cr)</span>
                  </label>
                  <input
                    type="number"
                    max="100"
                    placeholder="Marks / 100"
                    value={marks[sub.id] || ''}
                    onChange={(e) => handleMarkChange(sub.id, e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-foreground/50 transition-all placeholder:text-muted/30"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pending Finals */}
          <div className="bg-card border border-border rounded-3xl shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-surface/30 flex items-center gap-3">
              <Target className="w-5 h-5 text-muted" />
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                Finals Preparation
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentBranch?.finals.map(sub => (
                <div key={sub.id} className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted block pl-1">
                    {sub.name} <span className="opacity-50">({sub.credits} Cr)</span>
                  </label>
                  <input
                    type="number"
                    max="60"
                    placeholder="Internals / 60"
                    value={marks[sub.id] || ''}
                    onChange={(e) => handleMarkChange(sub.id, e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-foreground/50 transition-all placeholder:text-muted/30"
                  />
                </div>
              ))}
            </div>
            <div className="p-4 bg-surface/20 border-t border-border">
              <button
                onClick={calculateStrategy}
                className="w-full bg-foreground text-background py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <TrendingUp className="w-5 h-5" />
                Calculate Strategy
              </button>
            </div>
          </div>
        </div>

        {isCalculated && (
          <div id="strategy-results" className="space-y-12 pb-20">
            {/* Best Case Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-foreground text-background rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-background/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <p className="text-background/60 text-[10px] font-black uppercase tracking-widest mb-2">Absolute Best-Case GPA</p>
                <div className="text-8xl font-black tracking-tighter mb-4">{bestCaseGPA.toFixed(2)}</div>
                <p className="text-background/40 text-[10px] uppercase font-bold tracking-wider leading-relaxed px-4">
                  Assuming 40/40 in all final exams
                </p>
              </div>

              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentBranch?.finals.map(sub => {
                  const current = marks[sub.id] || 0;
                  const maxPossible = current + 40;
                  const bestGP = maxPossible < 40 ? 0 : getGradePoint(maxPossible);
                  const requiredForBest = Math.max(16, getThreshold(bestGP) - current);
                  
                  return (
                    <div key={sub.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-black text-sm uppercase text-foreground">{sub.name}</h3>
                        <div className="bg-surface px-2 py-1 rounded text-[10px] font-black text-muted">{sub.credits} Cr</div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Target Pointer</p>
                        <div className="text-2xl font-black text-foreground flex items-baseline gap-2">
                          {bestGP} <span className="text-xs font-bold text-muted tracking-normal">Need min {requiredForBest} marks</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive Simulator */}
            <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-card border-dashed">
              <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                <div>
                  <h2 className="text-2xl font-black text-foreground flex items-center gap-3">
                    <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                    Projected Simulator
                  </h2>
                  <p className="text-muted text-sm mt-1 uppercase tracking-widest font-bold">Select realistic targets to see your projected GPA</p>
                </div>
                <div className="bg-surface border border-border rounded-2xl px-10 py-6 text-center min-w-[200px]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">Projected GPA</p>
                  <div className="text-5xl font-black text-foreground tracking-tighter">{simulatedGPA.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-8">
                {currentBranch?.finals.map(sub => {
                  const current = marks[sub.id] || 0;
                  const maxPossible = current + 40;
                  const bestGP = maxPossible < 40 ? 0 : getGradePoint(maxPossible);
                  
                  return (
                    <div key={sub.id} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black uppercase text-foreground min-w-[120px]">{sub.name}</span>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[10, 9, 8, 7, 6, 5, 0].map(gp => {
                          const isDisabled = gp > bestGP;
                          const isActive = simSelections[sub.id] === gp;
                          
                          return (
                            <button
                              key={gp}
                              disabled={isDisabled}
                              onClick={() => setSimSelections(prev => ({ ...prev, [sub.id]: gp }))}
                              className={`
                                px-4 py-2 rounded-xl text-xs font-bold transition-all
                                ${isDisabled ? 'opacity-10 grayscale cursor-not-allowed border-transparent' : ''}
                                ${isActive ? 'bg-foreground text-background scale-105 shadow-lg' : 'bg-surface border border-border text-muted hover:border-foreground/30'}
                              `}
                            >
                              {gp} GP
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Advanced Analysis Accordion */}
            <details className="group bg-surface/30 border border-border rounded-3xl overflow-hidden">
              <summary className="px-8 py-6 cursor-pointer flex items-center justify-between hover:bg-surface/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-muted" />
                  <span className="font-black text-sm uppercase tracking-widest text-foreground">Advanced Bracket Breakdown</span>
                </div>
                <ChevronLeft className="w-5 h-5 text-muted group-open:-rotate-90 transition-transform" />
              </summary>
              <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 gap-6">
                {currentBranch?.finals.map(sub => {
                  const currentMarks = marks[sub.id] || 0;
                  const rawPassReq = 40 - currentMarks;
                  const actualPassReq = Math.max(16, rawPassReq);
                  
                  return (
                    <div key={sub.id} className="bg-card border border-border rounded-2xl p-6 space-y-4">
                      <h3 className="font-black text-sm uppercase text-foreground border-b border-border pb-3">{sub.name}</h3>
                      
                      <div className="space-y-3">
                        {actualPassReq > 40 ? (
                          <div className="text-red-500 font-bold text-xs uppercase italic flex items-center gap-2">
                            <Info className="w-3 h-3" />
                            Passing mathematically impossible
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-foreground bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-lg inline-block">
                            TO PASS (5 GP): Need <span className="underline decoration-2 underline-offset-4">{actualPassReq} marks</span>
                            {rawPassReq < 16 && <span className="text-[10px] ml-2 opacity-60">(Min Rule)</span>}
                          </div>
                        )}

                        <div className="space-y-2.5">
                          {[10, 9, 8, 7, 6].map(gp => {
                            const threshold = getThreshold(gp);
                            const required = threshold - currentMarks;
                            const isPossible = currentMarks + 40 >= threshold;
                            
                            return (
                              <div key={gp} className={`flex items-center justify-between text-[11px] ${!isPossible ? 'opacity-20 line-through' : ''}`}>
                                <span className="font-bold text-muted uppercase tracking-wider">{gp} Pointer ({threshold}+ total)</span>
                                <span className="font-black text-foreground">
                                  {isPossible ? (required < 16 ? '16 min' : `${required} marks`) : 'N/A'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        )}
      </FadeIn>
    </div>
  );
}
