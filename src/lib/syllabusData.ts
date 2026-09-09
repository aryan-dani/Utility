export type SyllabusModule = { title: string; desc: string };

export type SyllabusOfficialSubject = {
  id: string;
  code: string;
  name: string;
  type: string;
  credits: number;
  modules: SyllabusModule[];
};

export const AIDS_SEM_3_SUBJECTS_2026: SyllabusOfficialSubject[] = [
  {
    id: 'aid-sem3-ds',
    code: 'DS',
    name: 'Data Structures',
    type: 'PM',
    credits: 3,
    modules: [
      {
        title: 'Unit I: Introduction to Data Structures',
        desc: 'Data, ADTs, linear/non-linear and static/dynamic structures; algorithm analysis, asymptotic notations, and complexity of programming constructs.',
      },
      {
        title: 'Unit II: Linear Data Structures',
        desc: 'Arrays as ADTs, row/column-major storage, multidimensional arrays, polynomial representation and operations, sparse matrices, transpose, and time–space trade-offs.',
      },
      {
        title: 'Unit III: Searching and Sorting',
        desc: 'Linear/sentinel/binary search; internal vs external sorting; bubble, insertion, selection, quick, merge, shell, radix, and bucket sort with complexity comparison.',
      },
      {
        title: 'Unit IV: Stacks and Queues',
        desc: 'Stack ADT, expression conversion/evaluation, recursion; queue ADT, circular queue, deque types, and applications such as job scheduling.',
      },
      {
        title: 'Unit V: Linked Lists',
        desc: 'Singly, circular, doubly, and doubly-circular lists; polynomial operations; generalized linked lists (GLL); garbage-collection case study.',
      },
    ],
  },
  {
    id: 'aid20210',
    code: 'AID20210',
    name: 'Data Structures - I Laboratory',
    type: 'PR',
    credits: 1,
    modules: [
      {
        title: 'Arrays, Matrices & Sparse Operations',
        desc: 'Matrix arithmetic and sparse-matrix realization with transpose and fast transpose in C.',
      },
      {
        title: 'Structures, Searching & Sorting',
        desc: 'Student database with array of structures; linear/binary search and insertion/selection/shell sort.',
      },
      {
        title: 'Linked Lists & Polynomials',
        desc: 'Singly linked list enrollment system; circular linked list polynomial create/display/addition.',
      },
      {
        title: 'Stacks, Queues & Applications',
        desc: 'Stack ADT for expression conversion/evaluation; circular queue printer-job simulation.',
      },
    ],
  },
  {
    id: 'aid-sem3-oop',
    code: 'OOP',
    name: 'Object Oriented Programming Laboratory',
    type: 'PR',
    credits: 1,
    modules: [
      {
        title: 'OOP Foundations & C++ Basics',
        desc: 'Procedural vs OOP; encapsulation, abstraction, inheritance, polymorphism; C++ types, control flow, functions, and arrays.',
      },
      {
        title: 'Classes, Objects & Encapsulation',
        desc: 'Constructors/destructors, member access, friend class/function, and class design for real entities (e.g. bank account, shapes).',
      },
      {
        title: 'Inheritance, Polymorphism & Exceptions',
        desc: 'Inheritance types, virtual functions, overloading, exception handling, abstract classes, and file I/O with objects.',
      },
      {
        title: 'Templates, STL & Mini Project',
        desc: 'Function/class templates, STL vectors and iterators, and a group mini-project applying OOP principles.',
      },
    ],
  },
  {
    id: 'aid-sem3-dbms',
    code: 'DBMS',
    name: 'Database Management Systems',
    type: 'PM',
    credits: 3,
    modules: [
      {
        title: 'Unit I: Introduction to DBMS and Data Modelling',
        desc: 'DBMS vs file systems, architectures, data abstraction/independence, DDL/DML, ER/EER modelling, keys, and reduction of ER diagrams to tables.',
      },
      {
        title: 'Unit II: Relational Design and Normalisation',
        desc: 'Relational model, integrity constraints, Codd’s rules, 1NF–BCNF, functional dependency, decomposition, and query-cost overview.',
      },
      {
        title: 'Unit III: Relational Algebra and SQL',
        desc: 'Relational algebra/calculus, SQL DDL/DCL/DML, views, indexes, joins, set operations, aggregation, and nested queries.',
      },
      {
        title: 'Unit IV: PL/SQL',
        desc: 'PL/SQL blocks, procedures and functions, cursors, triggers, exception handling, and DBMS applications.',
      },
      {
        title: 'Unit V: Transactions and Recovery',
        desc: 'ACID properties, serializability, lock-based concurrency, deadlocks, log-based recovery, and shadow paging.',
      },
    ],
  },
  {
    id: 'aid20050',
    code: 'AID20050',
    name: 'Database Management Systems Laboratory',
    type: 'PR',
    credits: 1,
    modules: [
      {
        title: 'ER Modelling & DDL/DCL',
        desc: 'ER case study to schemas; SQL DDL (create/alter/drop/…) and DCL (grant/revoke).',
      },
      {
        title: 'DML, Queries & Joins',
        desc: 'Insert/update/delete, select clauses, functions, grouping, set operations, views, TCL, and join types.',
      },
      {
        title: 'PL/SQL Programming',
        desc: 'Procedures, functions, triggers, and cursors for real-world applications.',
      },
      {
        title: 'End-to-End Database Build',
        desc: 'Develop a database system from scratch for a real-world challenge (external practical with separate pass criteria).',
      },
    ],
  },
  {
    id: 'aid20220',
    code: 'AID20220',
    name: 'Operating System Concepts',
    type: 'PM',
    credits: 2,
    modules: [
      {
        title: 'Unit I: Introduction to Operating Systems',
        desc: 'OS types and services; process/memory/storage/I/O/protection; Linux commands, file system, shell, and shell programming case study.',
      },
      {
        title: 'Unit II: Process Management',
        desc: 'Processes, PCB, context switching, threads/multithreading, and CPU scheduling (FCFS, SJF, RR) with performance metrics.',
      },
      {
        title: 'Unit III: Concurrency and Deadlocks',
        desc: 'Critical sections, semaphores, monitors, message passing, classical IPC problems, and deadlock prevention/avoidance/detection/recovery.',
      },
      {
        title: 'Unit IV: Memory and I/O Management',
        desc: 'Partitioning, paging, segmentation, virtual memory, page replacement, file systems, allocation methods, and disk scheduling.',
      },
    ],
  },
  {
    id: 'aid20230',
    code: 'AID20230',
    name: 'Operating System Concepts Laboratory',
    type: 'PR',
    credits: 1,
    modules: [
      {
        title: 'Linux & Shell Scripting',
        desc: 'Linux commands and shell scripts including arithmetic operations.',
      },
      {
        title: 'Process Control & Scheduling',
        desc: 'fork, orphan/zombie processes, and FCFS/SRTF scheduling simulation.',
      },
      {
        title: 'IPC & Synchronization',
        desc: 'Pipes/shared memory; Banker’s algorithm; readers–writers or producer–consumer with semaphores.',
      },
      {
        title: 'Memory Management Labs',
        desc: 'Simulate FIFO and LRU page-replacement algorithms.',
      },
    ],
  },
  {
    id: 'aid-sem3-cnm',
    code: 'CNM',
    name: 'Calculus and Numerical Methods',
    type: 'PM',
    credits: 3,
    modules: [
      {
        title: 'Unit I: Linear Differential Equations',
        desc: 'Higher-order LDEs with constant coefficients; complementary function and particular integral; auxiliary equation and solution cases.',
      },
      {
        title: 'Unit II: Laplace Transforms',
        desc: 'Laplace and inverse Laplace transforms, properties, and applications to differential equations.',
      },
      {
        title: 'Unit III: Fourier Series & Transforms',
        desc: 'Fourier series, half-range expansions, and Fourier transform fundamentals.',
      },
      {
        title: 'Unit IV: Numerical Methods',
        desc: 'Root finding, interpolation, numerical differentiation/integration, and numerical solution of ODEs.',
      },
    ],
  },
];

