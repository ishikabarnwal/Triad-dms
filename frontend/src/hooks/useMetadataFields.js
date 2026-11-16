import { useCallback, useEffect, useState } from "react";
import { getMetadataFields } from "../api/documents";

// Fields change rarely, so one request is shared by every component until something invalidates it.
let cached = null;

/** Forget the cached fields, e.g. after an admin edits them. */
export function invalidateMetadataFields() {
  cached = null;
}

function loadFields() {
  if (!cached) {
    cached = getMetadataFields()
      .then((response) => response.data.fields)
      .catch((error) => {
        cached = null;
        throw error;
      });
  }
  return cached;
}

/** Active metadata fields in display order: { fields, loading, error, reload }. */
export default function useMetadataFields() {
  const [state, setState] = useState({ fields: [], loading: true, error: null });

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    loadFields()
      .then((fields) => setState({ fields, loading: false, error: null }))
      .catch((error) => setState({ fields: [], loading: false, error }));
  }, []);

  useEffect(load, [load]);

  const reload = useCallback(() => {
    invalidateMetadataFields();
    load();
  }, [load]);

  return { ...state, reload };
}
