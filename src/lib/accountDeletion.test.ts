import { describe, expect, it } from "vitest";
import { deleteQueryInChunks } from "@/lib/accountDeletion";

function fakeQuery(batches: Array<Array<{ ref: string }>>) {
  let i = 0;
  return {
    limit: () => ({
      get: async () => {
        const docs = batches[i] ?? [];
        i += 1;
        return {
          empty: docs.length === 0,
          size: docs.length,
          docs,
        };
      },
    }),
  };
}

describe("deleteQueryInChunks", () => {
  it("deletes a short page and stops", async () => {
    const deletes: string[] = [];
    const db = {
      batch: () => ({
        delete: (ref: string) => {
          deletes.push(ref);
        },
        commit: async () => {},
      }),
    };
    const query = fakeQuery([[{ ref: "a" }, { ref: "b" }]]);
    const deleted = await deleteQueryInChunks(db as never, query as never);
    expect(deleted).toBe(2);
    expect(deletes).toEqual(["a", "b"]);
  });
});