export const AIDS_SEM_4_SUBJECTS: SyllabusOfficialSubject[] = [
  {
    id: 'aid30010',
    code: 'AID30010',
    name: 'Data Engineering Techniques',
    type: 'PM',
    credits: 2,
    modules: [
      { title: 'Unit I: Data Engineering Basics & ETL', desc: 'Data Cleaning, Data Integration, ETL processes, Data Reduction, and Sampling techniques.' },
      { title: 'Unit II: Data Warehousing & OLAP', desc: 'Data Warehouse architecture, OLAP operations, Data Lakes, and Metadata management.' },
      { title: 'Unit III: Association Rule Mining', desc: 'Frequent itemsets, Apriori Algorithm, FP Growth, and industry Case Study analysis.' },
      { title: 'Unit IV: Supervised & Unsupervised Learning', desc: 'Decision Trees, Bayesian Classification, Clustering, and k-Means algorithm.' }
    ]
  },
  {
    id: 'aid30020',
    code: 'AID30020',
    name: 'Data Engineering Techniques Lab',
    type: 'PJ',
    credits: 1,
    modules: [
      { title: 'Data Ingestion & ETL Pipelines', desc: 'Hands-on ETL implementation using PowerBI and Python scripting.' },
      { title: 'OLAP & Warehousing Analytics', desc: 'Designing data warehouse schemas and performing multi-dimensional OLAP queries.' },
      { title: 'Advanced Visualization & BI', desc: 'Dashboard creation and interactive data storytelling with Tableau and PowerBI.' },
      { title: 'Big Data & Cloud Tooling', desc: 'Introduction to Databricks for large-scale data engineering and analytics workflows.' }
    ]
  },
  {
    id: 'aid30030',
    code: 'AID30030',
    name: 'Artificial Intelligence & Expert Systems',
    type: 'PM',
    credits: 2,
    modules: [
      { title: 'Introduction & Intelligent Agents', desc: 'Introduction to AI, foundational definitions, history, and Intelligent Agents architecture.' },
      { title: 'Search Techniques', desc: 'Uninformed search (BFS, DFS), Heuristic Search, and A* Algorithm problem solving.' },
      { title: 'Knowledge Representation', desc: 'Predicate Logic, Bayesian Networks, Neural Networks, and Fuzzy Logic systems.' },
      { title: 'Expert Systems & Applications', desc: 'Architecture of Expert Systems, rule-based reasoning, and practical decision frameworks.' }
    ]
  },
  {
    id: 'aid30040',
    code: 'AID30040',
    name: 'Artificial Intelligence & Expert Systems Lab',
    type: 'PJ',
    credits: 1,
    modules: [
      { title: 'Search Algorithms Implementation', desc: 'Coding BFS, DFS, and A* Search for complex graph and pathfinding problem solving.' },
      { title: 'Constraint Satisfaction & Games', desc: 'Implementing solutions for the 8 Puzzle Problem, N-Queens, and Sudoku Solver.' },
      { title: 'Adversarial Search', desc: 'Minimax Algorithm implementation for optimal two-player game AI strategy.' },
      { title: 'Mini Project', desc: 'End-to-end Face Recognition Mini Project implementation, training, and evaluation.' }
    ]
  },
  {
    id: 'aid20060',
    code: 'AID20060',
    name: 'Design & Analysis of Algorithms',
    type: 'PM',
    credits: 3,
    modules: [
      { title: 'Asymptotic Analysis & Divide and Conquer', desc: 'Asymptotic notation, Recurrence Relations, Quick Sort, Merge Sort analysis.' },
      { title: 'Greedy Algorithms & Graph Theory', desc: 'Greedy strategy principles, Prim’s, Kruskal’s, and Dijkstra’s shortest path algorithms.' },
      { title: 'Dynamic Programming', desc: 'Principles of DP, memoization, tabulation, and classic DP problem optimization.' },
      { title: 'Backtracking & Branch and Bound', desc: 'State space trees, N-Queens backtracking, and Knapsack branch & bound optimization.' },
      { title: 'Complexity Theory & Hashing', desc: 'P, NP, NP-Complete, NP-Hard complexity classes, and advanced Hashing Techniques.' }
    ]
  },
  {
    id: 'aid20070',
    code: 'AID20070',
    name: 'Project Based Learning II',
    type: 'PJ',
    credits: 1,
    modules: [
      { title: 'Ideation & Problem Formulation', desc: 'Identifying real-world problem statements, feasibility study, and literature review.' },
      { title: 'System Design & Architecture', desc: 'Architectural blueprinting, technology stack selection, and database schema design.' },
      { title: 'Implementation & Sprint I', desc: 'Core feature development, algorithmic module integration, and initial unit testing.' },
      { title: 'Final Evaluation & Presentation', desc: 'Project deployment, rigorous user testing, technical report writing, and viva voce.' }
    ]
  }
];

