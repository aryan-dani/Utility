import { describe, expect, it } from "vitest";
import { voteTransition } from "./qa.js";

describe("voteTransition", () => {
  it("adds a new upvote", () => {
    expect(voteTransition(null, 1)).toEqual({ set: 1, up: 1, down: 0 });
  });

  it("adds a new downvote on an answer", () => {
    expect(voteTransition(null, -1)).toEqual({ set: -1, up: 0, down: 1 });
  });

  it("removes the vote when the same direction is pressed again", () => {
    expect(voteTransition(1, 1)).toEqual({ set: null, up: -1, down: 0 });
    expect(voteTransition(-1, -1)).toEqual({ set: null, up: 0, down: -1 });
  });

  it("flips an upvote into a downvote and moves the counters", () => {
    expect(voteTransition(1, -1)).toEqual({ set: -1, up: -1, down: 1 });
  });

  it("flips a downvote into an upvote and moves the counters", () => {
    expect(voteTransition(-1, 1)).toEqual({ set: 1, up: 1, down: -1 });
  });
});
