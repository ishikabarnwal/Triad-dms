/**
 * Search snippets arrive as HTML from the API: every character escaped except its own <mark> tags.
 * These helpers turn one into plain text parts for React to render, without ever using innerHTML.
 */

// The entities Python's html.escape produces, plus &apos; for safety.
const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/**
 * Turn HTML entities back into characters, leaving every other character exactly as it was.
 * Done by hand rather than with DOMParser, which drops whitespace at the start of the text.
 */
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code.startsWith("#")) {
      const hex = code[1] === "x" || code[1] === "X";
      const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });
}

/**
 * Split a snippet into [{ marked, text }] parts. Spaces between plain and highlighted parts are
 * kept exactly. Any markup other than <mark> stays as visible text, so nothing in it can run.
 */
export function snippetParts(html) {
  return html
    .split(/(<mark>[\s\S]*?<\/mark>)/g)
    .filter((part) => part !== "")
    .map((part) => {
      const marked = part.startsWith("<mark>") && part.endsWith("</mark>");
      return { marked, text: decodeEntities(marked ? part.slice("<mark>".length, -"</mark>".length) : part) };
    });
}
