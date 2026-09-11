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
} from 'lucide-react';
import { FadeIn, ScaleButton } from '@/components/Animations';
import AppLink from '@/components/ui/AppLink';
import { useAcademicStore } from '@/store/academicStore';
import { getAidsGpaData } from '@/lib/syllabusData';
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  SectionHeader,
  Segmented,
  Select,
} from '@/components/ui';

interface Subject {
  id: string;
  name: string;
  credits: number;
}

interface BranchData {
  name: string;
  totalCredits: number;
  semester: number;
  completed: Subject[];
  finals: Subject[];
}

const COURSE_DATA: Record<string, BranchData> = {
  'CORE': { 
    name: 'Computer Engineering (CORE), CSE workspace', 
    totalCredits: 23,
    semester: 4,
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
    semester: 4,
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
    name: 'AI & Data Science (AIDS), Sem 4', 
    totalCredits: 21,
    semester: 4,
    completed: [
      {id:'ai_detl',name:'DET Lab',credits:1}, 
      {id:'ai_aiesl',name:'AI & ES Lab',credits:1}, 
      {id:'ai_pbl2',name:'PBL-II',credits:1}, 
      {id:'ai_ue3',name:'UE-III',credits:3}, 
      {id:'ai_cog',name:'Cognitive Skills',credits:1}, 
      {id:'ai_ruip',name:'Rural Immersion',credits:1}, 
      {id:'ai_iks',name:'IKS',credits:2}
    ],
    finals: [
      {id:'ai_prob',name:'Prob & Stats',credits:4}, 
      {id:'ai_det',name:'Data Eng. Tech.',credits:2}, 
      {id:'ai_aies',name:'AI & Expert Sys.',credits:2}, 
      {id:'ai_daa',name:'DAA',credits:3}
    ]
  },
  'ECE': { 
    name: 'Electronics & Communication (ECE)', 
    totalCredits: 22,
    semester: 4,
    completed: [
      {id:'ece_acal',name:'Analog Circuits Lab',credits:1}, 
      {id:'ece_csfll',name:'Control Systems Lab',credits:1}, 
      {id:'ece_mal',name:'Microcontroller Lab',credits:1}, 
      {id:'ece_ue3',name:'UE-III',credits:3}, 
      {id:'ece_cog',name:'Cognitive Skills',credits:1}, 
      {id:'ece_ruip',name:'Rural Immersion',credits:1}, 
      {id:'ece_iks',name:'IKS',credits:2}
    ],
    finals: [
      {id:'ece_aca',name:'Analog Circuits & App.',credits:3}, 
      {id:'ece_cos',name:'Communication Systems',credits:3}, 
      {id:'ece_csfl',name:'Control Systems & Fuzzy Logic',credits:3}, 
      {id:'ece_ma',name:'Microcontroller App.',credits:3}
    ]
  }
};


function resolveWorkspaceCourse(
  branch: string,
  semester: number,
  courseKeyOverride: string | null,
): BranchData {
  if (courseKeyOverride && COURSE_DATA[courseKeyOverride]) {
    return COURSE_DATA[courseKeyOverride];
  }
  if (branch === 'AIDS') {
    const fromSyllabus = getAidsGpaData(semester);
    if (fromSyllabus) return fromSyllabus as BranchData;
    return COURSE_DATA.AIDS;
  }
  if (branch === 'ECE') return COURSE_DATA.ECE;
  // CSE workspace → CORE Sem 4 table (explicit label; no CORE/CSF product split yet)
  return COURSE_DATA.CORE;
}

