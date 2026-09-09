import { describe, expect, it } from "vitest";
import { isSubjectMatch } from "@/lib/subjectMatcher";

describe("isSubjectMatch", () => {
  it("matches exact names", () => {
    expect(isSubjectMatch("Machine Learning", "Machine Learning")).toBe(true);
  });

  it("matches DAA abbreviation", () => {
    expect(
      isSubjectMatch("DAA", "Design and Analysis of Algorithms"),
    ).toBe(true);
  });

  it("does not match Graph Machine Learning to Machine Learning", () => {
    expect(
      isSubjectMatch("Graph Machine Learning", "Machine Learning"),
    ).toBe(false);
  });

  it("rejects lab vs non-lab mismatch", () => {
    expect(isSubjectMatch("Operating Systems Lab", "Operating Systems")).toBe(
      false,
    );
    expect(
      isSubjectMatch("Machine Learning", "Machine Learning Laboratory"),
    ).toBe(false);
  });

  it("matches CNM to Calculus and Numerical Methods", () => {
    expect(isSubjectMatch("CNM", "Calculus and Numerical Methods")).toBe(true);
    expect(isSubjectMatch("CNM", "Computer Networks")).toBe(false);
  });

  it("matches OS to Operating System Concepts", () => {
    expect(isSubjectMatch("OS", "Operating System Concepts")).toBe(true);
  });

  it("returns false for empty strings", () => {
    expect(isSubjectMatch("", "OS")).toBe(false);
    expect(isSubjectMatch("OS", "")).toBe(false);
  });
});
