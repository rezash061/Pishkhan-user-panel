import { describe, expect, it } from "vitest";
import { cleanRule, isComplete, newCondition, ruleIsComplete, valueKind, withField, withOp } from "./rule";

describe("segment rules", () => {
  it("starts each field with its first operator and a usable default", () => {
    expect(newCondition("last_seen")).toEqual({ field: "last_seen", op: "within_days", key: null, value: 30 });
    expect(newCondition("has_phone")).toEqual({ field: "has_phone", op: "is", key: null, value: true });
    expect(isComplete(newCondition("tag"))).toBe(false);
  });

  it("keeps a valid operator and resets the value when its kind changes", () => {
    const c = { field: "name", op: "contains", key: null, value: "علی" };
    expect(withField(c, "username")).toEqual({ field: "username", op: "contains", key: null, value: "علی" });
    expect(withField(c, "created")).toEqual({ field: "created", op: "within_days", key: null, value: 30 });
    expect(valueKind(withOp(c, "exists"))).toBe("none");
    expect(withOp(c, "exists").value).toBeNull();
  });

  it("needs a lowercase key for custom fields and 1 to 3650 days", () => {
    expect(isComplete({ field: "field", op: "eq", key: "City", value: "تهران" })).toBe(false);
    expect(isComplete({ field: "field", op: "eq", key: "city", value: "تهران" })).toBe(true);
    expect(isComplete({ field: "last_seen", op: "within_days", key: null, value: 0 })).toBe(false);
    expect(ruleIsComplete({ match: "all", conditions: [] })).toBe(false);
  });

  it("sends no value for exists and no key outside custom fields", () => {
    expect(
      cleanRule({
        match: "any",
        conditions: [
          { field: "tag", op: "has", key: "x", value: " vip " },
          { field: "field", op: "exists", key: "city", value: "y" },
        ],
      }),
    ).toEqual({
      match: "any",
      conditions: [
        { field: "tag", op: "has", key: null, value: "vip" },
        { field: "field", op: "exists", key: "city", value: null },
      ],
    });
  });

  it("consent conditions take a known channel", () => {
    const c = newCondition("consent");
    expect(c).toEqual({ field: "consent", op: "granted", key: null, value: "sms" });
    expect(isComplete({ ...c, value: "bale" })).toBe(true);
    expect(isComplete({ ...c, value: "email" })).toBe(false);
  });
});
