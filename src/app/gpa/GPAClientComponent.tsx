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
  Search,
  Printer,
  AlertTriangle,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { FadeIn, ScaleButton, StaggerContainer, StaggerItem } from '@/components/Animations';
import Link from 'next/link';

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
  const [activeTab, setActiveTab] = useState<'semester' | 'roadmap'>('semester');

  const [semestersData, setSemestersData] = useState<Record<number, { sgpa: number; credits: number; active: boolean; completed: boolean }>>({
    1: { sgpa: 0, credits: 20, active: false, completed: false },
    2: { sgpa: 0, credits: 20, active: false, completed: false },
    3: { sgpa: 0, credits: 20, active: false, completed: false },
    4: { sgpa: 0, credits: 21, active: false, completed: false },
    5: { sgpa: 0, credits: 20, active: false, completed: false },
    6: { sgpa: 0, credits: 20, active: false, completed: false },
    7: { sgpa: 0, credits: 20, active: false, completed: false },
    8: { sgpa: 0, credits: 20, active: false, completed: false },
  });
  const [targetCGPA, setTargetCGPA] = useState<number>(8.5);
  const [targetSemester, setTargetSemester] = useState<number>(8);
  const [isTargetSemOpen, setIsTargetSemOpen] = useState(false);

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

    const savedRoadmap = localStorage.getItem('gpa_roadmap_v1');
    if (savedRoadmap) {
      try {
        const parsed = JSON.parse(savedRoadmap);
        if (parsed.semestersData) {
          const merged: Record<number, any> = {};
          for (let i = 1; i <= 8; i++) {
            const defaultSem = { sgpa: 0, credits: 20, active: false, completed: false };
            const savedSem = parsed.semestersData[i] || {};
            merged[i] = {
              ...defaultSem,
              ...savedSem,
              completed: savedSem.completed !== undefined ? savedSem.completed : (savedSem.sgpa > 0)
            };
          }
          setSemestersData(merged);
        }
        if (parsed.targetCGPA) setTargetCGPA(parsed.targetCGPA);
        if (parsed.targetSemester) setTargetSemester(parsed.targetSemester);
      } catch (e) {
        console.error('Failed to load GPA roadmap data', e);
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

  useEffect(() => {
    localStorage.setItem('gpa_roadmap_v1', JSON.stringify({
      semestersData,
      targetCGPA,
      targetSemester
    }));
  }, [semestersData, targetCGPA, targetSemester]);

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

  // Sync simulatedGPA into semestersData Semester 4
  useEffect(() => {
    if (isCalculated && selectedBranch && currentBranch) {
      setSemestersData(prev => {
        const currentSem4 = prev[4];
        if (
          currentSem4.sgpa !== simulatedGPA || 
          currentSem4.credits !== currentBranch.totalCredits || 
          !currentSem4.active || 
          !currentSem4.completed
        ) {
          return {
            ...prev,
            4: {
              sgpa: simulatedGPA,
              credits: currentBranch.totalCredits,
              active: true,
              completed: true
            }
          };
        }
        return prev;
      });
    }
  }, [simulatedGPA, isCalculated, selectedBranch, currentBranch]);

  // Calculations for Cumulative CGPA
  const { currentCGPA, totalCompletedCredits, activeCompletedSemestersCount } = useMemo(() => {
    let totalPoints = 0;
    let totalCredits = 0;
    let completedCount = 0;

    Object.entries(semestersData).forEach(([semNumStr, data]) => {
      if (data.active && data.completed) {
        totalPoints += data.sgpa * data.credits;
        totalCredits += data.credits;
        completedCount++;
      }
    });

    const cgpa = totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0;
    return {
      currentCGPA: cgpa,
      totalCompletedCredits: totalCredits,
      activeCompletedSemestersCount: completedCount
    };
  }, [semestersData]);

  const { requiredSGPA, remainingCredits, remainingSemestersCount, isPossible } = useMemo(() => {
    let completedPoints = 0;
    let completedCredits = 0;
    let plannedCredits = 0;
    let plannedCount = 0;

    Object.entries(semestersData).forEach(([semNumStr, data]) => {
      const semNum = parseInt(semNumStr);
      if (semNum <= targetSemester && data.active) {
        if (data.completed) {
          completedPoints += data.sgpa * data.credits;
          completedCredits += data.credits;
        } else {
          plannedCredits += data.credits;
          plannedCount++;
        }
      }
    });

    const totalCreditsNeeded = completedCredits + plannedCredits;
    const totalPointsNeeded = targetCGPA * totalCreditsNeeded;
    const pointsNeededFromPlanned = totalPointsNeeded - completedPoints;

    const reqSGPA = plannedCredits > 0 ? parseFloat((pointsNeededFromPlanned / plannedCredits).toFixed(2)) : 0;
    const possible = reqSGPA <= 10.0;

    return {
      requiredSGPA: reqSGPA,
      remainingCredits: plannedCredits,
      remainingSemestersCount: plannedCount,
      isPossible: possible
    };
  }, [semestersData, targetCGPA, targetSemester]);

  const handleSemesterActiveToggle = (semNum: number) => {
    setSemestersData(prev => ({
      ...prev,
      [semNum]: {
        ...prev[semNum],
        active: !prev[semNum].active
      }
    }));
  };

  const handleSemesterCompletedToggle = (semNum: number, completed: boolean) => {
    setSemestersData(prev => ({
      ...prev,
      [semNum]: {
        ...prev[semNum],
        completed
      }
    }));
  };

  const handleSemesterCreditsChange = (semNum: number, value: string) => {
    const val = parseInt(value) || 0;
    setSemestersData(prev => ({
      ...prev,
      [semNum]: {
        ...prev[semNum],
        credits: val
      }
    }));
  };

  const handleSemesterSgpaChange = (semNum: number, value: string) => {
    const val = parseFloat(value) || 0;
    setSemestersData(prev => ({
      ...prev,
      [semNum]: {
        ...prev[semNum],
        sgpa: val > 10 ? 10 : val < 0 ? 0 : val
      }
    }));
  };

  if (!selectedBranch) {
    return (
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 min-h-[80vh]">
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
                className="group relative bg-card border-2 border-foreground p-8 shadow-[4px_4px_0px_0px_rgb(var(--foreground))] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgb(var(--foreground))] transition-all text-left"
              >
                <div className="w-12 h-12 bg-surface border-2 border-foreground flex items-center justify-center mb-6 transition-transform">
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
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 min-h-[80vh]">
      {/* CSS Injection for beautiful printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .page-break-before {
            page-break-before: always;
          }
        }
      `}} />

      {/* Main Interactive UI */}
      <div className="print:hidden">
        <FadeIn>
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
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

              <ScaleButton
                onClick={() => window.print()}
                className="bg-surface border border-border text-muted hover:text-foreground px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Report
              </ScaleButton>
            </div>
          </div>

          {/* Premium Tab Bar */}
          <div className="flex border-b border-border mb-8">
            <button
              onClick={() => setActiveTab('semester')}
              className={`pb-4 px-6 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${
                activeTab === 'semester'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              Semester Strategy
            </button>
            <button
              onClick={() => setActiveTab('roadmap')}
              className={`pb-4 px-6 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${
                activeTab === 'roadmap'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              Cumulative CGPA Roadmap
            </button>
          </div>

          {/* TAB 1: Semester IV Strategy */}
          {activeTab === 'semester' && (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                {/* Completed Subjects */}
                <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
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
                <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
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
                      className="w-full bg-foreground text-background py-4 border-2 border-foreground font-black text-sm uppercase tracking-widest hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgb(var(--foreground))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgb(var(--foreground))] transition-all flex items-center justify-center gap-3"
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
                    <div className="lg:col-span-1 bg-foreground text-background border-2 border-foreground p-8 flex flex-col items-center justify-center text-center shadow-[4px_4px_0px_0px_rgba(var(--foreground),0.3)] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-background/10 rounded-none -mr-16 -mt-16 blur-2xl" />
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
                          <div key={sub.id} className="bg-card border-2 border-foreground p-5 flex flex-col justify-between shadow-[3px_3px_0px_0px_rgb(var(--foreground))]">
                            <div className="flex justify-between items-start mb-4">
                              <h3 className="font-black text-sm uppercase text-foreground">{sub.name}</h3>
                              <div className="bg-surface px-2 py-1 rounded-none text-[10px] font-black text-muted border border-foreground/20">{sub.credits} Cr</div>
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
                  <div className="bg-card border-2 border-foreground p-8 shadow-[4px_4px_0px_0px_rgb(var(--foreground))] border-dashed">
                    <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                      <div>
                        <h2 className="text-2xl font-black text-foreground flex items-center gap-3">
                          <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                          Projected Simulator
                        </h2>
                        <p className="text-muted text-sm mt-1 uppercase tracking-widest font-bold">Select realistic targets to see your projected GPA</p>
                      </div>
                      <div className="bg-surface border-2 border-foreground px-10 py-6 text-center min-w-[200px] shadow-[2px_2px_0px_0px_rgb(var(--foreground))]">
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
                                      px-4 py-2 text-xs font-bold transition-all
                                      ${isDisabled ? 'opacity-10 grayscale cursor-not-allowed border-transparent' : ''}
                                      ${isActive ? 'bg-foreground text-background border-2 border-foreground shadow-[2px_2px_0px_0px_rgb(var(--foreground))]' : 'bg-surface border-2 border-foreground/30 text-muted hover:border-foreground'}
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
                  <details className="group bg-surface/30 border border-border rounded-2xl overflow-hidden">
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
                          <div key={sub.id} className="bg-card border-2 border-foreground p-6 space-y-4 shadow-[3px_3px_0px_0px_rgb(var(--foreground))]">
                            <h3 className="font-black text-sm uppercase text-foreground border-b border-border pb-3">{sub.name}</h3>
                            
                            <div className="space-y-3">
                              {actualPassReq > 40 ? (
                                <div className="text-foreground font-bold text-xs uppercase italic flex items-center gap-2">
                                  <Info className="w-3 h-3" />
                                  Passing mathematically impossible
                                </div>
                              ) : (
                                <div className="text-xs font-bold text-foreground bg-foreground/5 border border-foreground/15 px-3 py-2 rounded-lg inline-block">
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

                              <Link
                                href={`/ask?tab=chat&prompt=${encodeURIComponent(`I want to achieve a high grade in my Semester 4 course: "${sub.name}". Based on my current class resources, can you explain the most critical units, concepts, and formulas I should focus on to score 90+? Please break down a study schedule and list some potential exam questions.`)}`}
                                className="w-full mt-4 flex items-center justify-center gap-1.5 py-2 bg-foreground text-background hover:opacity-90 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-opacity text-center block"
                              >
                                <Target className="w-3.5 h-3.5" />
                                Generate AI Study Guide
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Cumulative CGPA Roadmap */}
          {activeTab === 'roadmap' && (
            <div className="space-y-8 pb-20">
              {/* CGPA Dashboard Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metric 1: Current CGPA */}
                <div className="bg-card border-2 border-foreground p-6 flex flex-col justify-between shadow-[4px_4px_0px_0px_rgb(var(--foreground))] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-foreground/5 rounded-none -mr-12 -mt-12 blur-xl" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">
                      Current CGPA
                    </span>
                    <div className="text-5xl font-black text-foreground tracking-tighter">
                      {currentCGPA.toFixed(2)}
                    </div>
                  </div>
                  <p className="text-muted text-[11px] mt-4 font-semibold">
                    Calculated from {activeCompletedSemestersCount} completed semester(s) ({totalCompletedCredits} Cr)
                  </p>
                </div>

                {/* Metric 2: Progress to Goal */}
                <div className="bg-card border-2 border-foreground p-6 flex flex-col justify-between shadow-[4px_4px_0px_0px_rgb(var(--foreground))]">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">
                      Target CGPA Goal
                    </span>
                    <div className="text-2xl font-black text-foreground tracking-tight flex items-baseline gap-2">
                      {targetCGPA.toFixed(2)}
                      <span className="text-xs font-bold text-muted">by Semester {targetSemester}</span>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted">
                      <span>Progress</span>
                      <span>{currentCGPA > 0 ? Math.min(100, Math.round((currentCGPA / targetCGPA) * 100)) : 0}%</span>
                    </div>
                    <div className="w-full bg-surface border-2 border-foreground h-4 overflow-hidden p-0.5">
                      <div 
                        className="bg-foreground h-full transition-all duration-500"
                        style={{ width: `${currentCGPA > 0 ? Math.min(100, (currentCGPA / targetCGPA) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Metric 3: Required SGPA Target */}
                <div className={`bg-card border-2 border-foreground p-6 flex flex-col justify-between shadow-[4px_4px_0px_0px_rgb(var(--foreground))] relative overflow-hidden transition-all ${
                  !isPossible 
                    ? 'bg-foreground/5' 
                    : remainingCredits > 0 && requiredSGPA > 9.0 
                    ? 'bg-surface' 
                    : ''
                }`}>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">
                      Required Avg SGPA
                    </span>
                    <div className="text-4xl font-black text-foreground tracking-tighter flex items-center gap-2">
                      {!isPossible ? (
                        <span className="text-foreground flex items-center gap-2 text-3xl font-black uppercase">
                          <AlertTriangle className="w-7 h-7 text-foreground" />
                          Impossible
                        </span>
                      ) : remainingCredits > 0 ? (
                        <span>
                          {requiredSGPA <= 0 ? '0.00' : requiredSGPA.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-foreground flex items-center gap-2 text-3xl font-black uppercase">
                          <CheckCircle2 className="w-7 h-7 text-foreground" />
                          Achieved
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-muted text-[11px] mt-4 font-semibold">
                    {!isPossible 
                      ? 'Required SGPA exceeds maximum limit of 10.0'
                      : remainingCredits > 0 
                      ? `Needed across next ${remainingSemestersCount} semester(s) (${remainingCredits} Cr remaining)`
                      : 'Target CGPA achieved or exceeded based on current configuration!'}
                  </p>
                </div>
              </div>

              {/* Goal Tracker Settings Card */}
              <div className="bg-card border-2 border-foreground p-6 shadow-[4px_4px_0px_0px_rgb(var(--foreground))] space-y-6">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-foreground" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                    CGPA Goal Tracker settings
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted block pl-1">
                      Target CGPA Goal
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      value={targetCGPA}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setTargetCGPA(val > 10 ? 10 : val < 0 ? 0 : val);
                      }}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-foreground/50 transition-all"
                    />
                  </div>

                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted block pl-1">
                      Target Semester Horizon
                    </label>
                    <div className="relative">
                      <button
                        onClick={() => setIsTargetSemOpen(!isTargetSemOpen)}
                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-foreground/50 transition-all flex justify-between items-center"
                      >
                        Semester {targetSemester}
                        <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isTargetSemOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isTargetSemOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsTargetSemOpen(false)}
                          />
                          <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[250px] overflow-y-auto">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                              <button
                                key={num}
                                onClick={() => {
                                  setTargetSemester(num);
                                  setIsTargetSemOpen(false);
                                }}
                                className={`text-left px-4 py-3 text-sm font-bold transition-colors border-b border-border/50 last:border-0 ${
                                  targetSemester === num 
                                    ? 'bg-surface text-foreground' 
                                    : 'text-muted hover:bg-surface hover:text-foreground'
                                }`}
                              >
                                Semester {num}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Semesters Configuration Grid */}
              <div className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground pl-1">
                  Semester Scoreboards (1 - 8)
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((semNum) => {
                    const sem = semestersData[semNum] || { sgpa: 0, credits: 20, active: false, completed: false };
                    const isSyncedSem4 = semNum === 4 && isCalculated;
                    
                    return (
                      <div 
                        key={semNum}
                        className={`bg-card border rounded-2xl p-5 transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                          sem.active 
                            ? 'border-foreground/30 shadow-lg ring-1 ring-foreground/5' 
                            : 'border-border opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div>
                          {/* Semester Title & Active Switch */}
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-sm uppercase text-foreground">
                              Semester {semNum}
                            </h3>
                            <button
                              onClick={() => handleSemesterActiveToggle(semNum)}
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                sem.active 
                                  ? 'bg-foreground text-background scale-105' 
                                  : 'bg-surface border border-border text-muted hover:border-foreground/30'
                              }`}
                            >
                              {sem.active ? 'Active' : 'Inactive'}
                            </button>
                          </div>

                          {/* Render Details if Active */}
                          {sem.active ? (
                            <div className="space-y-4">
                              {/* Status completed vs planned selector */}
                              <div className="flex gap-1 bg-surface border border-border rounded-xl p-0.5">
                                <button
                                  onClick={() => handleSemesterCompletedToggle(semNum, true)}
                                  disabled={isSyncedSem4}
                                  className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                    sem.completed 
                                      ? 'bg-card text-foreground shadow-sm' 
                                      : 'text-muted hover:text-foreground'
                                  } ${isSyncedSem4 ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                  Completed
                                </button>
                                <button
                                  onClick={() => handleSemesterCompletedToggle(semNum, false)}
                                  disabled={isSyncedSem4}
                                  className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                    !sem.completed 
                                      ? 'bg-card text-foreground shadow-sm' 
                                      : 'text-muted hover:text-foreground'
                                  } ${isSyncedSem4 ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                  Planned
                                </button>
                              </div>

                              {/* Credits field */}
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-muted block pl-0.5">
                                  Credits
                                </label>
                                <input
                                  type="number"
                                  value={sem.credits || ''}
                                  disabled={isSyncedSem4}
                                  onChange={(e) => handleSemesterCreditsChange(semNum, e.target.value)}
                                  className={`w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none focus:border-foreground/50 transition-all ${
                                    isSyncedSem4 ? 'opacity-70 cursor-not-allowed' : ''
                                  }`}
                                />
                              </div>

                              {/* SGPA or Target required display */}
                              {sem.completed ? (
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-muted block pl-0.5">
                                    SGPA
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="10"
                                    value={sem.sgpa || ''}
                                    disabled={isSyncedSem4}
                                    onChange={(e) => handleSemesterSgpaChange(semNum, e.target.value)}
                                    className={`w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none focus:border-foreground/50 transition-all ${
                                      isSyncedSem4 ? 'opacity-70 cursor-not-allowed font-black' : ''
                                    }`}
                                  />
                                </div>
                              ) : (
                                <div className="bg-surface/30 border border-border/50 rounded-xl px-3 py-2 text-center mt-2">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-muted block mb-0.5">
                                    Required SGPA
                                  </span>
                                  <span className="text-sm font-black text-foreground">
                                    {semNum <= targetSemester 
                                      ? (!isPossible ? 'Impossible' : requiredSGPA <= 0 ? '0.00' : requiredSGPA.toFixed(2))
                                      : 'N/A'
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center justify-center py-8 text-center text-[10px] font-bold text-muted uppercase tracking-wider">
                              Not tracked
                            </div>
                          )}
                        </div>

                        {/* Sync Badge for Semester 4 */}
                        {isSyncedSem4 && (
                          <div className="mt-4 pt-2 border-t border-border/50 text-[9px] font-black text-foreground flex items-center gap-1 uppercase tracking-wider justify-center">
                            <Zap className="w-2.5 h-2.5 fill-current text-foreground" />
                            Synced from Sem IV
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </FadeIn>
      </div>

      {/* Printable Report Layout - HELD hidden in standard view but visible during window.print() */}
      <div className="hidden print:block p-8 bg-white text-black min-h-screen">
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">Academic Performance & Strategy Report</h1>
          <p className="text-sm text-gray-600 mt-1">Generated on {new Date().toLocaleDateString()} - Study Hub Workspace</p>
        </div>

        {/* Branch Info */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-2">Branch Configuration</h2>
          <p className="text-sm"><strong>Selected Branch:</strong> {currentBranch?.name || 'None'}</p>
          <p className="text-sm"><strong>Total Semester IV Credits:</strong> {currentBranch?.totalCredits || 0} Credits</p>
        </div>

        {/* Semester Strategy (only if branch is selected) */}
        {currentBranch && (
          <div className="mb-6">
            <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">Semester IV Strategy & Projections</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="p-3 border border-gray-300 rounded">
                <p className="text-xs text-gray-500 uppercase font-semibold">Absolute Best-Case GPA</p>
                <p className="text-2xl font-black">{bestCaseGPA.toFixed(2)}</p>
              </div>
              <div className="p-3 border border-gray-300 rounded">
                <p className="text-xs text-gray-500 uppercase font-semibold">Projected / Simulated GPA</p>
                <p className="text-2xl font-black">{simulatedGPA.toFixed(2)}</p>
              </div>
            </div>

            <table className="w-full text-left border-collapse border border-gray-300 text-sm mb-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2">Subject</th>
                  <th className="border border-gray-300 p-2">Type</th>
                  <th className="border border-gray-300 p-2">Credits</th>
                  <th className="border border-gray-300 p-2">Score / Internal Marks</th>
                  <th className="border border-gray-300 p-2">Target Grade Point / Required Exam Marks</th>
                </tr>
              </thead>
              <tbody>
                {currentBranch.completed.map(sub => (
                  <tr key={sub.id}>
                    <td className="border border-gray-300 p-2 font-semibold">{sub.name}</td>
                    <td className="border border-gray-300 p-2 text-gray-600">Completed</td>
                    <td className="border border-gray-300 p-2">{sub.credits}</td>
                    <td className="border border-gray-300 p-2">{marks[sub.id] || 0} / 100</td>
                    <td className="border border-gray-300 p-2">GP: {getGradePoint(marks[sub.id] || 0)}</td>
                  </tr>
                ))}
                {currentBranch.finals.map(sub => {
                  const current = marks[sub.id] || 0;
                  const simGP = simSelections[sub.id] || 0;
                  const threshold = getThreshold(simGP);
                  const reqFinals = Math.max(16, threshold - current);
                  return (
                    <tr key={sub.id}>
                      <td className="border border-gray-300 p-2 font-semibold">{sub.name}</td>
                      <td className="border border-gray-300 p-2 text-gray-600">Final (Preparation)</td>
                      <td className="border border-gray-300 p-2">{sub.credits}</td>
                      <td className="border border-gray-300 p-2">Internals: {current} / 60</td>
                      <td className="border border-gray-300 p-2">
                        Simulated GP: {simGP} (Requires {reqFinals} in finals)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* CGPA Roadmap Report */}
        <div className="page-break-before mt-8">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">Cumulative CGPA Projection</h2>
          
          <div className="grid grid-cols-3 gap-4 mb-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="p-3 border border-gray-300 rounded">
              <p className="text-xs text-gray-500 uppercase font-semibold">Current CGPA</p>
              <p className="text-2xl font-black">{currentCGPA.toFixed(2)}</p>
            </div>
            <div className="p-3 border border-gray-300 rounded">
              <p className="text-xs text-gray-500 uppercase font-semibold">Target Goal CGPA</p>
              <p className="text-2xl font-black">{targetCGPA.toFixed(2)} by Sem {targetSemester}</p>
            </div>
            <div className="p-3 border border-gray-300 rounded">
              <p className="text-xs text-gray-500 uppercase font-semibold">Required Average SGPA</p>
              <p className="text-2xl font-black">
                {!isPossible ? 'Impossible' : remainingCredits > 0 ? requiredSGPA.toFixed(2) : 'Achieved'}
              </p>
            </div>
          </div>

          <table className="w-full text-left border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2">Semester</th>
                <th className="border border-gray-300 p-2">Status</th>
                <th className="border border-gray-300 p-2">Credits</th>
                <th className="border border-gray-300 p-2">SGPA / Performance</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(semestersData).map(([semNumStr, data]) => {
                const semNum = parseInt(semNumStr);
                if (!data.active) return null;
                return (
                  <tr key={semNum}>
                    <td className="border border-gray-300 p-2 font-semibold">Semester {semNum}</td>
                    <td className="border border-gray-300 p-2">
                      {data.completed ? 'Completed' : 'Planned'}
                    </td>
                    <td className="border border-gray-300 p-2">{data.credits}</td>
                    <td className="border border-gray-300 p-2">
                      {data.completed ? `${data.sgpa.toFixed(2)}` : `Target: ${requiredSGPA.toFixed(2)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