export const AIDS_SEM_5_SUBJECTS: SyllabusOfficialSubject[] = [
  {
    id: 'aid30050',
    code: 'AID30050',
    name: 'Data Visualization using Python',
    type: 'PM',
    credits: 2,
    modules: [
      { title: 'Python Programming Basics', desc: 'Variables, lists, dictionaries, CRUD student records, arithmetic programs, temperature conversion, Heron’s formula, swapping, and string initials.' },
      { title: 'Conditionals, Functions & File Handling', desc: 'Grading systems, day conversion, tax slabs, input validation, password strength, AGE/SORT functions, and Python file operations.' },
      { title: 'Visualization with Excel, Matplotlib & Seaborn', desc: 'Effective visualization principles and case studies using Excel, Matplotlib, and Seaborn.' },
      { title: 'Tableau & Power BI Dashboards', desc: 'Tableau connectivity, charts, advanced reports, dashboards, calculations, filters; Power BI connections, data modelling, reports, and charts.' }
    ]
  },
  {
    id: 'aid30060',
    code: 'AID30060',
    name: 'User Interface and User Experience Design',
    type: 'PE',
    credits: 4,
    modules: [
      { title: 'Unit I: User Interface Design Principles', desc: 'UI goals, user-centered design, mental/conceptual models, Shneiderman’s rules, Gestalt principles, UI elements, personas, wireframes, mock-ups, and prototypes.' },
      { title: 'Unit II: Usability Engineering, Evaluation & Testing', desc: 'Usability engineering, Fitts’/Hick’s laws, heuristic evaluation, cognitive walkthroughs, think-aloud/A-B testing, heat maps, UX metrics, and standards.' },
      { title: 'Unit III: User Experience and Design Process', desc: 'UI vs UX, 7 Laws of UX, design thinking, empathy/journey/experience maps, service blueprints, UX and content strategy.' },
      { title: 'Unit IV: Advanced Topics in UI/UX Design', desc: 'Agile UX, data-driven UX, recommendation systems, AI personalization, generative AI, accessibility, and tools like Figma, Adobe XD, and Hotjar.' },
      { title: 'Unit V: Designing UX for Tomorrow', desc: 'Voice/conversational/immersive UX, web and mobile interfaces, IoT, FinTech/Edu/Health/E-commerce UX, wearables, and AR/VR/MR challenges.' }
    ]
  },
  {
    id: 'aid30070',
    code: 'AID30070',
    name: 'Graph Machine Learning',
    type: 'PE',
    credits: 4,
    modules: [
      { title: 'Unit I: Introduction to Graph Machine Learning', desc: 'Graphs with NetworkX, plotting, properties, benchmarks, large graphs, graph embedding problem, and taxonomy of embedding algorithms.' },
      { title: 'Unit II: Unsupervised Graph Learning', desc: 'Unsupervised embedding roadmap, shallow embedding methods, autoencoders, and graph neural networks.' },
      { title: 'Unit III: Supervised Graph Learning', desc: 'Supervised embedding roadmap, feature-based and shallow methods, graph regularization, and graph convolutional neural networks.' },
      { title: 'Unit IV: Problems with ML on Graphs', desc: 'Link prediction, community detection, graph similarity, and graph matching.' },
      { title: 'Unit V: Advanced Applications', desc: 'Social network topology and communities, credit-card transaction graphs, and NLP/text analysis with graphs.' }
    ]
  },
  {
    id: 'aid30080',
    code: 'AID30080',
    name: 'System Software and Compiler Design',
    type: 'PE',
    credits: 4,
    modules: [
      { title: 'Unit I: System Software & Assembler Design', desc: 'Assembler, compiler, interpreter, macro processor, linker, loader, debugger, text editor, and design of a 2-pass assembler.' },
      { title: 'Unit II: Macroprocessor, Loaders & Linkers', desc: 'Macro definition/expansion, 2-pass macroprocessor, loader schemes, direct linking loader, relocation, and static/dynamic link libraries.' },
      { title: 'Unit III: Lexical & Syntax Analysis', desc: 'Compiler phases, LEX token specification/recognition, RDP, predictive/SLR/LR(1)/LALR parsers, error recovery, and LEX/YACC tools.' },
      { title: 'Unit IV: Semantic Analysis & Intermediate Code', desc: 'Syntax-directed translation/definitions, type checking, postfix, parse/syntax trees, three-address code, quadruples, and triples.' },
      { title: 'Unit V: Code Generation & Optimization', desc: 'Code generation issues, basic blocks, flow graphs, and machine-independent/dependent code optimization.' }
    ]
  },
  {
    id: 'aid30090',
    code: 'AID30090',
    name: 'AI Systems and Applications',
    type: 'PE',
    credits: 4,
    modules: [
      { title: 'Unit I: Introduction to AI Systems', desc: 'Definition and scope of AI, history, key components, Narrow/General/Super AI, how AI systems work, problem solving, and ethics.' },
      { title: 'Unit II: AI Fields', desc: 'Machine learning, deep learning, reinforcement learning, NLP, computer vision, and tools/frameworks (TensorFlow, Pandas, NLTK).' },
      { title: 'Unit III: Advanced Technologies', desc: 'Generative AI, transfer learning, LLMs, time series, graph theory, explainable AI, edge AI, ethics, and GAN image-generation case study.' },
      { title: 'Unit IV: AI Applications', desc: 'AI in games, healthcare, robotics, finance, business optimization, marketing, education technology, and smart agriculture.' },
      { title: 'Unit V: Case Studies', desc: 'Deep Blue, AlphaGo, Parkinson’s prediction, Tesla Autopilot, Robinhood fraud detection, Watson, Alexa, Siri, Eliza, and ChatGPT.' }
    ]
  },
  {
    id: 'aid30100',
    code: 'AID30100',
    name: 'Machine Learning',
    type: 'PM',
    credits: 3,
    modules: [
      { title: 'Unit I: Introduction to ML & Data Preparation', desc: 'Supervised/unsupervised/reinforcement learning, encoding, preprocessing, EDA, train-test/cross-validation, feature selection/importance, and PCA.' },
      { title: 'Unit II: Supervised Learning Techniques', desc: 'Decision trees, SVM, nearest neighbour, confusion matrix/F1/ROC, bagging/boosting/AdaBoost/random forests, class imbalance, and SMOTE.' },
      { title: 'Unit III: Unsupervised Learning', desc: 'Hierarchical clustering, K-Medoids, DBSCAN, BIRCH, CURE, clustering quality metrics, vector quantization, and EM algorithm.' },
      { title: 'Unit IV: Advanced ML Models', desc: 'Least-squares regression, regularization, LASSO, HMM with forward-backward/Viterbi, and anomaly/outlier detection.' },
      { title: 'Unit V: Trends in Machine Learning', desc: 'Bayesian belief networks, genetic algorithms, reinforcement learning, active learning, transfer learning, and advanced ML applications.' }
    ]
  },
  {
    id: 'aid30110',
    code: 'AID30110',
    name: 'Machine Learning Lab',
    type: 'PR',
    credits: 1,
    modules: [
      { title: 'Datasets, EDA & Preprocessing', desc: 'Explore dataset resources, perform exploratory data analysis, and implement preprocessing techniques.' },
      { title: 'Supervised Classifiers', desc: 'Implement KNN, Naive Bayes, tree-based classifiers with K-fold validation, and SVM with metric comparison.' },
      { title: 'Clustering & Regression', desc: 'Implement and compare Spectral/DBSCAN clustering; implement regression and evaluate performance.' },
      { title: 'Mini-Project', desc: 'End-to-end mini-project on a suitable machine learning dataset.' }
    ]
  },
  {
    id: 'aid20080',
    code: 'AID20080',
    name: 'Operating Systems',
    type: 'PM',
    credits: 3,
    modules: [
      { title: 'Unit I: Introduction to Operating Systems', desc: 'OS types (batch, multiprogramming, time-sharing, real-time, network, distributed), OS services, Linux commands, and shell programming.' },
      { title: 'Unit II: Process Management', desc: 'Process states, PCB, context switching, threads/multithreading, schedulers, and FCFS/SJF/RR scheduling algorithms.' },
      { title: 'Unit III: Concurrency Control', desc: 'Critical section, semaphores, monitors, message passing, readers-writers/producer-consumer, deadlock prevention/avoidance (Banker’s), detection and recovery.' },
      { title: 'Unit IV: Memory Management', desc: 'Fixed/dynamic partitioning, fragmentation, virtual memory, segmentation, paging, thrashing, and FIFO/LRU/Optimal page replacement.' },
      { title: 'Unit V: I/O and File Management', desc: 'I/O hardware and DMA, file access/types/directories, contiguous/linked/indexed allocation, and disk scheduling (FCFS, SSTF, SCAN, C-SCAN).' }
    ]
  },
  {
    id: 'aid20090',
    code: 'AID20090',
    name: 'Operating Systems Laboratory',
    type: 'PR',
    credits: 1,
    modules: [
      { title: 'Linux Commands & Shell Scripting', desc: 'Linux command practice and shell scripting including arithmetic operations.' },
      { title: 'Process Management', desc: 'fork child processes, orphan/zombie processes, FCFS/SRTF scheduling, and IPC via pipes/shared memory.' },
      { title: 'Process Synchronization', desc: 'Banker’s algorithm for deadlock avoidance; Readers-Writers or Producer-Consumer with semaphores.' },
      { title: 'Memory Management', desc: 'Simulate FIFO and LRU page replacement algorithms.' }
    ]
  },
  {
    id: 'aid30180',
    code: 'AID30180',
    name: 'Software Engineering and Modelling',
    type: 'PM',
    credits: 3,
    modules: [
      { title: 'Unit I: Software Engineering & Requirements', desc: 'SE process, waterfall/prototyping/iterative/RUP/spiral/agile models, software myths, SRS, and functional/non-functional requirements.' },
      { title: 'Unit II: Software Design', desc: 'Abstraction, modularity, cohesion/coupling, SSAD (ER/DFD), OOAD/UML static and dynamic modelling (class, use-case, sequence, state diagrams).' },
      { title: 'Unit III: Software Project Management', desc: 'Project metrics, function points, LOC, make/buy, COCOMO II, PERT/CPM, and risk management.' },
      { title: 'Unit IV: Testing', desc: 'V-model, verification/validation, unit/integration/system/acceptance testing, white/black box, basis path, equivalence partitioning, and test plans.' },
      { title: 'Unit V: Trends in Software Engineering', desc: 'Agile practices and XP, DevOps toolchain and continuous delivery, and SE roles in IoT, data science, cloud, and cybersecurity.' }
    ]
  },
  {
    id: 'aid20110',
    code: 'AID20110',
    name: 'Project Based Learning - III',
    type: 'PR',
    credits: 1,
    modules: [
      { title: 'IoT Platforms & Sensing', desc: 'IoT architecture, Raspberry Pi Pico/ESP8266/Arduino platforms, OS install, and sensor interfacing for data acquisition.' },
      { title: 'Actuation & Protocols', desc: 'Actuator interfacing (motors/relays) and MQTT/CoAP publish-subscribe of sensor data.' },
      { title: 'Cloud, Web & Mobile IoT', desc: 'Cloud storage/analysis (ThingSpeak/Ubidots), IoT web server applications, and mobile monitoring/control of appliances.' },
      { title: 'IoT Mini Project', desc: 'Design and implement a real-life IoT mini project with demo, presentation, and a 15–20 page report.' }
    ]
  },
  {
    id: 'pce10030',
    code: 'PCE10030',
    name: 'Managing Conflicts Peacefully: Tools and Techniques',
    type: 'UC',
    credits: 2,
    modules: [
      { title: 'Unit I: Understanding Conflict', desc: 'Nature, sources, and types of interpersonal and group conflict in personal and professional settings.' },
      { title: 'Unit II: Peaceful Resolution Tools', desc: 'Communication, negotiation, mediation, and dialogue techniques for constructive conflict resolution.' },
      { title: 'Unit III: Conflict Management Techniques', desc: 'Interest-based problem solving, emotional regulation, and collaborative decision-making frameworks.' },
      { title: 'Unit IV: Applications & Practice', desc: 'Case studies and applied practice of peaceful conflict management in academic, workplace, and community contexts.' }
    ]
  }
];

