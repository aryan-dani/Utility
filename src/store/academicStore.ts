import { create } from "zustand";

export type Branch = "AIDS" | "CSE";
export type Semester = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface AcademicState {
  branch: Branch;
  semester: Semester;
  searchQuery: string;
  aiSearchQuery: string;
  isCommandPaletteOpen: boolean;
  setBranch: (branch: Branch) => void;
  setSemester: (sem: Semester) => void;
  setSearchQuery: (query: string) => void;
  setAiSearchQuery: (query: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useAcademicStore = create<AcademicState>((set) => ({
  branch: "AIDS",
  semester: 4,
  searchQuery: "",
  aiSearchQuery: "",
  isCommandPaletteOpen: false,
  setBranch: (branch) => set({ branch, searchQuery: "", aiSearchQuery: "" }),
  setSemester: (semester) =>
    set({ semester, searchQuery: "", aiSearchQuery: "" }),
  setSearchQuery: (searchQuery) =>
    set((state) => ({
      searchQuery,
      aiSearchQuery: searchQuery.trim() === "" ? "" : state.aiSearchQuery,
    })),
  setAiSearchQuery: (aiSearchQuery) => set({ aiSearchQuery }),
  setCommandPaletteOpen: (isCommandPaletteOpen) =>
    set({ isCommandPaletteOpen }),
}));
