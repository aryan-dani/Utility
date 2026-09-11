'use client';

import { useMemo, useState, useEffect } from 'react';
import { SubjectItem, ResourceItem } from '@/lib/dataFetcher';
import { useAcademicStore } from '@/store/academicStore';
import { cleanResourceTitle } from '@/lib/titleUtils';
import { 
  BookMarked, 
  Layers, 
  FileText, 
  ArrowRight, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Brain, 
  HelpCircle, 
  Clock, 
  BookOpen,  
  Cpu, 
  Database, 
  Activity, 
  CheckCircle2, 
  ChevronRight,
  Compass,
  Calendar
} from 'lucide-react';
import { logActivity, localDateKey } from '@/lib/activity';
import { NotesDisclaimer } from '@/components/NotesDisclaimer';
import { isSubjectMatch } from '@/lib/subjectMatcher';
import {
  AIDS_SEM_3_SUBJECTS_2026,
  AIDS_SEM_4_SUBJECTS,
  AIDS_SEM_5_SUBJECTS,
} from '@/lib/syllabusData';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { notify } from '@/lib/toast';
import { parseUnitKey, unitFolderId } from '@/lib/resourceGroups';
import { buildResourcesHref } from '@/lib/resourceUrl';
import AcademicBreadcrumb from '@/components/AcademicBreadcrumb';
import AppLink from '@/components/ui/AppLink';
import { Button, Card, Badge, Input, Select, Segmented, Modal, PageHeader, ErrorState } from '@/components/ui';
import { useWorkspaceResources } from '@/lib/useWorkspaceResources';
import { generateId } from '@/lib/id';
import PageSkeleton from '@/components/PageSkeleton';
import type { Task } from '@/app/planner/PlannerClient';

interface ResourceItemExt extends ResourceItem {
  subject_name: string;
}

const STORAGE_KEY = 'utility_syllabus_progress';

