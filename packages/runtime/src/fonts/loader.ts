import { buildGoogleStylesheetHref, type FontCatalogEntry } from "./catalog";

/**
 * On-demand Google Fonts loader. Injects the stylesheet once per family, then
 * resolves after the browser reports the face is ready so the canvas rasterizes
 * the real glyph rather than a fallback.
 */

const injectedHrefs = new Set<string>();
const pendingHrefs = new Map<string, Promise<void>>();

function ensureStylesheet(href: string): Promise<void> {
  if (typeof document === "undefined" || injectedHrefs.has(href)) {
    return Promise.resolve();
  }

  const existing = pendingHrefs.get(href);
  if (existing) {
    return existing;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.crossOrigin = "anonymous";

  const pending = new Promise<void>((resolve) => {
    link.addEventListener("load", () => {
      injectedHrefs.add(href);
      pendingHrefs.delete(href);
      resolve();
    }, { once: true });
    link.addEventListener("error", () => {
      pendingHrefs.delete(href);
      resolve();
    }, { once: true });
  });

  pendingHrefs.set(href, pending);
  document.head.appendChild(link);

  return pending;
}

export async function ensureFontLoaded(entry: FontCatalogEntry | null | undefined): Promise<void> {
  if (!entry) {
    return;
  }

  await ensureStylesheet(buildGoogleStylesheetHref(entry));

  if (typeof document !== "undefined" && "fonts" in document) {
    await document.fonts.load(`400 16px "${entry.family}"`).catch(() => undefined);
    await document.fonts.load(`700 16px "${entry.family}"`).catch(() => undefined);
  }
}
