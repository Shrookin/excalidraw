import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import "./NodeReadmePanel.scss";

type NodeReadmePanelProps = {
  element: NonDeletedExcalidrawElement;
  label: string;
  onChange: (markdown: string) => void;
  onClose: () => void;
};

const getReadme = (element: NonDeletedExcalidrawElement) =>
  typeof element.customData?.nodeReadme === "string"
    ? element.customData.nodeReadme
    : "";

export const NodeReadmePanel = ({
  element,
  label,
  onChange,
  onClose,
}: NodeReadmePanelProps) => {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const markdown = getReadme(element);
  const safeHtml = useMemo(
    () => DOMPurify.sanitize(marked.parse(markdown, { async: false })),
    [markdown],
  );

  useEffect(() => setMode("preview"), [element.id]);

  return (
    <section className="node-readme-panel" aria-label={`README for ${label}`}>
      <header className="node-readme-panel__header">
        <div className="node-readme-panel__title">
          <span className="node-readme-panel__eyebrow">Element README</span>
          <strong title={label}>{label}</strong>
          <code title={element.id}>{element.type}</code>
        </div>
        <button
          type="button"
          className="node-readme-panel__close"
          aria-label="Close element README"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="node-readme-panel__body">
        {mode === "preview" ? (
          markdown.trim() ? (
            <article
              className="node-readme-markdown"
              aria-label="README preview"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          ) : (
            <div className="node-readme-panel__empty">
              <strong>No README yet</strong>
              <p>
                Keep this element’s purpose and details close to the drawing.
              </p>
              <button type="button" onClick={() => setMode("edit")}>
                Write README <span aria-hidden="true">→</span>
              </button>
            </div>
          )
        ) : (
          <textarea
            aria-label={`Markdown README for ${label}`}
            placeholder={`# ${label}\n\nDescribe this element and its role in the drawing...`}
            value={markdown}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        )}
      </div>

      <footer className="node-readme-panel__footer">
        <div
          className="node-readme-panel__tabs"
          role="tablist"
          aria-label="README mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            className={mode === "preview" ? "is-active" : ""}
            onClick={() => setMode("preview")}
          >
            Preview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "edit"}
            className={mode === "edit" ? "is-active" : ""}
            onClick={() => setMode("edit")}
          >
            Edit
          </button>
        </div>
        <span className="node-readme-panel__saved">Saved with drawing</span>
      </footer>
    </section>
  );
};
