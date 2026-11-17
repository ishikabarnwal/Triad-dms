import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeEntities, snippetParts } from "./snippet.js";

const text = (parts) => parts.map((part) => part.text).join("");

describe("snippetParts", () => {
  it("keeps the spaces on both sides of a highlighted word", () => {
    const parts = snippetParts("The codeword84e119e1 <mark>convoy</mark> leaves the northern depot");

    assert.deepEqual(parts, [
      { marked: false, text: "The codeword84e119e1 " },
      { marked: true, text: "convoy" },
      { marked: false, text: " leaves the northern depot" },
    ]);
    assert.equal(text(parts), "The codeword84e119e1 convoy leaves the northern depot");
  });

  it("keeps spaces between two highlights and around ellipses", () => {
    const parts = snippetParts("… <mark>Radar</mark> and <mark>radar</mark> logs …");

    assert.equal(text(parts), "… Radar and radar logs …");
    assert.deepEqual(
      parts.filter((part) => part.marked).map((part) => part.text),
      ["Radar", "radar"],
    );
  });

  it("handles a snippet that starts or ends with a highlight", () => {
    assert.deepEqual(snippetParts("<mark>Fleet</mark> report"), [
      { marked: true, text: "Fleet" },
      { marked: false, text: " report" },
    ]);
    assert.deepEqual(snippetParts("the <mark>fleet</mark>"), [
      { marked: false, text: "the " },
      { marked: true, text: "fleet" },
    ]);
  });

  it("decodes escaped characters without running any markup", () => {
    const parts = snippetParts("a &lt;script&gt;alert(1)&lt;/script&gt; &amp; <mark>R&amp;D</mark> &#x27;q&#x27; &quot;x&quot;");

    assert.equal(text(parts), "a <script>alert(1)</script> & R&D 'q' \"x\"");
    assert.equal(parts.find((part) => part.marked).text, "R&D");
  });

  it("returns plain text when nothing is highlighted", () => {
    assert.deepEqual(snippetParts("  leading and trailing  "), [{ marked: false, text: "  leading and trailing  " }]);
  });
});

describe("decodeEntities", () => {
  it("leaves unknown entities and lone ampersands alone", () => {
    assert.equal(decodeEntities("fish & chips &bogus; &#0;"), "fish & chips &bogus; &#0;");
  });
});
