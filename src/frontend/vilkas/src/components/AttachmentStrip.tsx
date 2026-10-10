// The files attached to a report or an answer, as a strip of thumbnails.

import { CloseIcon } from "./icons";

function kindOf(file: File): string {
  if (file.type.startsWith("video/")) return "Vaizdo įrašas";
  if (file.type.startsWith("audio/")) return "Garso įrašas";
  return "Failas";
}

/** The attached files as a scrolling strip of thumbnails. */
export function AttachmentStrip({ files, previewFor, onRemove }: {
  files: File[];
  previewFor: (file: File) => string | undefined;
  onRemove: (file: File) => void;
}) {
  if (!files.length) return null;
  return (
    <div className="row" style={{ flexWrap: "nowrap", overflowX: "auto", gap: 8, paddingBottom: 4 }}>
      {files.map((file) => {
        const preview = previewFor(file);
        return (
          <div key={`${file.name}-${file.size}`} style={{ position: "relative", flexShrink: 0 }}>
            {preview ? (
              <img src={preview} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "12px 0 12px 12px" }} />
            ) : (
              <span
                className="sm"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "12px 0 12px 12px",
                  background: "var(--surface-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: 4,
                  fontSize: 11,
                }}
              >
                {kindOf(file)}
              </span>
            )}
            <button
              type="button"
              aria-label={`Pašalinti ${file.name}`}
              onClick={() => onRemove(file)}
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: "none",
                background: "var(--ink)",
                color: "var(--surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
