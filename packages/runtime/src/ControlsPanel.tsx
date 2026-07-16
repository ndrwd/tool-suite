import * as React from "react";

import type { AppSchema, Control, Section } from "./schema";

import { CollapsibleSection, Panel } from "@tools/ui";
import { ControlRenderer, HeaderSwitch } from "./controls";

function SectionBlock({
  section,
  onAction,
  noBottomBorder,
}: {
  section: Section;
  onAction: (value: string) => void;
  noBottomBorder: boolean;
}): React.JSX.Element {
  const grouped = new Set<string>();
  section.layoutGroups?.forEach((group) => group.controls.forEach((key) => grouped.add(key)));

  const byKey = new Map<string, Control>(section.controls.map((control) => [control.key, control]));
  const headerControl = section.headerControl ? byKey.get(section.headerControl) : undefined;
  const ungrouped = section.controls.filter(
    (control) => !grouped.has(control.key) && control.key !== section.headerControl,
  );

  return (
    <CollapsibleSection
      headerAccessory={
        headerControl && headerControl.type === "switch" ? <HeaderSwitch control={headerControl} /> : undefined
      }
      noBottomBorder={noBottomBorder}
      title={section.title}
    >
      {section.layoutGroups?.map((group, index) => (
        <div
          className="grid gap-2"
          key={index}
          style={{ gridTemplateColumns: `repeat(${group.columns}, minmax(0, 1fr))` }}
        >
          {group.controls.map((key) => {
            const control = byKey.get(key);
            return control ? <ControlRenderer control={control} key={key} onAction={onAction} /> : null;
          })}
        </div>
      ))}
      {ungrouped.map((control) => (
        <ControlRenderer control={control} key={control.key} onAction={onAction} />
      ))}
    </CollapsibleSection>
  );
}

export function ControlsPanel({
  schema,
  onAction,
}: {
  schema: AppSchema;
  onAction: (value: string) => void;
}): React.JSX.Element {
  // The purely-actions section pins to the bottom; the one before it drops its
  // divider so there is a single clean separator above the sticky footer.
  const stickyIndex = schema.sections.findIndex((section) =>
    section.controls.every((control) => control.type === "panelActions"),
  );

  return (
    <Panel title={schema.title}>
      {schema.sections.map((section, index) => {
        // The actions section renders as a plain pinned footer (no collapsible
        // header) so every tool's export area looks identical.
        if (index === stickyIndex) {
          return (
            <div
              className="sticky bottom-0 z-10 border-t border-[var(--border)] bg-[var(--card)] p-4"
              key={section.title}
            >
              {section.controls.map((control) => (
                <ControlRenderer control={control} key={control.key} onAction={onAction} />
              ))}
            </div>
          );
        }
        return (
          <SectionBlock
            key={section.title}
            noBottomBorder={stickyIndex > 0 && index === stickyIndex - 1}
            onAction={onAction}
            section={section}
          />
        );
      })}
    </Panel>
  );
}
