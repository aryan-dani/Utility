import { TreeNode, TreeState } from "@/lib/visualize/tree";
import { AlgorithmStep } from "@/lib/visualize/types";

/** Stable leaf score from node id - safe for SSR and hydration. */
function leafValueFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 20) - 9;
}

function buildTree(
  depth: number,
  isMax: boolean,
  idPrefix: string,
  leafValue: (id: string) => number,
): TreeNode {
  if (depth === 0) {
    return {
      id: idPrefix,
      isMaxNode: isMax,
      value: leafValue(idPrefix),
      children: [],
    };
  }
  return {
    id: idPrefix,
    isMaxNode: isMax,
    value: null,
    children: [
      buildTree(depth - 1, !isMax, `${idPrefix}-L`, leafValue),
      buildTree(depth - 1, !isMax, `${idPrefix}-R`, leafValue),
    ],
  };
}

/** Deterministic demo tree - same output on server and client. */
export function generateDefaultTree(
  depth: number,
  isMax: boolean = true,
  idPrefix: string = "root",
): TreeNode {
  return buildTree(depth, isMax, idPrefix, leafValueFromId);
}

/** Random tree for replay - call only after hydration (e.g. button click). */
export function generateRandomTree(
  depth: number,
  isMax: boolean = true,
  idPrefix: string = "root",
): TreeNode {
  return buildTree(
    depth,
    isMax,
    idPrefix,
    () => Math.floor(Math.random() * 20) - 9,
  );
}

export function generateMinimaxSteps(root: TreeNode): AlgorithmStep<TreeState>[] {
  const steps: AlgorithmStep<TreeState>[] = [];
  let stepCounter = 0;

  const evaluatedNodes: Record<string, number> = {};

  function pushStep(desc: string, currentId: string, line: number) {
    steps.push({
      stepIndex: stepCounter++,
      description: desc,
      highlightedLine: line,
      state: {
        tree: root,
        currentNodeId: currentId,
        evaluatedNodes: { ...evaluatedNodes },
        prunedNodes: [],
        alpha: null,
        beta: null,
      },
      metrics: {
        nodesExplored: Object.keys(evaluatedNodes).length,
        frontierSize: 0,
        pathCost: 0,
        totalSteps: 0,
      },
    });
  }

  function minimax(node: TreeNode): number {
    pushStep(
      `Visiting node ${node.id} (${node.isMaxNode ? "MAX" : "MIN"}).`,
      node.id,
      1,
    );

    if (node.children.length === 0) {
      evaluatedNodes[node.id] = node.value!;
      pushStep(`Leaf node reached. Found terminal value: ${node.value}`, node.id, 2);
      return node.value!;
    }

    if (node.isMaxNode) {
      let maxEval = -Infinity;
      pushStep("Initializing max evaluation to -Infinity.", node.id, 3);

      for (const child of node.children) {
        const evalScore = minimax(child);
        maxEval = Math.max(maxEval, evalScore);
        evaluatedNodes[node.id] = maxEval;
        pushStep(`Current MAX value updated to ${maxEval}.`, node.id, 4);
      }

      pushStep(`MAX node fully evaluated. Best choice is ${maxEval}.`, node.id, 5);
      return maxEval;
    }

    let minEval = Infinity;
    pushStep("Initializing min evaluation to +Infinity.", node.id, 6);

    for (const child of node.children) {
      const evalScore = minimax(child);
      minEval = Math.min(minEval, evalScore);
      evaluatedNodes[node.id] = minEval;
      pushStep(`Current MIN value updated to ${minEval}.`, node.id, 7);
    }

    pushStep(`MIN node fully evaluated. Best choice is ${minEval}.`, node.id, 8);
    return minEval;
  }

  pushStep("Initialized Minimax Algorithm.", root.id, 0);
  minimax(root);
  pushStep(
    `Minimax complete. Optimal game value is ${evaluatedNodes[root.id]}.`,
    root.id,
    9,
  );

  steps.forEach((s) => (s.metrics.totalSteps = steps.length));
  return steps;
}
