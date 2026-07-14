import { describe, expect, it } from "vitest";

import { htmlToText } from "./htmlToText.ts";

describe("htmlToText", () => {
  it("keeps readable block structure and decodes entities once", () => {
    expect(
      htmlToText(
        "<p>Hello&nbsp;&amp; welcome</p><div>Line &amp;lt;two&amp;gt;</div>",
      ),
    ).toBe("Hello & welcome\nLine &lt;two&gt;");
  });

  it("drops script, style and comment contents", () => {
    expect(
      htmlToText(
        "before<style>p{display:none}</style><!-- hidden --><script>alert(1)</script><br>after",
      ),
    ).toBe("before\nafter");
  });

  it("handles greater-than characters inside quoted attributes", () => {
    expect(htmlToText('<div title="a > b">Safe</div>')).toBe("Safe");
  });

  it("preserves angle brackets that are plain text rather than tags", () => {
    expect(htmlToText("2 < 3 and 5 > 4")).toBe("2 < 3 and 5 > 4");
  });

  it("rejects invalid numeric entities without double-decoding", () => {
    expect(htmlToText("&#x110000; &#0; &amp;lt;script&amp;gt;")).toBe(
      "&#x110000; &#0; &lt;script&gt;",
    );
  });
});