function computeMatchingResources(
  moduleTitle: string,
  moduleDesc: string,
  subjectName: string,
  resources: ResourceItemExt[],
) {
  const subjectResources = resources.filter(
    r => isSubjectMatch(r.subject_name, subjectName)
  );

  const pool = subjectResources;
  if (pool.length === 0) return [];

  const moduleUnit = parseUnitKey(moduleTitle);

  const titleWords = moduleTitle.toLowerCase()
    .replace(/unit\s+[ivx\d]+/gi, '')
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

  const descWords = moduleDesc.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

  const keywords = Array.from(new Set([...titleWords, ...descWords]));

  const scored = pool.map(resource => {
    const rTitle = resource.title.toLowerCase();
    let score = 0;
    if (moduleUnit) {
      const resourceUnit = parseUnitKey(resource.title);
      if (resourceUnit && resourceUnit.num === moduleUnit.num) {
        score += 5;
      }
    }
    keywords.forEach(word => {
      if (rTitle.includes(word)) {
        score += 1;
      }
    });
    return { resource, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.resource)
    .slice(0, 3);
}

function getModulesForSubject(name: string) {
  const upper = name.toUpperCase();
  if (upper.includes('DATA STRUCTURE') || upper.includes('DSA')) {
    return [
      { title: 'Arrays, Strings & Linked Lists', desc: 'Memory allocation, pointer manipulation, singly and doubly linked lists, and basic operations.' },
      { title: 'Stacks & Queues', desc: 'LIFO and FIFO principles, circular queues, priority queues, and application in parsing.' },
      { title: 'Trees & Graphs', desc: 'Binary search trees, AVL trees, graph representations, BFS, DFS, and spanning trees.' },
      { title: 'Sorting & Searching', desc: 'Comparison-based sorting (Quick, Merge, Heap), linear/binary search, and hashing.' },
      { title: 'Advanced Data Structures', desc: 'Tries, B-Trees, Fibonacci heaps, and disjoint set data structures.' }
    ];
  }
  if (upper.includes('DIGITAL ELECTRONICS') || upper === 'DE') {
    return [
      { title: 'Unit I: Number Systems & Boolean Algebra', desc: 'Binary codes, Boolean minimization using K-maps and Quine-McCluskey method, and logic gate implementation.' },
      { title: 'Unit II: Combinational Logic Design', desc: 'Design of adders, subtractors, code converters, decoders, encoders, multiplexers, and demultiplexers.' },
      { title: 'Unit III: Sequential Logic Design', desc: 'Latches, flip-flops (SR, JK, D, T), excitation tables, shift registers, and design of synchronous/asynchronous counters.' },
      { title: 'Unit IV: Finite State Machines & Logic Families', desc: 'State diagrams, state reduction, Mealy and Moore models, and TTL/CMOS logic families.' }
    ];
  }
  if (upper.includes('SIGNALS') || upper === 'SS') {
    return [
      { title: 'Unit I: Classification of Signals & Systems', desc: 'Continuous-time and discrete-time signals, operations on signals, and system properties (causality, linearity, time-invariance).' },
      { title: 'Unit II: Linear Time-Invariant Systems & Convolution', desc: 'Impulse response, convolution integral and sum, and LTI system properties in time domain.' },
      { title: 'Unit III: Fourier Analysis', desc: 'Continuous-Time Fourier Transform (CTFT), Discrete-Time Fourier Transform (DTFT), properties, and frequency response.' },
      { title: 'Unit IV: Laplace & Z-Transforms', desc: 'Laplace transform, Z-transform, Region of Convergence (ROC), properties, inverse transforms, and LTI system analysis.' }
    ];
  }
  if (upper.includes('ELECTRONIC DEVICES') || upper === 'EDC') {
    return [
      { title: 'Unit I: Semiconductor Diodes & Special Devices', desc: 'PN junction diode, Zener diode, Varactor diode, BJT structure/characteristics, and MOSFET structure/characteristics.' },
      { title: 'Unit II: MOSFET DC Analysis & Biasing', desc: 'MOSFET DC biasing configurations, load lines, and bias stability analysis.' },
      { title: 'Unit III: MOSFET AC Analysis & Amplifiers', desc: 'MOSFET small-signal model, Common Source, Common Gate, and Common Drain amplifier configurations.' },
      { title: 'Unit IV: Feedback Amplifiers & Oscillators', desc: 'Feedback concepts, feedback topologies (voltage/current, series/shunt), and Barkhausen criterion for oscillators.' }
    ];
  }
  if (upper.includes('CALCULUS') || upper === 'CSM') {
    return [
      { title: 'Unit I: Vector Calculus', desc: 'Gradient, divergence, curl, line integrals, surface integrals, volume integrals, and Green’s, Stokes’, and Divergence theorems.' },
      { title: 'Unit II: Multiple Integrals & Applications', desc: 'Double and triple integrals, change of variables, jacobians, area, and volume calculation.' },
      { title: 'Unit III: Probability Distributions', desc: 'Random variables, probability mass/density functions, mathematical expectation, Binomial, Poisson, and Normal distributions.' },
      { title: 'Unit IV: Statistical Inference & Hypothesis Testing', desc: 'Sampling distributions, central limit theorem, testing of hypothesis (Z-test, t-test, Chi-square test), and confidence intervals.' }
    ];
  }
  if (upper.includes('PEACE') || upper.includes('SCIENCE, RELIGION') || upper === 'SRS' || upper === 'PEACE') {
    return [
      { title: 'Unit I: Science and Spirituality Integration', desc: 'Methods of science vs methods of religion, philosophy of science, and synthesis of science and spirituality.' },
      { title: 'Unit II: Human Values & Ethics', desc: 'Truth, right conduct, peace, love, non-violence, professional ethics, and moral development models.' },
      { title: 'Unit III: World Religions & Spiritual Philosophies', desc: 'Core teachings of major world religions, common values, and inter-religious dialogue for peace.' },
      { title: 'Unit IV: Mind, Consciousness & Well-being', desc: 'Stress management, mindfulness, meditation, spiritual practices, and holistic health and wellness.' }
    ];
  }
  if (upper.includes('DATABASE') || upper.includes('DBMS')) {
    return [
      { title: 'Introduction & ER Modeling', desc: 'Database architecture, entity-relationship diagrams, relational models, and schema design.' },
      { title: 'Relational Algebra & SQL', desc: 'Selection, projection, joins, complex SQL queries, views, and triggers.' },
      { title: 'Normalization & Schema Refinement', desc: 'Functional dependencies, 1NF, 2NF, 3NF, BCNF, and lossless decomposition.' },
      { title: 'Transaction Management & Concurrency', desc: 'ACID properties, serializability, two-phase locking, and deadlock handling.' },
      { title: 'Indexing & Storage', desc: 'B+ trees, hash indexing, query processing, and query optimization techniques.' }
    ];
  }
  if (upper.includes('MACHINE LEARNING') || upper === 'ML') {
    return [
      { title: 'Unit I: Introduction to ML & Data Preparation', desc: 'Supervised/unsupervised/reinforcement learning, encoding, preprocessing, EDA, cross-validation, and PCA.' },
      { title: 'Unit II: Supervised Learning Techniques', desc: 'Decision trees, SVM, nearest neighbour, evaluation metrics, ensemble methods, and class imbalance handling.' },
      { title: 'Unit III: Unsupervised Learning', desc: 'Hierarchical clustering, K-Medoids, DBSCAN, BIRCH, CURE, quality metrics, and EM algorithm.' },
      { title: 'Unit IV: Advanced ML Models', desc: 'Regression, regularization, LASSO, HMM, and anomaly/outlier detection.' },
      { title: 'Unit V: Trends in Machine Learning', desc: 'Bayesian networks, genetic algorithms, reinforcement, active, and transfer learning applications.' }
    ];
  }
  if (upper.includes('SOFTWARE ENGINEERING') || upper === 'SEM') {
    return [
      { title: 'Unit I: Software Engineering & Requirements', desc: 'Process models (waterfall, spiral, agile), SRS, and functional/non-functional requirements.' },
      { title: 'Unit II: Software Design', desc: 'Cohesion/coupling, ER/DFD, UML static and dynamic modelling.' },
      { title: 'Unit III: Software Project Management', desc: 'Metrics, function points, COCOMO II, PERT/CPM, and risk management.' },
      { title: 'Unit IV: Testing', desc: 'V-model, white/black box testing, unit/integration/system testing, and test plans.' },
      { title: 'Unit V: Trends in Software Engineering', desc: 'Agile/XP practices, DevOps toolchain, and SE in IoT, data science, cloud, and security.' }
    ];
  }
  if (upper.includes('DATA VISUALIZATION')) {
    return [
      { title: 'Python Programming Basics', desc: 'Variables, collections, conditionals, functions, and file handling for visualization workflows.' },
      { title: 'Visualization Libraries', desc: 'Effective visualization principles with Excel, Matplotlib, and Seaborn case studies.' },
      { title: 'Tableau Dashboards', desc: 'Connectivity, charts, advanced reports, dashboards, calculations, and filters.' },
      { title: 'Power BI Analytics', desc: 'Connections, data modelling, dashboards, reports, and charts.' }
    ];
  }
  if (upper.includes('OPERATING SYSTEM') || upper.includes('OS')) {
    return [
      { title: 'Unit I: Introduction to Operating Systems', desc: 'OS types and services, Linux commands, and shell programming.' },
      { title: 'Unit II: Process Management', desc: 'Process states, PCB, threads, and FCFS/SJF/RR scheduling.' },
      { title: 'Unit III: Concurrency Control', desc: 'Critical section, semaphores, classical IPC problems, and deadlock handling.' },
      { title: 'Unit IV: Memory Management', desc: 'Partitioning, virtual memory, paging/segmentation, and page replacement algorithms.' },
      { title: 'Unit V: I/O and File Management', desc: 'I/O hardware, file systems, allocation methods, and disk scheduling.' }
    ];
  }
  if (upper.includes('NETWORK') || upper.includes('CN')) {
    return [
      { title: 'Network Models & Physical Layer', desc: 'OSI and TCP/IP reference models, transmission media, switching, and multiplexing techniques.' },
      { title: 'Data Link Layer & LANs', desc: 'Framing, error detection/correction (CRC), MAC protocols (CSMA/CD, CSMA/CA), and Ethernet.' },
      { title: 'Network Layer & Routing', desc: 'IPv4/IPv6 addressing, subnetting, routing algorithms (Distance Vector, Link State), and ICMP/ARP.' },
      { title: 'Transport Layer Protocols', desc: 'UDP, TCP connection management, flow control, congestion control, and socket programming.' },
      { title: 'Application Layer & Security', desc: 'DNS, HTTP, FTP, SMTP, cryptography basics, SSL/TLS, and network security protocols.' }
    ];
  }
  if (upper.includes('ANALOG CIRCUITS') || upper === 'ACA') {
    return [
      { title: 'Unit I: MOSFET Characteristics & DC Analysis', desc: 'MOSFET DC analysis, biasing circuits, and load line configuration.' },
      { title: 'Unit II: Amplifiers & Feedback Systems', desc: 'MOSFET AC analysis, differential amplifiers, and feedback topologies.' },
      { title: 'Unit III: Operational Amplifiers (Op-Amps)', desc: 'Linear and non-linear Op-Amp applications, summing amplifiers, and frequency response.' },
      { title: 'Unit IV: Data Converters (DAC & ADC)', desc: 'Weighted binary DAC, R-2R ladder, Flash ADC, and Successive Approximation Register (SAR) ADC.' }
    ];
  }
  if (upper.includes('COMMUNICATION SYSTEMS') || upper === 'COS') {
    return [
      { title: 'Unit I: Amplitude Modulation (AM)', desc: 'Double sideband, single sideband, vestigial sideband transmission, and AM demodulators.' },
      { title: 'Unit II: Angle Modulation (FM & PM)', desc: 'Frequency modulation, phase modulation, narrow-band FM, wide-band FM, and demodulation techniques.' },
      { title: 'Unit III: Random Processes & Noise', desc: 'Probability theory, random variables, stationary processes, power spectral density, and noise in modulation.' },
      { title: 'Unit IV: Pulse & Digital Modulation', desc: 'Sampling theorem, PAM, PWM, PPM, and introduction to digital encoding schemes.' }
    ];
  }
  if (upper.includes('CONTROL SYSTEMS') || upper === 'CSFL') {
    return [
      { title: 'Unit I: Control Systems & Modeling', desc: 'Mathematical modeling of physical systems, transfer functions, and block diagram reduction.' },
      { title: 'Unit II: Time Domain Analysis & Stability', desc: 'Transient and steady-state response, Routh-Hurwitz stability criterion, and Root Locus techniques.' },
      { title: 'Unit III: Frequency Domain Analysis', desc: 'Bode plots, Nyquist stability criterion, polar plots, and design of compensators.' },
      { title: 'Unit IV: Fuzzy Logic Controllers', desc: 'Fuzzy sets, membership functions, fuzzification, fuzzy rules, defuzzification, and controller applications.' }
    ];
  }
  if (upper.includes('MICROCONTROLLER') || upper === 'MA') {
    return [
      { title: 'Unit I: 8051 Microcontroller Architecture', desc: 'Pin diagram, internal memory organization, register banks, SFRs, and addressing modes.' },
      { title: 'Unit II: Programming & Instruction Set', desc: 'Assembly language programming, data transfer, arithmetic and logical instructions, and I/O programming.' },
      { title: 'Unit III: Hardware & Peripheral Interfacing', desc: 'Interfacing displays (LCD, 7-Segment), keyboards, ADCs/DACs, and DC/Stepper motors.' },
      { title: 'Unit IV: Timers, Interrupts & Serial Communication', desc: 'Timer/Counter programming, external interrupts, serial port programming, and RS-232 standards.' }
    ];
  }
  return [
    { title: 'Unit I: Core Principles & Theoretical Foundations', desc: 'Fundamental definitions, historical context, underlying mathematical models, and primary architectural concepts.' },
    { title: 'Unit II: Operational Workflows & System Mechanisms', desc: 'Detailed structural breakdown, core operational workflows, intermediate theorems, and standard analytical methodologies.' },
    { title: 'Unit III: Advanced Methodologies & Subsystem Design', desc: 'In-depth exploration of complex subsystems, advanced algorithmic approaches, and structural optimization techniques.' },
    { title: 'Unit IV: Industry Implementation & Practical Applications', desc: 'Real-world case studies, contemporary industry tooling, practical project synthesis, and comprehensive performance evaluation.' }
  ];
}

export default function SyllabusClient() {
  const { searchQuery } = useAcademicStore();
  const {
    resources: catalogResources,
    subjects: subjectNames,
    syllabusUrl,
    loading: catalogLoading,
    error: catalogError,
    retry: retryCatalog,
    academicYear,
    branch,
    semester,
  } = useWorkspaceResources();

  const subjects: SubjectItem[] = useMemo(
    () =>
      subjectNames.map((name) => ({
        id: name,
        name,
        branch,
        semester,
      })),
    [subjectNames, branch, semester],
  );
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, boolean | string>>({});
  const resources = catalogResources as ResourceItemExt[];

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setProgressMap(JSON.parse(saved) as Record<string, boolean | string>);
        }
      } catch {
        /* ignore */
      }
    });
  }, []);

  // Scheduler Modal State
  const [plannerModalOpen, setPlannerModalOpen] = useState(false);
  const [schedulingModule, setSchedulingModule] = useState<{ subjectName: string; moduleTitle: string } | null>(null);
  const [scheduleDate, setScheduleDate] = useState(localDateKey());
  const [scheduleCategory, setScheduleCategory] = useState('Revision');
  const [scheduleTitle, setScheduleTitle] = useState('');

  const updateModuleStatus = (subjectId: string, moduleIdx: number, status: 'not-started' | 'in-progress' | 'mastered') => {
    const key = `${subjectId}_${moduleIdx}`;
    setProgressMap((prev) => {
      const updated = { ...prev, [key]: status };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      if (status === 'mastered') {
        logActivity('syllabus_module_completed', 1);
      }
      return updated;
    });
  };

  const handleScheduleTask = async () => {
    if (!schedulingModule) return;

    const dateParts = scheduleDate.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);

    const taskText = scheduleTitle || `Study: ${schedulingModule.subjectName} - ${schedulingModule.moduleTitle}`;
    
    const newTask: Task = {
      id: generateId(),
      text: taskText,
      done: false,
      subtasks: [],
      category: scheduleCategory as Task['category'],
    };

    const key = `utility_planner_v2_${year}_${month}`;
    let planData: Record<string, Task[]> = {};
    let planMeta = { title: 'Study Plan', month, year, is_public: false };

    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        planData = parsed.data || {};
        planMeta = parsed.meta || planMeta;
      }
    } catch (e) {
      console.error(e);
    }

    if (!planData[scheduleDate]) {
      planData[scheduleDate] = [];
    }
    planData[scheduleDate].push(newTask);

    localStorage.setItem(key, JSON.stringify({ data: planData, meta: planMeta }));
    notify.success(`Scheduled task on ${scheduleDate}`);

    const user = auth.currentUser;
    if (user) {
      try {
        const q = query(
          collection(db, 'planner_plans'),
          where('owner_id', '==', user.uid),
          where('month', '==', month),
          where('year', '==', year)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const docId = snapshot.docs[0].id;
          await updateDoc(doc(db, 'planner_plans', docId), {
            data: planData,
            updated_at: new Date().toISOString()
          });
        } else {
          const newDocRef = doc(collection(db, 'planner_plans'));
          await setDoc(newDocRef, {
            owner_id: user.uid,
            owner_email: user.email,
            title: planMeta.title,
            month,
            year,
            data: planData,
            is_public: false,
            updated_at: new Date().toISOString()
          });
        }
        notify.success('Synced to Cloud Planner');
      } catch (err) {
        console.error('Firebase sync error:', err);
      }
    }

    setPlannerModalOpen(false);
    setSchedulingModule(null);
  };

  // Merge DB subjects with official syllabus subjects for AIDS Sem 3 (2026-27) / Sem 4 / Sem 5
  const displaySubjects = useMemo(() => {
    const officialList =
      branch === 'AIDS' && academicYear === '2026-2027' && semester === 3
        ? AIDS_SEM_3_SUBJECTS_2026
        : branch === 'AIDS' && semester === 4
        ? AIDS_SEM_4_SUBJECTS
        : branch === 'AIDS' && semester === 5
          ? AIDS_SEM_5_SUBJECTS
          : null;

    if (officialList) {
      return officialList.map((officialSub) => {
        const dbSub =
          subjects.find(
            (s) => s.name.trim().toLowerCase() === officialSub.name.trim().toLowerCase(),
          ) || subjects.find((s) => isSubjectMatch(s.name, officialSub.name));
        return {
          id: dbSub ? dbSub.id : officialSub.id,
          name: officialSub.name,
          branch: 'AIDS',
          semester,
          code: officialSub.code,
          type: officialSub.type,
          credits: officialSub.credits,
          modules: officialSub.modules,
        };
      });
    }

    // For other branches/semesters, use DB subjects but attach realistic modules
    return subjects.map((sub) => {
      const modules = getModulesForSubject(sub.name);
      return {
        ...sub,
        code: `SUB-${sub.id.substring(0, 4).toUpperCase()}`,
        type: 'PM',
        credits: 3,
        modules,
      };
    });
  }, [subjects, academicYear, branch, semester]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return displaySubjects;
    const q = searchQuery.toLowerCase();
    return displaySubjects.filter(
      (s) => s.name.toLowerCase().includes(q) || 
             s.code.toLowerCase().includes(q) || 
             isSubjectMatch(s.name, searchQuery)
    );
  }, [displaySubjects, searchQuery]);

  const activeExpandedSubject = useMemo(() => {
    if (!expandedSubject) return null;
    return filtered.some((s) => s.id === expandedSubject) ? expandedSubject : null;
  }, [expandedSubject, filtered]);

  const matchingResourcesMap = useMemo(() => {
    const map = new Map<string, ResourceItemExt[]>();
    if (!activeExpandedSubject) return map;
    const subject = displaySubjects.find((s) => s.id === activeExpandedSubject);
    if (!subject) return map;
    subject.modules.forEach((mod, modIdx) => {
      const key = `${subject.id}_${modIdx}`;
      map.set(
        key,
        computeMatchingResources(mod.title, mod.desc, subject.name, resources),
      );
    });
    return map;
  }, [displaySubjects, resources, activeExpandedSubject]);

  // Calculate Overall Progress
  const totalModules = filtered.reduce((acc, sub) => acc + sub.modules.length, 0);
  const completedModules = useMemo(() => {
    if (filtered.length === 0) return 0;
    return filtered.reduce((acc, sub) => {
      const subDone = sub.modules.reduce((sum, _, idx) => {
        const val = progressMap[`${sub.id}_${idx}`];
        if (val === 'mastered' || val === true) return sum + 1;
        if (val === 'in-progress') return sum + 0.5;
        return sum;
      }, 0);
      return acc + subDone;
    }, 0);
  }, [filtered, progressMap]);

  const overallPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
  const estimatedHoursLeft = Math.max(0, Math.round((totalModules - completedModules) * 3));

  const getSubjectIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('artificial intelligence') || n.includes('expert systems') || n.includes('ai')) return Brain;
    if (n.includes('data engineering') || n.includes('database') || n.includes('dbms')) return Database;
    if (n.includes('algorithm') || n.includes('daa') || n.includes('data structure') || n.includes('dsa')) return Cpu;
    if (n.includes('project') || n.includes('pbl') || n.includes('lab')) return Activity;
    if (n.includes('german')) return Compass;
    return BookOpen;
  };

  if (catalogLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto page-gutter py-8 min-h-[90vh] relative">
      <div className="mb-8 border-b border-border pb-6 relative z-10 space-y-3">
        <PageHeader
          title="Syllabus"
          description={`${filtered.length} course${filtered.length !== 1 ? 's' : ''} · units link into the Resource Vault`}
          actions={
            syllabusUrl ? (
              <Button
                variant="primary"
                size="md"
                className="shrink-0 rounded-lg"
                onClick={() => window.open(syllabusUrl, "_blank", "noopener,noreferrer")}
              >
                <FileText className="w-4 h-4" />
                Open PDF
              </Button>
            ) : undefined
          }
        />
        <AcademicBreadcrumb
          branch={branch}
          semester={semester}
          crumbs={[{ label: "Syllabus" }]}
        />
        <NotesDisclaimer compact className="max-w-xl" />
      </div>

      {catalogError && (
        <ErrorState
          className="mb-8"
          title="Couldn’t load course materials"
          description={`${catalogError}. Vault links may be missing until this succeeds.`}
          onRetry={retryCatalog}
        />
      )}

      {/* Progress */}
      {filtered.length > 0 && (
        <Card padding="md" className="mb-10 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Semester progress</h3>
              <div className="flex flex-wrap gap-4 text-xs text-muted font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-foreground" />
                  {completedModules} / {totalModules} units done
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-muted-hover" />
                  ~{estimatedHoursLeft} Hours Study Left
                </span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-80 flex flex-col gap-2 shrink-0">
            <div className="flex justify-between items-end text-xs font-bold">
              <span className="text-muted-foreground">Overall Completion</span>
              <span className="text-primary text-sm font-extrabold">{overallPercentage}%</span>
            </div>
            <div className="h-4 w-full bg-surface border border-border p-0.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${overallPercentage}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Subject Cards List */}
      <div className="flex flex-col gap-px bg-border/60 rounded-xl overflow-hidden border border-border/70 shadow-sm relative z-10">
          {filtered.map((subject) => {
            const isExpanded = activeExpandedSubject === subject.id;
            const subCompleted = subject.modules.reduce((sum, _, idx) => {
              const val = progressMap[`${subject.id}_${idx}`];
              if (val === 'mastered' || val === true) return sum + 1;
              if (val === 'in-progress') return sum + 0.5;
              return sum;
            }, 0);
            const masteredCount = subject.modules.filter((_, idx) => progressMap[`${subject.id}_${idx}`] === 'mastered' || progressMap[`${subject.id}_${idx}`] === true).length;
            const inProgressCount = subject.modules.filter((_, idx) => progressMap[`${subject.id}_${idx}`] === 'in-progress').length;
            const subPercentage = subject.modules.length > 0 ? Math.round((subCompleted / subject.modules.length) * 100) : 0;
            const SubjectIcon = getSubjectIcon(subject.name);

            return (
              <div
                key={subject.code || subject.id}
                className={`bg-card transition-colors overflow-hidden ${
                  isExpanded 
                    ? 'shadow-md relative z-20 border-y border-border-strong' 
                    : 'hover:bg-surface/30'
                }`}
              >
                {/* Subject Header */}
                <div
                  onClick={() => setExpandedSubject(isExpanded ? null : subject.id)}
                  className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 flex items-center justify-center shrink-0 border rounded-xl transition-all duration-300 ${
                      isExpanded 
                        ? 'bg-foreground border-foreground text-background shadow-md scale-105' 
                        : 'bg-surface/80 border-border text-foreground group-hover:border-foreground/45 group-hover:bg-card'
                    }`}>
                      <SubjectIcon className="w-6 h-6" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-foreground tracking-tight truncate max-w-[280px] sm:max-w-md">
                          {subject.name}
                        </h2>
                        <Badge uppercase className="font-mono font-bold shrink-0">
                          {subject.code}
                        </Badge>
                        <Badge variant="outline" className="font-bold shrink-0">
                          {subject.type} · {subject.credits} CR
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-semibold">
                        Syllabus Tracker Core Modules
                      </p>
                    </div>
                  </div>

                  {/* Progress Indicator & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-4 sm:pt-0 border-border/40 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-foreground block leading-tight">{subPercentage}%</span>
                        <span className="text-[10px] text-muted-foreground font-bold">{masteredCount} Mastered {inProgressCount > 0 && `· ${inProgressCount} IP`}</span>
                      </div>
                      
                      {/* Apple Watch Style SVG Progress Ring */}
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r="15.915"
                            className="stroke-surface"
                            strokeWidth="4"
                            fill="none"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.915"
                            className="stroke-foreground transition-all duration-500"
                            strokeWidth="4"
                            strokeDasharray={`${subPercentage}, 100`}
                            strokeLinecap="round"
                            fill="none"
                            style={{
                              filter: subPercentage > 0 ? 'drop-shadow(0 0 3px rgb(var(--foreground) / 0.2))' : 'none'
                            }}
                          />
                        </svg>
                        {subPercentage === 100 && (
                          <Check className="w-4 h-4 text-foreground absolute stroke-[3]" />
                        )}
                      </div>
                    </div>

                    <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-all shrink-0">
                      {isExpanded ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
                    </div>
                  </div>
                </div>

                {/* Collapsible Subject Modules */}
                {isExpanded && (
                    <div className="border-t border-border/50 bg-surface/10">
                      <div className="p-6 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          <BookOpen className="w-3.5 h-3.5 text-foreground" />
                          Curriculum Units
                        </div>

                        <div className="space-y-3.5">
                          {subject.modules.map((mod, modIdx) => {
                            const currentVal = progressMap[`${subject.id}_${modIdx}`];
                            const isDone = currentVal === 'mastered' || currentVal === true;
                            const isInProgress = currentVal === 'in-progress';
                            const matches = matchingResourcesMap.get(`${subject.id}_${modIdx}`) ?? [];

                            return (
                              <Card
                                key={modIdx}
                                padding="md"
                                className={`flex flex-col rounded-2xl transition-all duration-300 relative overflow-hidden ${
                                  isDone
                                    ? 'bg-foreground/[0.02] dark:bg-foreground/[0.03] border-foreground/35 text-foreground shadow-xs'
                                    : isInProgress
                                    ? 'bg-foreground/[0.01] dark:bg-foreground/[0.015] border-foreground/60 text-foreground shadow-3xs'
                                    : 'bg-card border-border/85 hover:border-foreground/35 hover:scale-[1.005] hover:shadow-sm text-foreground'
                                }`}
                              >
                                <div className="flex items-start gap-4 z-10">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = isDone
                                        ? 'not-started'
                                        : isInProgress
                                        ? 'mastered'
                                        : 'in-progress';
                                      updateModuleStatus(subject.id, modIdx, next);
                                    }}
                                    className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 hover:scale-110 active:scale-90 transition-all duration-200 ${
                                      isDone 
                                        ? 'bg-foreground border-foreground text-background shadow-sm' 
                                        : isInProgress
                                        ? 'bg-foreground/75 border-foreground/75 text-background shadow-xs'
                                        : 'bg-surface border-border hover:border-foreground/40 text-transparent'
                                    }`}
                                  >
                                    {isDone ? (
                                      <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                                    ) : isInProgress ? (
                                      <span className="text-[11px] font-black leading-none">-</span>
                                    ) : null}
                                  </button>

                                  <div className="min-w-0 flex-1 space-y-1">
                                    <h5 className={`text-base font-bold leading-snug tracking-tight ${isDone ? 'line-through opacity-75' : ''}`}>
                                      {mod.title}
                                    </h5>
                                    <p className={`text-xs leading-relaxed font-medium ${isDone ? 'text-muted-foreground opacity-70' : 'text-muted-foreground'}`}>
                                      {mod.desc}
                                    </p>
                                  </div>
                                </div>

                                {/* Study resources pill cards */}
                                {matches.length > 0 && (
                                  <div 
                                    className="mt-4 flex flex-wrap gap-2.5 items-center pl-10 z-10" 
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="text-[9px] text-muted-foreground font-extrabold uppercase tracking-widest">Vault Files:</span>
                                    {matches.map(file => {
                                      const unit = parseUnitKey(file.title) || parseUnitKey(mod.title);
                                      const folder = unit ? unitFolderId(unit.num, subject.name) : null;
                                      const href = buildResourcesHref({
                                        academicYear,
                                        branch,
                                        semester,
                                        subject: subject.name,
                                        folder,
                                        view: file.id,
                                      });
                                      return (
                                        <AppLink
                                          key={file.id}
                                          href={href}
                                          className="inline-flex items-center gap-1.5 text-xs font-bold bg-surface/50 hover:bg-surface hover:border-foreground/30 border border-border/80 px-3 py-1.5 rounded-xl text-foreground transition-all shadow-3xs hover:-translate-y-0.5"
                                        >
                                          <FileText className="w-3.5 h-3.5 text-foreground/70" />
                                          <span className="truncate max-w-[150px]" title={file.title}>
                                            {cleanResourceTitle(file.title)}
                                          </span>
                                        </AppLink>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Status Selector Pills & Actions */}
                                <div 
                                  className="mt-4 pt-3.5 border-t border-border/40 flex flex-wrap items-center justify-between gap-3 pl-10 z-10" 
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <Segmented
                                      size="sm"
                                      value={
                                        isDone
                                          ? 'mastered'
                                          : isInProgress
                                          ? 'in-progress'
                                          : 'not-started'
                                      }
                                      onChange={(s) =>
                                        updateModuleStatus(
                                          subject.id,
                                          modIdx,
                                          s as 'not-started' | 'in-progress' | 'mastered',
                                        )
                                      }
                                      options={[
                                        { value: 'not-started', label: 'To Do' },
                                        { value: 'in-progress', label: 'In Progress' },
                                        { value: 'mastered', label: 'Mastered' },
                                      ]}
                                      aria-label="Module progress"
                                    />
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => {
                                        setSchedulingModule({ subjectName: subject.name, moduleTitle: mod.title });
                                        setScheduleTitle(`Study: ${subject.name} - ${mod.title}`);
                                        setPlannerModalOpen(true);
                                      }}
                                      className="rounded-xl shadow-3xs hover:-translate-y-0.5"
                                      title="Schedule in Planner"
                                    >
                                      <Calendar className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
                                      Schedule
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="rounded-xl shadow-3xs hover:-translate-y-0.5"
                                      onClick={() => {
                                        window.location.href = `/ask?tab=chat&prompt=${encodeURIComponent(`Create a detailed study guide explaining this syllabus topic: "${subject.name} - ${mod.title}". Focus on: ${mod.desc}`)}`;
                                      }}
                                    >
                                      <Brain className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
                                      Guide
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="rounded-xl shadow-3xs hover:-translate-y-0.5"
                                      onClick={() => {
                                        window.location.href = `/ask?tab=flashcards&topic=${encodeURIComponent(`${subject.name} - ${mod.title}`)}&auto=true`;
                                      }}
                                    >
                                      <Layers className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
                                      Cards
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="rounded-xl shadow-3xs hover:-translate-y-0.5"
                                      onClick={() => {
                                        window.location.href = `/ask?tab=quiz&topic=${encodeURIComponent(`${subject.name} - ${mod.title}`)}&auto=true`;
                                      }}
                                    >
                                      <HelpCircle className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
                                      Quiz
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            );
                          })}
                        </div>

                        {/* Subject Card Footer */}
                        <div className="pt-4 flex items-center justify-between border-t border-border/40 mt-6 pl-1 gap-3 flex-wrap">
                          <span className="text-xs text-muted-foreground italic font-medium">Click any unit block to log completion progress.</span>
                          <div className="flex items-center gap-3">
                            <AppLink
                              href={buildResourcesHref({
                                academicYear,
                                branch,
                                semester,
                                subject: subject.name,
                              })}
                              className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:underline hover:gap-1.5 transition-all"
                            >
                              Open vault
                              <ChevronRight className="w-4 h-4" />
                            </AppLink>
                            <a
                              href={`/ask?topic=${encodeURIComponent(subject.name)}`}
                              className="inline-flex items-center gap-1 text-xs font-bold text-foreground hover:underline hover:gap-1.5 transition-all"
                            >
                              Query AI on Subject
                              <ChevronRight className="w-4.5 h-4.5 text-foreground" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            );
          })}
      </div>

      {/* Empty states */}
      {filtered.length === 0 && (
        <Card
          padding="lg"
          className="flex flex-col items-center justify-center p-20 text-center border-2 border-dashed my-12 relative z-10"
        >
          <BookMarked className="w-12 h-12 text-muted-foreground/30 mb-4 animate-bounce" />
          <p className="text-lg font-bold text-foreground mb-1">No matching courses found</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            {searchQuery 
              ? `We couldn't find any subjects matching "${searchQuery}". Please check your search query.`
              : `No curriculum subjects are populated for ${branch} Semester ${semester} in the database.`}
          </p>
        </Card>
      )}

      {/* Global Navigation Link to Resource Vault */}
      {filtered.length > 0 && (
        <div className="mt-14 flex justify-center relative z-10">
          <Button
            variant="secondary"
            size="md"
            className="rounded-2xl shadow-sm hover:scale-[1.01] group"
            onClick={() => {
              window.location.href = buildResourcesHref({ academicYear, branch, semester });
            }}
          >
            <Layers className="w-4 h-4 text-primary" />
            Open Study Resource Vault
            <ArrowRight className="w-4 h-4 text-muted group-hover:text-foreground group-hover:translate-x-1.5 transition-all" />
          </Button>
        </div>
      )}

      <Modal
        open={plannerModalOpen && !!schedulingModule}
        onClose={() => {
          setPlannerModalOpen(false);
          setSchedulingModule(null);
        }}
        title={
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Schedule Study Session
          </span>
        }
        size="sm"
      >
        <div className="space-y-4 -mt-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Task Title</label>
            <Input
              inputSize="sm"
              type="text"
              value={scheduleTitle}
              onChange={(e) => setScheduleTitle(e.target.value)}
              className="rounded-xl text-xs font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Date</label>
              <Input
                inputSize="sm"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="rounded-xl text-xs font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Category</label>
              <Select
                size="sm"
                value={scheduleCategory}
                options={[
                  { value: "Revision", label: "Revision" },
                  { value: "Exam Prep", label: "Exam Prep" },
                  { value: "Assignment", label: "Assignment" },
                  { value: "Project", label: "Project" },
                  { value: "General", label: "General" },
                ]}
                onChange={setScheduleCategory}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setPlannerModalOpen(false);
                setSchedulingModule(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleScheduleTask}>
              Schedule Task
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
