import { describe, expect, it } from "vitest";
import { can, P } from "./permissions";

describe("permissions mirror the backend roles", () => {
  it("owners can do everything, admins all but billing, delete and the activity log", () => {
    expect(can("owner", P.workspaceDelete)).toBe(true);
    expect(can("admin", P.channelsManage)).toBe(true);
    expect(can("admin", P.billingManage)).toBe(false);
    expect(can("owner", P.auditRead)).toBe(true);
    expect(can("admin", P.auditRead)).toBe(false);
  });

  it("agents reply but do not manage; viewers only read", () => {
    expect(can("agent", P.inboxReply)).toBe(true);
    expect(can("agent", P.membersManage)).toBe(false);
    expect(can("viewer", P.inboxRead)).toBe(true);
    expect(can("viewer", P.inboxReply)).toBe(false);
    expect(can("nobody", P.inboxRead)).toBe(false);
  });
});
