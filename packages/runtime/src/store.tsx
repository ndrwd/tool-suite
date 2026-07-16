import * as React from "react";

import { ASPECT_PRESETS } from "./canvas";
import { buildDefaultValues, type AppSchema } from "./schema";
import type { AppState, Theme } from "./types";

const HISTORY_LIMIT = 100;

type PersistedShape = {
  values?: Record<string, unknown>;
  durationSeconds?: number;
  theme?: Theme;
  canvas?: { size?: { width: number; height: number }; aspect?: string };
};

function readPersisted(storageKey: string): PersistedShape {
  if (typeof localStorage === "undefined") {
    return {};
  }

  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as PersistedShape) : {};
  } catch {
    return {};
  }
}

function createInitialState(schema: AppSchema, storageKey: string): AppState {
  const persisted = readPersisted(storageKey);
  const defaults = buildDefaultValues(schema);

  return {
    values: { ...defaults, ...(persisted.values ?? {}) },
    canvas: {
      size: { ...(persisted.canvas?.size ?? schema.canvas.size) },
      renderScale: schema.canvas.renderScale,
      aspect: persisted.canvas?.aspect ?? schema.canvas.aspect,
    },
    timeline: {
      currentTimeSeconds: 0,
      durationSeconds: persisted.durationSeconds ?? schema.timeline.durationSeconds,
      playing: true,
    },
    // Theme toggle UI was removed; the tool runs dark-only.
    theme: "dark",
  };
}

type StoreContextValue = {
  state: AppState;
  setValue: (target: string, value: unknown) => void;
  setDuration: (seconds: number) => void;
  setPlaying: (playing: boolean) => void;
  seek: (seconds: number) => void;
  setCanvasSize: (width: number, height: number) => void;
  setAspect: (aspect: string) => void;
  toggleTheme: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const StoreContext = React.createContext<StoreContextValue | null>(null);

export function StoreProvider({
  schema,
  storageKey,
  children,
}: {
  schema: AppSchema;
  storageKey: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const [state, setState] = React.useState<AppState>(() => createInitialState(schema, storageKey));

  // Undo/redo stacks hold snapshots of `values` only — the editable product state.
  const undoStack = React.useRef<Array<Record<string, unknown>>>([]);
  const redoStack = React.useRef<Array<Record<string, unknown>>>([]);
  const [historyVersion, setHistoryVersion] = React.useState(0);

  // Live clock: advance timeline while playing so the drift loop animates.
  React.useEffect(() => {
    let raf = 0;
    let previous = 0;

    const tick = (timestamp: number): void => {
      raf = requestAnimationFrame(tick);
      const dt = previous === 0 ? 0 : (timestamp - previous) / 1000;
      previous = timestamp;

      setState((current) => {
        if (!current.timeline.playing) {
          return current;
        }

        return {
          ...current,
          timeline: {
            ...current.timeline,
            currentTimeSeconds: current.timeline.currentTimeSeconds + dt,
          },
        };
      });
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Reflect theme onto <html> and persist a slim snapshot.
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", state.theme === "dark");
      document.documentElement.classList.toggle("light", state.theme === "light");
    }

    if (typeof localStorage !== "undefined") {
      try {
        const payload: PersistedShape = {
          values: state.values,
          durationSeconds: state.timeline.durationSeconds,
          theme: state.theme,
          canvas: { size: state.canvas.size, aspect: state.canvas.aspect },
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // Ignore quota/serialization failures — persistence is best-effort.
      }
    }
  }, [state.values, state.timeline.durationSeconds, state.theme, state.canvas.size, state.canvas.aspect]);

  const commitValues = React.useCallback((nextValues: Record<string, unknown>) => {
    setState((current) => {
      undoStack.current.push(current.values);
      if (undoStack.current.length > HISTORY_LIMIT) {
        undoStack.current.shift();
      }
      redoStack.current = [];
      return { ...current, values: nextValues };
    });
    setHistoryVersion((version) => version + 1);
  }, []);

  const setValue = React.useCallback(
    (target: string, value: unknown) => {
      setState((current) => {
        undoStack.current.push(current.values);
        if (undoStack.current.length > HISTORY_LIMIT) {
          undoStack.current.shift();
        }
        redoStack.current = [];
        return { ...current, values: { ...current.values, [target]: value } };
      });
      setHistoryVersion((version) => version + 1);
    },
    [],
  );

  const undo = React.useCallback(() => {
    setState((current) => {
      const previous = undoStack.current.pop();
      if (!previous) {
        return current;
      }
      redoStack.current.push(current.values);
      return { ...current, values: previous };
    });
    setHistoryVersion((version) => version + 1);
  }, []);

  const redo = React.useCallback(() => {
    setState((current) => {
      const next = redoStack.current.pop();
      if (!next) {
        return current;
      }
      undoStack.current.push(current.values);
      return { ...current, values: next };
    });
    setHistoryVersion((version) => version + 1);
  }, []);

  const setDuration = React.useCallback((seconds: number) => {
    setState((current) => ({
      ...current,
      timeline: { ...current.timeline, durationSeconds: Math.max(1, seconds) },
    }));
  }, []);

  const setPlaying = React.useCallback((playing: boolean) => {
    setState((current) => ({ ...current, timeline: { ...current.timeline, playing } }));
  }, []);

  const seek = React.useCallback((seconds: number) => {
    setState((current) => ({
      ...current,
      timeline: { ...current.timeline, currentTimeSeconds: seconds },
    }));
  }, []);

  const setCanvasSize = React.useCallback((width: number, height: number) => {
    setState((current) => ({
      ...current,
      canvas: {
        ...current.canvas,
        size: {
          width: Math.max(1, Math.round(width) || current.canvas.size.width),
          height: Math.max(1, Math.round(height) || current.canvas.size.height),
        },
        aspect: "custom",
      },
    }));
  }, []);

  const setAspect = React.useCallback((aspect: string) => {
    setState((current) => {
      const preset = ASPECT_PRESETS[aspect];
      return {
        ...current,
        canvas: {
          ...current.canvas,
          aspect,
          size: preset ? { ...preset } : current.canvas.size,
        },
      };
    });
  }, []);

  const toggleTheme = React.useCallback(() => {
    setState((current) => ({ ...current, theme: current.theme === "dark" ? "light" : "dark" }));
  }, []);

  // Reference so linters see historyVersion driving canUndo/canRedo recompute.
  void commitValues;
  void historyVersion;

  const value = React.useMemo<StoreContextValue>(
    () => ({
      state,
      setValue,
      setDuration,
      setPlaying,
      seek,
      setCanvasSize,
      setAspect,
      toggleTheme,
      undo,
      redo,
      canUndo: undoStack.current.length > 0,
      canRedo: redoStack.current.length > 0,
    }),
    [state, setValue, setDuration, setPlaying, seek, setCanvasSize, setAspect, toggleTheme, undo, redo, historyVersion],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = React.useContext(StoreContext);

  if (!context) {
    throw new Error("useStore must be used within a StoreProvider.");
  }

  return context;
}
