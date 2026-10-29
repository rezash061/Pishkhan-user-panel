import type { FlowEdge, FlowGraph, FlowIssue, FlowNode, FlowNodeType } from "@/lib/api/types";

/** Exits of each node type (backend `FlowHandles.For`). An exit without an edge ends the run there. */
export function handlesFor(type: string): string[] {
  switch (type) {
    case "question":
      return ["next", "invalid"];
    case "condition":
      return ["true", "false"];
    case "ai":
    case "end":
      return [];
    default:
      return ["next"];
  }
}

export const VARIABLE_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
export const MAX_NODES = 200;
export const MIN_DELAY_SECONDS = 60;
export const MAX_DELAY_SECONDS = 30 * 24 * 3600;

export function starterGraph(welcome: string): FlowGraph {
  return {
    start: "start",
    nodes: [
      { id: "start", type: "message", message: { text: welcome } },
      { id: "end", type: "end" },
    ],
    edges: [{ from: "start", to: "end", handle: "next" }],
  };
}

/** Next free id like `message_2` (ids are ≤ 40 chars and unique within the flow). */
export function newNodeId(graph: FlowGraph, type: string): string {
  const taken = new Set(graph.nodes.map((n) => n.id));
  for (let i = 1; ; i++) {
    const id = `${type}_${i}`;
    if (!taken.has(id)) return id;
  }
}

export function nodeDefaults(type: FlowNodeType, id: string): FlowNode {
  switch (type) {
    case "message":
      return { id, type, message: { text: "" } };
    case "question":
      return { id, type, message: { text: "" }, answerType: "text", variable: "answer", maxRetries: 2 };
    case "condition":
      return { id, type, match: "all", conditions: [{ subject: "tag", op: "has", value: "" }] };
    case "delay":
      return { id, type, delaySeconds: 3600 };
    case "action":
      return { id, type, actions: [{ kind: "add_tag", tag: "" }] };
    case "storefront":
      return { id, type, cardSetId: null };
    case "ai":
      return { id, type, goal: "" };
    default:
      return { id, type };
  }
}

export function edgeFrom(graph: FlowGraph, from: string, handle: string): FlowEdge | undefined {
  return graph.edges.find((e) => e.from === from && (e.handle ?? "next") === handle);
}

/** Points one exit at a node (or nowhere). Keeps one edge per exit, as the validator requires. */
export function connect(graph: FlowGraph, from: string, handle: string, to: string | null): FlowGraph {
  const edges = graph.edges.filter((e) => !(e.from === from && (e.handle ?? "next") === handle));
  return { ...graph, edges: to ? [...edges, { from, to, handle }] : edges };
}

/** Adds a node; when `from` is given, that exit now leads to it and the new node continues where the exit used to go. */
export function addNode(graph: FlowGraph, type: FlowNodeType, from?: { node: string; handle: string }): { graph: FlowGraph; id: string } {
  const id = newNodeId(graph, type);
  let next: FlowGraph = { ...graph, nodes: [...graph.nodes, nodeDefaults(type, id)] };
  if (from) {
    const previous = edgeFrom(graph, from.node, from.handle)?.to ?? null;
    next = connect(next, from.node, from.handle, id);
    const firstExit = handlesFor(type)[0];
    if (previous && firstExit) next = connect(next, id, firstExit, previous);
  }
  return { graph: next, id };
}

export function updateNode(graph: FlowGraph, id: string, patch: Partial<FlowNode>): FlowGraph {
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
}

/** Changing a node's type keeps its id and edges that still fit the new type's exits. */
export function changeType(graph: FlowGraph, id: string, type: FlowNodeType): FlowGraph {
  const exits = handlesFor(type);
  return {
    ...graph,
    nodes: graph.nodes.map((n) => (n.id === id ? nodeDefaults(type, id) : n)),
    edges: graph.edges.filter((e) => e.from !== id || exits.includes(e.handle ?? "next")),
  };
}

/** Removes a node and every edge touching it. The start node cannot be removed. */
export function removeNode(graph: FlowGraph, id: string): FlowGraph {
  if (id === graph.start) return graph;
  return { ...graph, nodes: graph.nodes.filter((n) => n.id !== id), edges: graph.edges.filter((e) => e.from !== id && e.to !== id) };
}

/** Nodes in reading order: breadth-first from the start, exits in handle order; unreachable nodes come last. */
export function readingOrder(graph: FlowGraph): { ordered: FlowNode[]; unreachable: FlowNode[] } {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const ordered: FlowNode[] = [];
  const queue = byId.has(graph.start) ? [graph.start] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (!node) continue;
    ordered.push(node);
    for (const h of handlesFor(node.type)) {
      const to = edgeFrom(graph, id, h)?.to;
      if (to && !seen.has(to)) queue.push(to);
    }
  }
  return { ordered, unreachable: graph.nodes.filter((n) => !seen.has(n.id)) };
}

export function issuesByNode(issues: FlowIssue[]): Map<string | null, string[]> {
  const out = new Map<string | null, string[]>();
  for (const i of issues) out.set(i.nodeId ?? null, [...(out.get(i.nodeId ?? null) ?? []), i.code]);
  return out;
}

/** Delay as the largest whole unit («۲ ساعت»), for display and the editor. */
export function splitDelay(seconds: number): { amount: number; unit: "minutes" | "hours" | "days" } {
  if (seconds % 86400 === 0) return { amount: seconds / 86400, unit: "days" };
  if (seconds % 3600 === 0) return { amount: seconds / 3600, unit: "hours" };
  return { amount: Math.round(seconds / 60), unit: "minutes" };
}

export const unitSeconds = { minutes: 60, hours: 3600, days: 86400 } as const;
