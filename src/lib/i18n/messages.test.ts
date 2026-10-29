import { createTranslator, IntlErrorCode } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/fa.json";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [`${prefix}${k}`] : leaves(v, `${prefix}${k}.`)));
}

describe("fa.json", () => {
  it("every message is valid ICU (template {{variables}} must be quoted)", () => {
    const invalid: string[] = [];
    const t = createTranslator({
      locale: "fa",
      messages,
      onError: (error) => {
        if (error.code === IntlErrorCode.INVALID_MESSAGE) invalid.push(error.message);
      },
    });
    for (const key of leaves(messages as Tree)) t(key as never, {} as never);
    expect(invalid).toEqual([]);
  });

  it("keeps {{variables}} literal in default automation texts", () => {
    const t = createTranslator({ locale: "fa", messages, namespace: "flows" });
    expect(t("starterText")).toContain("{{contact.first_name|عزیز}}");
  });
});
