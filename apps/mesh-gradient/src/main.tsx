import * as React from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";

import { ToolApp, type AppState } from "@tools/runtime";

import { appSchema } from "./schema";
import { MeshGradientCanvas } from "./app/mesh-gradient/MeshGradientCanvas";
import { exportMeshGradientPng, exportMeshGradientVideo } from "./app/mesh-gradient/export";
import "./styles.css";

function handleAction(value: string, state: AppState): void {
  if (value === "export-png") {
    toast.promise(exportMeshGradientPng(state), {
      loading: "Exporting image…",
      success: "Image exported",
      error: "Image export failed",
    });
    return;
  }

  if (value === "export-video") {
    const toastId = toast.loading("Rendering video… 0%");
    exportMeshGradientVideo(state, (progress) => {
      toast.loading(`Rendering video… ${Math.round(progress * 100)}%`, { id: toastId });
    })
      .then(() => toast.success("Video exported", { id: toastId }))
      .catch(() => toast.error("Video export failed", { id: toastId }));
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ToolApp
      onAction={handleAction}
      renderer={<MeshGradientCanvas />}
      schema={appSchema}
      storageKey="mesh-gradient:state:v1"
    />
  </React.StrictMode>,
);
