import { useMemo, useState } from "react";

import DOMPurify from "dompurify";

import { marked } from "marked";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import "./NodeReadmePanel.scss";

type NodeReadmePanelProps = {
  selectedElement: NonDeletedExcalidrawElement | null;
  element: NonDeletedExcalidrawElement | null;
  label: string;
  open: boolean;
  onToggle: (elementId: string) => void;
  onChange: (markdown: string) => void;
  onClose: () => void;
  onClosed: () => void;
};

const getReadme = (element: NonDeletedExcalidrawElement) =>
  typeof element.customData?.nodeReadme === "string"
    ? element.customData.nodeReadme
    : "";

export const NodeReadmePanel = ({
  selectedElement,
  element,
  label,
  open,
  onToggle,
  onChange,
  onClose,
  onClosed,
}: NodeReadmePanelProps) => {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const markdown = element ? getReadme(element) : "";
  const safeHtml = useMemo(
    () => DOMPurify.sanitize(marked.parse(markdown, { async: false })),
    [markdown],
  );

  if (!selectedElement && !element) {
    return null;
  }

  const panelId = "node-readme-panel";

  return (
    <div className="node-readme-control" data-open={open}>
      <svg className="node-readme-control__filters" aria-hidden="true">
        <defs>
          <filter id="node-readme-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -14"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div className="node-readme-control__goo" aria-hidden="true" />

      {selectedElement && (
        <button
          type="button"
          className="node-readme-trigger"
          aria-label="Toggle element README"
          aria-expanded={open}
          aria-controls={panelId}
          title="Element README"
          onClick={() => onToggle(selectedElement.id)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 3.75h8.5A2.5 2.5 0 0 1 15 6.25v10H6.5A2.5 2.5 0 0 0 4 18.75z" />
            <path d="M4 3.75v12.5a2.5 2.5 0 0 1 2.5-2.5H15M7.5 7.5h4M7.5 10.5h4" />
          </svg>
          <span>README</span>
        </button>
      )}

      <section
        id={panelId}
        className="node-readme-panel"
        aria-label={`README for ${label}`}
        aria-hidden={!open}
        inert={!open}
        onTransitionEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.propertyName === "transform" &&
            !open
          ) {
            onClosed();
          }
        }}
      >
        {element && (
          <>
            <header className="node-readme-panel__header">
              <div className="node-readme-panel__title">
                <span className="node-readme-panel__eyebrow">
                  Element README
                </span>
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
                      Keep this element’s purpose and details close to the
                      drawing.
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
              <span className="node-readme-panel__saved">
                Saved with drawing
              </span>
            </footer>
          </>
        )}
      </section>
    </div>
  );
};
