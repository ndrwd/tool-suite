/**
 * Curated Google Fonts catalog. A small, hand-picked set across categories —
 * loaded on demand via the loader. This is our own listing, independent of any
 * third-party runtime.
 */

export type FontCategory = "sans-serif" | "serif" | "display" | "monospace" | "handwriting";

export type FontCatalogEntry = {
  id: string;
  family: string;
  category: FontCategory;
  weights: string[];
};

const STANDARD = ["300", "400", "500", "600", "700", "800", "900"];
const BASIC = ["400", "700"];

export const FONT_CATALOG: FontCatalogEntry[] = [
  // Sans-serif
  { id: "inter", family: "Inter", category: "sans-serif", weights: ["100", "200", ...STANDARD] },
  { id: "roboto", family: "Roboto", category: "sans-serif", weights: ["100", "300", "400", "500", "700", "900"] },
  { id: "open-sans", family: "Open Sans", category: "sans-serif", weights: STANDARD },
  { id: "montserrat", family: "Montserrat", category: "sans-serif", weights: ["100", "200", ...STANDARD] },
  { id: "poppins", family: "Poppins", category: "sans-serif", weights: ["100", "200", ...STANDARD] },
  { id: "lato", family: "Lato", category: "sans-serif", weights: ["100", "300", "400", "700", "900"] },
  { id: "work-sans", family: "Work Sans", category: "sans-serif", weights: ["100", "200", ...STANDARD] },
  { id: "dm-sans", family: "DM Sans", category: "sans-serif", weights: STANDARD },
  { id: "manrope", family: "Manrope", category: "sans-serif", weights: ["200", "300", "400", "500", "600", "700", "800"] },
  { id: "nunito", family: "Nunito", category: "sans-serif", weights: ["200", "300", ...STANDARD] },
  { id: "rubik", family: "Rubik", category: "sans-serif", weights: STANDARD },
  { id: "space-grotesk", family: "Space Grotesk", category: "sans-serif", weights: ["300", "400", "500", "600", "700"] },
  { id: "sora", family: "Sora", category: "sans-serif", weights: ["100", "200", ...STANDARD] },
  { id: "figtree", family: "Figtree", category: "sans-serif", weights: ["300", "400", "500", "600", "700", "800", "900"] },
  { id: "outfit", family: "Outfit", category: "sans-serif", weights: ["100", "200", ...STANDARD] },
  { id: "archivo", family: "Archivo", category: "sans-serif", weights: ["100", "200", ...STANDARD] },

  // Serif
  { id: "playfair-display", family: "Playfair Display", category: "serif", weights: ["400", "500", "600", "700", "800", "900"] },
  { id: "merriweather", family: "Merriweather", category: "serif", weights: ["300", "400", "700", "900"] },
  { id: "lora", family: "Lora", category: "serif", weights: ["400", "500", "600", "700"] },
  { id: "pt-serif", family: "PT Serif", category: "serif", weights: BASIC },
  { id: "source-serif-4", family: "Source Serif 4", category: "serif", weights: ["300", "400", "500", "600", "700", "800", "900"] },
  { id: "cormorant-garamond", family: "Cormorant Garamond", category: "serif", weights: ["300", "400", "500", "600", "700"] },
  { id: "eb-garamond", family: "EB Garamond", category: "serif", weights: ["400", "500", "600", "700", "800"] },
  { id: "libre-baskerville", family: "Libre Baskerville", category: "serif", weights: BASIC },

  // Display
  { id: "bebas-neue", family: "Bebas Neue", category: "display", weights: ["400"] },
  { id: "anton", family: "Anton", category: "display", weights: ["400"] },
  { id: "oswald", family: "Oswald", category: "display", weights: ["200", "300", "400", "500", "600", "700"] },
  { id: "righteous", family: "Righteous", category: "display", weights: ["400"] },
  { id: "abril-fatface", family: "Abril Fatface", category: "display", weights: ["400"] },
  { id: "fredoka", family: "Fredoka", category: "display", weights: ["300", "400", "500", "600", "700"] },
  { id: "alfa-slab-one", family: "Alfa Slab One", category: "display", weights: ["400"] },

  // Monospace
  { id: "jetbrains-mono", family: "JetBrains Mono", category: "monospace", weights: ["100", "200", "300", "400", "500", "600", "700", "800"] },
  { id: "fira-code", family: "Fira Code", category: "monospace", weights: ["300", "400", "500", "600", "700"] },
  { id: "space-mono", family: "Space Mono", category: "monospace", weights: BASIC },
  { id: "ibm-plex-mono", family: "IBM Plex Mono", category: "monospace", weights: ["100", "200", "300", "400", "500", "600", "700"] },
  { id: "roboto-mono", family: "Roboto Mono", category: "monospace", weights: ["100", "200", "300", "400", "500", "600", "700"] },

  // Handwriting / script
  { id: "caveat", family: "Caveat", category: "handwriting", weights: ["400", "500", "600", "700"] },
  { id: "dancing-script", family: "Dancing Script", category: "handwriting", weights: ["400", "500", "600", "700"] },
  { id: "pacifico", family: "Pacifico", category: "handwriting", weights: ["400"] },
];

const fontById = new Map(FONT_CATALOG.map((entry) => [entry.id, entry]));

export function getFontById(fontId: string | null | undefined): FontCatalogEntry | null {
  if (!fontId) {
    return null;
  }

  return fontById.get(fontId) ?? null;
}

const FILTER_LABELS: Record<FontCategory, string> = {
  "sans-serif": "Sans",
  serif: "Serif",
  display: "Display",
  monospace: "Mono",
  handwriting: "Script",
};

export const FONT_FILTER_OPTIONS: Array<{ label: string; value: "all" | FontCategory }> = [
  { label: "All", value: "all" },
  { label: FILTER_LABELS["sans-serif"], value: "sans-serif" },
  { label: FILTER_LABELS.serif, value: "serif" },
  { label: FILTER_LABELS.display, value: "display" },
  { label: FILTER_LABELS.monospace, value: "monospace" },
  { label: FILTER_LABELS.handwriting, value: "handwriting" },
];

/** Google Fonts CSS2 stylesheet URL for one family, covering its weights. */
export function buildGoogleStylesheetHref(entry: FontCatalogEntry): string {
  const family = entry.family.trim().replace(/\s+/g, "+");
  const weightAxis = Array.from(new Set(entry.weights)).join(";");

  return `https://fonts.googleapis.com/css2?family=${family}:wght@${weightAxis}&display=swap`;
}
