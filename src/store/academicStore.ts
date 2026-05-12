import { create } from "zustand";

export type Branch = "AIDS" | "CSE";
export type Semester = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface AcademicState {
  branch: Branch;
  semester: Semester;
  setBranch: (branch: Branch) => void;
  setSemester: (sem: Semester) => void;
}

export const useAcademicStore = create<AcademicState>((set) => ({
  branch: "AIDS",
  semester: 4,
  setBranch: (branch) => set({ branch }),
  setSemester: (semester) => set({ semester }),
}));
