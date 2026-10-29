import { describe, expect, it } from "vitest";
import { addNode, changeType, connect, readingOrder, removeNode, splitDelay, starterGraph } from "./model";

describe("flow graph helpers", () => {
  it("inserts a node on an exit and keeps the rest of the path", () => {
    const { graph, id } = addNode(starterGraph("سلام"), "question", { node: "start", handle: "next" });
    expect(id).toBe("question_1");
    expect(graph.edges).toContainEqual({ from: "start", to: "question_1", handle: "next" });
    expect(graph.edges).toContainEqual({ from: "question_1", to: "end", handle: "next" });
    expect(readingOrder(graph).ordered.map((n) => n.id)).toEqual(["start", "question_1", "end"]);
  });

  it("keeps one edge per exit", () => {
    const g = connect(connect(starterGraph(""), "start", "next", "end"), "start", "next", null);
    expect(g.edges).toHaveLength(0);
    expect(readingOrder(g).unreachable.map((n) => n.id)).toEqual(["end"]);
  });

  it("drops exits a new type does not have, and never removes the start", () => {
    let { graph } = addNode(starterGraph(""), "condition", { node: "start", handle: "next" });
    graph = connect(graph, "condition_1", "true", "end");
    graph = changeType(graph, "condition_1", "message");
    expect(graph.edges.filter((e) => e.from === "condition_1")).toEqual([]);
    expect(removeNode(graph, "start")).toBe(graph);
    expect(removeNode(graph, "end").edges.some((e) => e.to === "end")).toBe(false);
  });

  it("shows delays in the largest whole unit", () => {
    expect(splitDelay(7200)).toEqual({ amount: 2, unit: "hours" });
    expect(splitDelay(2 * 86400)).toEqual({ amount: 2, unit: "days" });
    expect(splitDelay(90 * 60)).toEqual({ amount: 90, unit: "minutes" });
  });
});