/** Short labels for GPA calculator UI */
const GPA_SHORT_NAMES: Record<string, string> = {
  aid30010: "DET",
  aid30020: "DET Lab",
  aid30030: "AI & ES",
  aid30040: "AI & ES Lab",
  aid20060: "DAA",
  aid20070: "PBL-II",
  aid30050: "DVP",
  aid30060: "UI/UX",
  aid30070: "GML",
  aid30080: "SSCD",
  aid30090: "AISA",
  aid30100: "ML",
  aid30110: "ML Lab",
  aid20080: "OS",
  aid20090: "OS Lab",
  aid30180: "SEM",
  aid20110: "PBL-III",
  pce10030: "Conflict Mgmt",
};

export type GpaSubject = { id: string; name: string; credits: number };

export type GpaBranchData = {
  name: string;
  totalCredits: number;
  semester: number;
  completed: GpaSubject[];
  finals: GpaSubject[];
};

/** Map official syllabus list into GPA calculator sections (labs/UC → completed, theory → finals). */
export function gpaDataFromSyllabus(
  displayName: string,
  semester: number,
  subjects: SyllabusOfficialSubject[],
): GpaBranchData {
  const completed: GpaSubject[] = [];
  const finals: GpaSubject[] = [];

  for (const s of subjects) {
    const item: GpaSubject = {
      id: s.id,
      name: GPA_SHORT_NAMES[s.id] || s.name,
      credits: s.credits,
    };
    if (s.type === "PR" || s.type === "PJ" || s.type === "UC") {
      completed.push(item);
    } else {
      finals.push(item);
    }
  }

  const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
  return { name: displayName, totalCredits, semester, completed, finals };
}

export function getAidsGpaData(semester: number): GpaBranchData | null {
  if (semester === 5) {
    return gpaDataFromSyllabus(
      "AI & Data Science (AIDS), Sem 5",
      5,
      AIDS_SEM_5_SUBJECTS,
    );
  }
  if (semester === 4) {
    return gpaDataFromSyllabus(
      "AI & Data Science (AIDS), Sem 4",
      4,
      AIDS_SEM_4_SUBJECTS,
    );
  }
  if (semester === 3) {
    return gpaDataFromSyllabus(
      "AI & Data Science (AIDS), Sem 3",
      3,
      AIDS_SEM_3_SUBJECTS_2026,
    );
  }
  return null;
}

