import { useEffect, useState } from "react";
import { getDivisions } from "../api/auth";

// Divisions rarely change; one request is shared by every chip on the page.
let cached = null;

function loadDivisions() {
  if (!cached) {
    cached = getDivisions()
      .then((response) => response.data.divisions)
      .catch(() => {
        cached = null;
        return [];
      });
  }
  return cached;
}

/** Map of division name -> short code (e.g. "Division A" -> "DIV-A"). */
export default function useDivisionCodes() {
  const [codes, setCodes] = useState({});
  useEffect(() => {
    let active = true;
    loadDivisions().then((divisions) => {
      if (active) {
        setCodes(Object.fromEntries(divisions.map((d) => [d.name, d.code || d.name])));
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return codes;
}

/** Division names in the API's order, for filter menus. */
export function useDivisionNames() {
  const [names, setNames] = useState([]);
  useEffect(() => {
    let active = true;
    loadDivisions().then((divisions) => active && setNames(divisions.map((d) => d.name)));
    return () => {
      active = false;
    };
  }, []);
  return names;
}
