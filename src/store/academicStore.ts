import { create } from "zustand";

export type Branch = "AIDS" | "CSE";
export type Semester = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface AcademicState {
  branch: Branch;
  semester: Semester;
  searchQuery: string;
  setBranch: (branch: Branch) => void;
  setSemester: (sem: Semester) => void;
  setSearchQuery: (query: string) => void;
}

export const useAcademicStore = create<AcademicState>((set) => ({
  branch: "AIDS",
  semester: 4,
  searchQuery: "",
  setBranch: (branch) => set({ branch, searchQuery: "" }),
  setSemester: (semester) => set({ semester, searchQuery: "" }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
