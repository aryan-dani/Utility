import { create } from "zustand";
import type { AcademicYear, Branch, Semester } from "@/lib/academic/scope";
import {
  DEFAULT_ACADEMIC_YEAR,
  DEFAULT_BRANCH,
  DEFAULT_SEMESTER,
  writeStoredWorkspace,
} from "@/lib/workspace";

export type { AcademicYear, Branch, Semester };

interface AcademicState {
  academicYear: AcademicYear;
  branch: Branch;
  semester: Semester;
  searchQuery: string;
  aiSearchQuery: string;
  isCommandPaletteOpen: boolean;
  setAcademicYear: (year: AcademicYear) => void;
  setBranch: (branch: Branch) => void;
  setSemester: (sem: Semester) => void;
  setWorkspace: (
    academicYear: AcademicYear,
    branch: Branch,
    semester: Semester,
  ) => void;
  resetWorkspace: () => void;
  setSearchQuery: (query: string) => void;
  setAiSearchQuery: (query: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useAcademicStore = create<AcademicState>((set) => ({
  academicYear: DEFAULT_ACADEMIC_YEAR,
  branch: DEFAULT_BRANCH,
  semester: DEFAULT_SEMESTER,
  searchQuery: "",
  aiSearchQuery: "",
  isCommandPaletteOpen: false,
  setAcademicYear: (academicYear) =>
    set((state) => {
      if (state.academicYear === academicYear) return state;
      writeStoredWorkspace(academicYear, state.branch, state.semester);
      return { academicYear, searchQuery: "", aiSearchQuery: "" };
    }),
  setBranch: (branch) =>
    set((state) => {
      if (state.branch === branch) return state;
      writeStoredWorkspace(state.academicYear, branch, state.semester);
      return { branch, searchQuery: "", aiSearchQuery: "" };
    }),
  setSemester: (semester) =>
    set((state) => {
      if (state.semester === semester) return state;
      writeStoredWorkspace(state.academicYear, state.branch, semester);
      return { semester, searchQuery: "", aiSearchQuery: "" };
    }),
  setWorkspace: (academicYear, branch, semester) => {
    set((state) => {
      if (
        state.academicYear === academicYear &&
        state.branch === branch &&
        state.semester === semester
      ) {
        return state;
      }
      writeStoredWorkspace(academicYear, branch, semester);
      return { academicYear, branch, semester, searchQuery: "", aiSearchQuery: "" };
    });
  },
  resetWorkspace: () =>
    set({
      academicYear: DEFAULT_ACADEMIC_YEAR,
      branch: DEFAULT_BRANCH,
      semester: DEFAULT_SEMESTER,
      searchQuery: "",
      aiSearchQuery: "",
    }),
  setSearchQuery: (searchQuery) =>
    set((state) => ({
      searchQuery,
      aiSearchQuery: searchQuery.trim() === "" ? "" : state.aiSearchQuery,
    })),
  setAiSearchQuery: (aiSearchQuery) => set({ aiSearchQuery }),
  setCommandPaletteOpen: (isCommandPaletteOpen) =>
    set({ isCommandPaletteOpen }),
}));
