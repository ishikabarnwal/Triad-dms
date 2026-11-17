// "jpeg" is how the API names the type, but people know the files as JPG.
const TYPE_LABELS = { jpeg: "JPG" };

/** ["PDF", "PNG", "JPG"] -> "PDF, PNG and JPG" (or "or" as the joining word). */
export function listInWords(items, joiner = "and") {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} ${joiner} ${items.at(-1)}` : items.join("");
}

/** ["pdf", "jpeg"] -> ["PDF", "JPG"] */
export function fileTypeLabels(types) {
  return types.map((type) => TYPE_LABELS[type] ?? type.toUpperCase());
}