function getGradePoint(marks: number) {
  const clamped = Math.min(100, Math.max(0, marks));
  if(clamped >= 90) return 10;
  if(clamped >= 80) return 9;
  if(clamped >= 70) return 8;
  if(clamped >= 60) return 7;
  if(clamped >= 50) return 6;
  if(clamped >= 40) return 5;
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

const DEFAULT_SEMESTERS_DATA: Record<number, { sgpa: number; credits: number; active: boolean; completed: boolean }> = {
  1: { sgpa: 0, credits: 20, active: false, completed: false },
  2: { sgpa: 0, credits: 20, active: false, completed: false },
  3: { sgpa: 0, credits: 20, active: false, completed: false },
  4: { sgpa: 0, credits: 21, active: false, completed: false },
  5: { sgpa: 0, credits: 20, active: false, completed: false },
  6: { sgpa: 0, credits: 20, active: false, completed: false },
  7: { sgpa: 0, credits: 20, active: false, completed: false },
  8: { sgpa: 0, credits: 20, active: false, completed: false },
};

function loadGpaStrategyStorage() {
  let courseKeyOverride: string | null = null;
  let marks: Record<string, number> = {};
  let corrupt = false;
  try {
    const saved = localStorage.getItem('gpa_strategy_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.courseKeyOverride) courseKeyOverride = parsed.courseKeyOverride;
      else if (parsed.branch && COURSE_DATA[parsed.branch] && parsed.branch !== 'AIDS') {
        courseKeyOverride = parsed.branch;
      }
      if (parsed.marks) {
        const clamped: Record<string, number> = {};
        for (const [id, v] of Object.entries(parsed.marks as Record<string, number>)) {
          clamped[id] = Math.min(100, Math.max(0, Number(v) || 0));
        }
        marks = clamped;
      }
    }
  } catch (e) {
    console.error('Failed to load GPA data', e);
    corrupt = true;
  }
  return { courseKeyOverride, marks, corrupt };
}

function loadGpaRoadmapStorage() {
  let semestersData = { ...DEFAULT_SEMESTERS_DATA };
  let targetCGPA = 8.5;
  let targetSemester = 8;
  let corrupt = false;
  try {
    const savedRoadmap = localStorage.getItem('gpa_roadmap_v1');
    if (savedRoadmap) {
      const parsed = JSON.parse(savedRoadmap);
      if (parsed.semestersData) {
        const merged: Record<number, { sgpa: number; credits: number; active: boolean; completed: boolean }> = {};
        for (let i = 1; i <= 8; i++) {
          const defaultSem = { sgpa: 0, credits: 20, active: false, completed: false };
          const savedSem = parsed.semestersData[i] || {};
          merged[i] = {
            ...defaultSem,
            ...savedSem,
            completed: savedSem.completed !== undefined ? savedSem.completed : (savedSem.sgpa > 0)
          };
        }
        semestersData = merged;
      }
      if (parsed.targetCGPA) targetCGPA = parsed.targetCGPA;
      if (parsed.targetSemester) targetSemester = parsed.targetSemester;
    }
  } catch (e) {
    console.error('Failed to load GPA roadmap data', e);
    corrupt = true;
  }
  return { semestersData, targetCGPA, targetSemester, corrupt };
}

export default function GPAClient() {
  const { branch: workspaceBranch, semester: workspaceSemester } = useAcademicStore();
  const [courseKeyOverride, setCourseKeyOverride] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [simSelections, setSimSelections] = useState<Record<string, number>>({});
  const [isCalculated, setIsCalculated] = useState(false);
  const [activeTab, setActiveTab] = useState<'semester' | 'roadmap'>('semester');
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [storageCorrupt, setStorageCorrupt] = useState(false);

  const [semestersData, setSemestersData] = useState<
    Record<number, { sgpa: number; credits: number; active: boolean; completed: boolean }>
  >(() => ({ ...DEFAULT_SEMESTERS_DATA }));
  const [targetCGPA, setTargetCGPA] = useState<number>(8.5);
  const [targetSemester, setTargetSemester] = useState<number>(8);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const strategy = loadGpaStrategyStorage();
      const roadmap = loadGpaRoadmapStorage();
      setCourseKeyOverride(strategy.courseKeyOverride);
      setMarks(strategy.marks);
      setSemestersData(roadmap.semestersData);
      setTargetCGPA(roadmap.targetCGPA);
      setTargetSemester(roadmap.targetSemester);
      setStorageCorrupt(strategy.corrupt || roadmap.corrupt);
      setHydrated(true);
    });
  }, []);

  const targetSemesterOptions = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 7, 8].map((num) => ({
        value: num,
        label: `Semester ${num}`,
      })),
    [],
  );

  const currentBranch = useMemo(
    () => resolveWorkspaceCourse(workspaceBranch, workspaceSemester, courseKeyOverride),
    [workspaceBranch, workspaceSemester, courseKeyOverride],
  );
  const calcSemester = currentBranch.semester;
  const workspaceKey = `${workspaceBranch}:${workspaceSemester}:${courseKeyOverride ?? ''}`;
  const [prevWorkspaceKey, setPrevWorkspaceKey] = useState(workspaceKey);
  if (prevWorkspaceKey !== workspaceKey) {
    setPrevWorkspaceKey(workspaceKey);
    setIsCalculated(false);
    setSimSelections({});
  }

  // Save to LocalStorage — only after hydration so defaults cannot wipe saved data
  useEffect(() => {
    if (!hydrated || storageCorrupt) return;
    localStorage.setItem('gpa_strategy_v1', JSON.stringify({
      courseKeyOverride,
      marks,
    }));
  }, [hydrated, storageCorrupt, courseKeyOverride, marks]);

  useEffect(() => {
    if (!hydrated || storageCorrupt) return;
    localStorage.setItem('gpa_roadmap_v1', JSON.stringify({
      semestersData,
      targetCGPA,
      targetSemester
    }));
  }, [hydrated, storageCorrupt, semestersData, targetCGPA, targetSemester]);

  const resetCorruptStorage = () => {
    localStorage.removeItem('gpa_strategy_v1');
    localStorage.removeItem('gpa_roadmap_v1');
    setCourseKeyOverride(null);
    setMarks({});
    setSemestersData({ ...DEFAULT_SEMESTERS_DATA });
    setTargetCGPA(8.5);
    setTargetSemester(8);
    setIsCalculated(false);
    setSimSelections({});
    setStorageCorrupt(false);
  };

  const handleMarkChange = (id: string, value: string) => {
    const num = Math.min(100, Math.max(0, parseFloat(value) || 0));
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
    
    return currentBranch.totalCredits > 0
      ? parseFloat((totalPoints / currentBranch.totalCredits).toFixed(2))
      : 0;
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
    
    return currentBranch.totalCredits > 0
      ? parseFloat((totalPoints / currentBranch.totalCredits).toFixed(2))
      : 0;
  }, [currentBranch, marks, simSelections]);

  const simSyncKey = `${isCalculated}|${calcSemester}|${simulatedGPA}|${currentBranch.totalCredits}`;
  const [prevSimSyncKey, setPrevSimSyncKey] = useState(simSyncKey);
  if (isCalculated && currentBranch && prevSimSyncKey !== simSyncKey) {
    setPrevSimSyncKey(simSyncKey);
    setSemestersData((prev) => {
      const currentSem = prev[calcSemester];
      if (
        currentSem.sgpa === simulatedGPA &&
        currentSem.credits === currentBranch.totalCredits &&
        currentSem.active &&
        currentSem.completed
      ) {
        return prev;
      }
      return {
        ...prev,
        [calcSemester]: {
          sgpa: simulatedGPA,
          credits: currentBranch.totalCredits,
          active: true,
          completed: true,
        },
      };
    });
  }

  // Calculations for Cumulative CGPA
  const { currentCGPA, totalCompletedCredits, activeCompletedSemestersCount } = useMemo(() => {
    let totalPoints = 0;
    let totalCredits = 0;
    let completedCount = 0;

    Object.entries(semestersData).forEach(([, data]) => {
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

  if (showCoursePicker) {
    return (
      <div className="flex-1 w-full max-w-7xl mx-auto page-gutter py-8 min-h-[80vh]">
        <FadeIn>
          <div className="text-center mb-12">
            <PageHeader
              className="sm:flex-col sm:items-center [&_h1]:flex [&_h1]:items-center [&_h1]:justify-center [&_h1]:gap-3 [&_p]:mx-auto"
              title={
                <>
                  <Calculator className="w-8 h-8 sm:w-10 sm:h-10" />
                  Course Table Override
                </>
              }
              description={
                <>
                  Workspace is {workspaceBranch} Sem {workspaceSemester}. Pick a Sem 4 fallback table if needed (CSE defaults to CORE).
                  <button
                    type="button"
                    onClick={() => {
                      setCourseKeyOverride(null);
                      setShowCoursePicker(false);
                    }}
                    className="mt-4 block w-full text-sm font-semibold text-primary underline underline-offset-4"
                  >
                    Use workspace syllabus defaults
                  </button>
                </>
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(COURSE_DATA).map(([key, data]) => (
              <ScaleButton
                key={key}
                onClick={() => {
                  setCourseKeyOverride(key);
                  setShowCoursePicker(false);
                  setIsCalculated(false);
                }}
                className="group relative resource-card-hover rounded-2xl bg-card p-4 sm:p-8 text-left w-full h-full border border-border transition-all duration-300 flex flex-col justify-between overflow-hidden"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--foreground),0.02),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div>
                  <div className="w-12 h-12 bg-surface border border-border rounded-xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:bg-foreground group-hover:text-background group-hover:border-foreground shadow-xs">
                    <GraduationCap className="w-6 h-6 text-foreground group-hover:text-background transition-colors" />
                  </div>
                  <h3 className="text-xl font-extrabold text-foreground mb-2 leading-tight tracking-tight">
                    {data.name}
                  </h3>
                </div>
                <p className="text-muted text-[10px] font-extrabold uppercase tracking-widest mt-6">
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
    <div className="flex-1 w-full max-w-7xl mx-auto page-gutter py-5 sm:py-8 min-h-[80vh]">
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
        {storageCorrupt && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-border bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-muted shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Saved GPA data could not be read
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Local storage may be corrupt. Reset to start fresh — unsaved values on this page will be cleared.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={resetCorruptStorage}
              className="shrink-0"
            >
              Reset saved data
            </Button>
          </div>
        )}
        <FadeIn>
          <div className="mb-6 space-y-3">
            <button 
              onClick={() => {
                setShowCoursePicker(true);
                setIsCalculated(false);
              }}
              className="group inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Change course table
            </button>
            <PageHeader
              title={currentBranch?.name}
              description={
                <span className="inline-flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Sem {calcSemester} from workspace ({workspaceBranch}). Credits follow the official syllabus where available.
                  </span>
                </span>
              }
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setMarks({});
                      setIsCalculated(false);
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset marks
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => window.print()}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print report
                  </Button>
                </div>
              }
            />
          </div>

          <div className="mb-6">
            <Segmented
              value={activeTab}
              onChange={setActiveTab}
              size="sm"
              aria-label="GPA calculator mode"
              options={[
                { value: 'semester', label: 'Semester strategy' },
                { value: 'roadmap', label: 'CGPA roadmap' },
              ]}
            />
          </div>

          {/* TAB 1: Semester Strategy */}
          {activeTab === 'semester' && (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mb-8 items-start">
                <Card padding="none" className="overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-surface/40 flex items-center gap-2">
                    <History className="w-4 h-4 text-muted" />
                    <SectionHeader title="Completed subjects" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/60">
                    {currentBranch?.completed.map(sub => (
                      <div key={sub.id} className="bg-card p-3 sm:p-3.5">
                        <Field
                          label={
                            <>
                              {sub.name}{' '}
                              <span className="text-muted font-normal">({sub.credits} cr)</span>
                            </>
                          }
                          htmlFor={sub.id}
                        >
                          <Input
                            id={sub.id}
                            type="number"
                            max={100}
                            inputSize="sm"
                            placeholder="Marks / 100"
                            value={marks[sub.id] || ''}
                            onChange={(e) => handleMarkChange(sub.id, e.target.value)}
                          />
                        </Field>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card padding="none" className="overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-surface/40 flex items-center gap-2">
                    <Target className="w-4 h-4 text-muted" />
                    <SectionHeader title="Finals preparation" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/60">
                    {currentBranch?.finals.map(sub => (
                      <div key={sub.id} className="bg-card p-3 sm:p-3.5">
                        <Field
                          label={
                            <>
                              {sub.name}{' '}
                              <span className="text-muted font-normal">({sub.credits} cr)</span>
                            </>
                          }
                          htmlFor={sub.id}
                        >
                          <Input
                            id={sub.id}
                            type="number"
                            max={60}
                            inputSize="sm"
                            placeholder="Internals / 60"
                            value={marks[sub.id] || ''}
                            onChange={(e) => handleMarkChange(sub.id, e.target.value)}
                          />
                        </Field>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-border bg-surface/30">
                    <Button
                      type="button"
                      className="w-full"
                      onClick={calculateStrategy}
                    >
                      <TrendingUp className="w-4 h-4" />
                      Calculate strategy
                    </Button>
                  </div>
                </Card>
              </div>

              {isCalculated && (
                <div id="strategy-results" className="space-y-12 pb-20">
                  {/* Best Case Summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 bg-foreground text-background p-4 sm:p-8 rounded-2xl flex flex-col items-center justify-center text-center shadow-card relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-background/10 rounded-none -mr-16 -mt-16 blur-2xl" />
                      <p className="text-background/60 text-[10px] font-black uppercase tracking-widest mb-2">Absolute Best-Case GPA</p>
                      <div className="text-8xl font-black tracking-tighter mb-4">{bestCaseGPA.toFixed(2)}</div>
                      <p className="text-background/40 text-[10px] uppercase font-bold tracking-wider leading-relaxed px-4">
                        Assuming 40/40 in all final exams
                      </p>
                    </div>

                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/70 shadow-sm">
                      {currentBranch?.finals.map(sub => {
                        const current = marks[sub.id] || 0;
                        const maxPossible = current + 40;
                        const bestGP = maxPossible < 40 ? 0 : getGradePoint(maxPossible);
                        const requiredForBest = Math.max(16, getThreshold(bestGP) - current);
                        
                        return (
                          <div key={sub.id} className="bg-card p-5 flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-4">
                              <h3 className="font-black text-sm uppercase text-foreground">{sub.name}</h3>
                              <div className="bg-surface px-2 py-1 rounded-md text-[10px] font-black text-muted border border-border">{sub.credits} Cr</div>
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
                  <div className="bg-card border border-border p-4 sm:p-8 rounded-2xl shadow-sm border-dashed">
                    <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                      <div>
                        <h2 className="text-2xl font-black text-foreground flex items-center gap-3">
                          <Zap className="w-6 h-6 text-foreground" />
                          Projected Simulator
                        </h2>
                        <p className="text-muted text-sm mt-1 uppercase tracking-widest font-bold">Select realistic targets to see your projected GPA</p>
                      </div>
                      <div className="bg-surface border border-border px-4 sm:px-10 py-6 text-center min-w-0 sm:min-w-[200px] rounded-xl shadow-xs">
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
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-sm font-black uppercase text-foreground min-w-0 truncate sm:min-w-[120px] sm:overflow-visible sm:whitespace-normal">{sub.name}</span>
                              <div className="h-px flex-1 bg-border/50 hidden sm:block" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-7 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/70 max-w-xl">
                              {[10, 9, 8, 7, 6, 5, 0].map(gp => {
                                const isDisabled = gp > bestGP;
                                const isActive = simSelections[sub.id] === gp;
                                
                                return (
                                  <button
                                    key={gp}
                                    disabled={isDisabled}
                                    onClick={() => setSimSelections(prev => ({ ...prev, [sub.id]: gp }))}
                                    className={`
                                      py-3 min-h-11 text-center text-xs font-bold transition-all
                                      ${isDisabled ? 'bg-card opacity-20 cursor-not-allowed' : ''}
                                      ${isActive ? 'bg-foreground text-background font-black' : 'bg-surface text-muted hover:text-foreground hover:bg-surface-hover'}
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
                    <summary className="px-4 sm:px-8 py-6 cursor-pointer flex items-center justify-between hover:bg-surface/50 active:bg-surface/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-muted" />
                        <span className="font-black text-sm uppercase tracking-widest text-foreground">Advanced Bracket Breakdown</span>
                      </div>
                      <ChevronLeft className="w-5 h-5 text-muted group-open:-rotate-90 transition-transform" />
                    </summary>
                    <div className="p-4 sm:p-8 pt-0 grid grid-cols-1 md:grid-cols-2 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/70 shadow-sm bg-card">
                      {currentBranch?.finals.map(sub => {
                        const currentMarks = marks[sub.id] || 0;
                        const rawPassReq = 40 - currentMarks;
                        const actualPassReq = Math.max(16, rawPassReq);
                        
                        return (
                          <div key={sub.id} className="bg-card p-6 space-y-4">
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

                              <AppLink
                                href={`/ask?tab=chat&prompt=${encodeURIComponent(`I want to achieve a high grade in my Semester ${calcSemester} course: "${sub.name}". Based on my current class resources, can you explain the most critical units, concepts, and formulas I should focus on to score 90+? Please break down a study schedule and list some potential exam questions.`)}`}
                                className="w-full mt-4 flex items-center justify-center gap-1.5 py-2 bg-foreground text-background hover:opacity-90 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-opacity text-center block"
                              >
                                <Target className="w-3.5 h-3.5" />
                                Generate AI Study Guide
                              </AppLink>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/70 shadow-sm">
                {/* Metric 1: Current CGPA */}
                <div className="bg-card p-6 flex flex-col justify-between relative overflow-hidden">
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
                <div className="bg-card p-6 flex flex-col justify-between">
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
                    <div className="w-full bg-surface border border-border h-4 overflow-hidden rounded-full p-0.5">
                      <div 
                        className="bg-foreground h-full transition-all duration-500 rounded-full"
                        style={{ width: `${currentCGPA > 0 ? Math.min(100, (currentCGPA / targetCGPA) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Metric 3: Required SGPA Target */}
                <div className={`bg-card p-6 flex flex-col justify-between relative overflow-hidden transition-all ${
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
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border flex items-center gap-3">
                  <Target className="w-5 h-5 text-foreground" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                    CGPA Goal Tracker settings
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/60">
                  <div className="p-6 space-y-2 bg-card">
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

                  <div className="p-6 space-y-2 bg-card">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted block pl-1">
                      Target Semester Horizon
                    </label>
                    <Select
                      value={targetSemester}
                      options={targetSemesterOptions}
                      onChange={setTargetSemester}
                      size="lg"
                    />
                  </div>
                </div>
              </div>

              {/* Semesters Configuration Grid */}
              <div className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground pl-1">
                  Semester Scoreboards (1 - 8)
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/70 shadow-sm">
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((semNum) => {
                    const sem = semestersData[semNum] || { sgpa: 0, credits: 20, active: false, completed: false };
                    const isSyncedSem = semNum === calcSemester && isCalculated;
                    
                    return (
                      <div 
                        key={semNum}
                        className={`bg-card p-5 transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                          sem.active 
                            ? 'relative z-10 shadow-sm' 
                            : 'opacity-65 hover:opacity-100'
                        }`}
                      >
                        <div>
                          {/* Semester Title & Active Switch */}
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-sm uppercase text-foreground">
                              Semester {semNum}
                            </h3>
                            <Segmented
                              size="sm"
                              value={sem.active ? 'active' : 'inactive'}
                              onChange={(v) => {
                                if (v === 'active' && !sem.active) handleSemesterActiveToggle(semNum);
                                if (v === 'inactive' && sem.active) handleSemesterActiveToggle(semNum);
                              }}
                              options={[
                                { value: 'inactive', label: 'Inactive' },
                                { value: 'active', label: 'Active' },
                              ]}
                              aria-label={`Semester ${semNum} active state`}
                            />
                          </div>

                          {/* Render Details if Active */}
                          {sem.active ? (
                            <div className="space-y-4">
                              {/* Status completed vs planned selector */}
                              <Segmented
                                size="sm"
                                value={sem.completed ? 'completed' : 'planned'}
                                disabled={isSyncedSem}
                                onChange={(v) =>
                                  handleSemesterCompletedToggle(semNum, v === 'completed')
                                }
                                options={[
                                  { value: 'completed', label: 'Completed' },
                                  { value: 'planned', label: 'Planned' },
                                ]}
                                aria-label={`Semester ${semNum} completion status`}
                                className="w-full"
                              />

                              {/* Credits field */}
                              <div className="space-y-1">
                                <label className="text-xs font-black uppercase tracking-widest text-muted block pl-0.5">
                                  Credits
                                </label>
                                <input
                                  type="number"
                                  value={sem.credits || ''}
                                  disabled={isSyncedSem}
                                  onChange={(e) => handleSemesterCreditsChange(semNum, e.target.value)}
                                  className={`w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none focus:border-foreground/50 transition-all ${
                                    isSyncedSem ? 'opacity-70 cursor-not-allowed' : ''
                                  }`}
                                />
                              </div>

                              {/* SGPA or Target required display */}
                              {sem.completed ? (
                                <div className="space-y-1">
                                  <label className="text-xs font-black uppercase tracking-widest text-muted block pl-0.5">
                                    SGPA
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="10"
                                    value={sem.sgpa || ''}
                                    disabled={isSyncedSem}
                                    onChange={(e) => handleSemesterSgpaChange(semNum, e.target.value)}
                                    className={`w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none focus:border-foreground/50 transition-all ${
                                      isSyncedSem ? 'opacity-70 cursor-not-allowed font-black' : ''
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

                        {/* Sync Badge for calculator semester */}
                        {isSyncedSem && (
                          <div className="mt-4 pt-2 border-t border-border/50 text-xs font-black text-foreground flex items-center gap-1 uppercase tracking-wider justify-center">
                            <Zap className="w-2.5 h-2.5 fill-current text-foreground" />
                            Synced from semester strategy
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
      <div className="hidden print:block gpa-print-island p-8 min-h-screen">
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">Academic Performance & Strategy Report</h1>
          <p className="text-sm text-gray-600 mt-1" suppressHydrationWarning>
            Generated on {new Date().toLocaleDateString('en-GB')} - Study Hub Workspace
          </p>
        </div>

        {/* Branch Info */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-2">Branch Configuration</h2>
          <p className="text-sm"><strong>Course:</strong> {currentBranch?.name || 'None'}</p>
          <p className="text-sm"><strong>Total Semester {calcSemester} Credits:</strong> {currentBranch?.totalCredits || 0} Credits</p>
        </div>

        {/* Semester Strategy (only if branch is selected) */}
        {currentBranch && (
          <div className="mb-6">
            <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">Semester Strategy & Projections</h2>
            
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
