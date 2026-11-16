/** Helpers for rendering admin-defined metadata fields without knowing any of them by name. */

/** The field whose options are the divisions (identified by its source, never by its key). */
export const isDivisionField = (field) => field.source === "divisions";

/**
 * Fields shown as table columns: the filterable ones (the admin marks those as the important
 * ones to slice by), minus the division field, which has its own badge.
 */
export const columnFields = (fields) => fields.filter((field) => field.filterable && !isDivisionField(field));

/** HTML input type for a field. */
export function inputType(field) {
  if (field.type === "number") {
    return "number";
  }
  if (field.type === "date") {
    return "date";
  }
  return "text";
}
