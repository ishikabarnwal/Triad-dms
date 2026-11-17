// "jpeg" is how the API names the type, but people know the files as JPG.
const TYPE_LABELS = { jpeg: "JPG" };

/** ["pdf", "jpeg"] -> ["PDF", "JPG"] */
export function fileTypeLabels(types) {
  return types.map((type) => TYPE_LABELS[type] ?? type.toUpperCase());
}
