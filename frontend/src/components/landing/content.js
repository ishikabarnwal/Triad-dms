// Landing page copy. The demo report below is fictional sample content, not a real record.

export const CLASSIFICATION = {
  full: "RESTRICTED // TRIAD DMS // AUTHORISED PERSONNEL ONLY",
  short: "RESTRICTED // TRIAD DMS",
};

// Sections listed in the navigation, in page order. Each id is the section's anchor.
export const NAV_SECTIONS = [];

export const HERO = {
  label: "FILE TDMS-00 / DOCUMENT MANAGEMENT / REV 2026.11",
  headline: ["Need to know,", "on every file."],
  subheadline:
    "Triad DMS keeps each division's documents inside that division. Scanned pages become searchable text, other divisions can see a file exists, and no one opens it until the owning division says yes.",
};

/*
 * The redacted demo sheet. Each paragraph is a list of parts: plain strings are always visible,
 * { r: "..." } parts are covered by redaction bars until the clearance lens passes over them.
 */
export const SHEET = {
  reference: "TDMS-DOC-0412",
  marking: "RESTRICTED",
  division: "DIVISION A",
  unit: "FLEET SUPPORT CELL",
  date: "14 NOV 2026",
  title: "Fleet maintenance report",
  period: "Q3 / FY 2026/27 / 4 PAGES",
  fields: [
    ["Type", "Maintenance"],
    ["Division", "A"],
    ["OCR", "4 pages"],
    ["Filed by", "Engineering"],
  ],
  sections: [
    {
      heading: "1. Summary",
      parts: [
        "Steering gear on ",
        { r: "Hull 02" },
        " lost ",
        { r: "14 percent" },
        " of rated hydraulic pressure during the ",
        { r: "11 November" },
        " sea trial. The pump was replaced at ",
        { r: "Berth 6" },
        " and passed a second trial on ",
        { r: "13 November" },
        ".",
      ],
    },
    {
      heading: "2. Findings",
      parts: [
        "Port shaft bearing runs ",
        { r: "4.6 degrees" },
        " above baseline at cruising speed. Injector spares are down to ",
        { r: "two units" },
        " against a minimum of ",
        { r: "six" },
        ".",
      ],
    },
    {
      heading: "3. Action",
      parts: [
        "Bearing inspection at the ",
        { r: "December dock period" },
        ". Spares indent raised under ",
        { r: "LG/2611/0457" },
        ".",
      ],
    },
  ],
  signatory: { name: "Cdr. R. Nair", role: "Officer in charge, engineering" },
};
