import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  Lock,
  Minus,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { CURRENT_KB_USER } from "./documentation-store.js";
import {
  evaluateAccess,
  formatBytes,
  getSecureFile,
  resolveFileBytes,
} from "./secure-files-store.js";
import {
  columnLabel,
  loadPdfDocument,
  parsePptx,
  readWorkbook,
  renderDocx,
} from "./secure-file-renderers.js";
import "./secure-files.css";

/*
 * The read-only surface. It never receives a URL to the source document - only
 * decrypted bytes that it converts straight into canvases, tables or sanitised
 * markup. Download affordances appear only when the grant explicitly allows
 * them, which is off by default.
 */

const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.15, 1.35, 1.6, 2];

/*
 * Deterrents, not DRM. These stop the ordinary routes out of the viewer -
 * right-click save, select-and-copy, Ctrl+S, Ctrl+P, drag-to-desktop - and are
 * worth having because they are what most users would reach for. They cannot
 * stop devtools or a phone camera, and are not sold as if they could.
 */
function useViewerLockdown(active) {
  useEffect(() => {
    if (!active) return undefined;
    const swallow = (event) => event.preventDefault();
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ["s", "p", "c", "x", "u"].includes(key))
        event.preventDefault();
      if (key === "printscreen") event.preventDefault();
    };
    const events = ["contextmenu", "copy", "cut", "dragstart"];
    events.forEach((name) => document.addEventListener(name, swallow));
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("secure-print-guard");
    return () => {
      events.forEach((name) => document.removeEventListener(name, swallow));
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("secure-print-guard");
    };
  }, [active]);
}

function Watermark({ user }) {
  const stamp = useMemo(
    () => `${user.email} · ${new Date().toLocaleString()}`,
    [user.email],
  );
  return (
    <div className="secure-watermark" aria-hidden="true">
      {Array.from({ length: 36 }, (_, index) => (
        <span key={index}>{stamp}</span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- PDF -- */

function PdfSurface({ bytes, zoom }) {
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    let loaded = null;
    loadPdfDocument(bytes)
      .then((doc) => {
        if (!active) return doc.destroy();
        loaded = doc;
        setPdf(doc);
        return undefined;
      })
      .catch((cause) => active && setError(cause.message));
    return () => {
      active = false;
      loaded?.destroy();
    };
  }, [bytes]);

  /*
   * Pages paint only once they scroll close to the viewport. A 300-page policy
   * document would otherwise rasterise every page up front and lock the tab.
   */
  useEffect(() => {
    if (!pdf || !containerRef.current) return undefined;
    const painted = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .forEach((entry) => {
            const canvas = entry.target.querySelector("canvas");
            const page = Number(entry.target.dataset.page);
            const token = `${page}@${zoom}`;
            if (!canvas || painted.has(token)) return;
            painted.add(token);
            pdf
              .paintPage(page, canvas, zoom * 1.3)
              .then(() => entry.target.classList.add("is-painted"))
              .catch(() => painted.delete(token));
          });
      },
      { root: containerRef.current, rootMargin: "600px 0px" },
    );
    [...containerRef.current.querySelectorAll("[data-page]")].forEach((node) =>
      observer.observe(node),
    );
    return () => observer.disconnect();
  }, [pdf, zoom]);

  if (error) return <SurfaceError message={error} />;
  if (!pdf) return <SurfaceLoading label="Rendering document" />;

  return (
    <div className="secure-pdf" ref={containerRef}>
      {Array.from({ length: pdf.pageCount }, (_, index) => (
        <div className="secure-pdf-page" key={index} data-page={index + 1}>
          <canvas />
          <span className="secure-pdf-number">
            {index + 1} / {pdf.pageCount}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ DOCX -- */

function DocxSurface({ bytes, zoom }) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let active = true;
    renderDocx(bytes)
      .then((result) => active && setState({ status: "ready", ...result }))
      .catch((cause) => active && setState({ status: "error", message: cause.message }));
    return () => {
      active = false;
    };
  }, [bytes]);

  if (state.status === "loading") return <SurfaceLoading label="Converting document" />;
  if (state.status === "error") return <SurfaceError message={state.message} />;

  return (
    <div className="secure-docx">
      <article
        className="secure-docx-page"
        style={{ fontSize: `${zoom}rem` }}
        dangerouslySetInnerHTML={{ __html: state.html }}
      />
      {state.notes?.length > 0 && (
        <p className="secure-surface-note">
          Some original formatting could not be reproduced exactly:{" "}
          {state.notes.join("; ")}
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- SHEET -- */

function SheetSurface({ bytes, zoom }) {
  const [state, setState] = useState({ status: "loading" });
  const [activeSheet, setActiveSheet] = useState(0);

  useEffect(() => {
    try {
      setState({ status: "ready", ...readWorkbook(bytes) });
    } catch (cause) {
      setState({ status: "error", message: cause.message });
    }
  }, [bytes]);

  if (state.status === "loading") return <SurfaceLoading label="Reading workbook" />;
  if (state.status === "error") return <SurfaceError message={state.message} />;

  const sheet = state.sheets[activeSheet];

  return (
    <div className="secure-sheet">
      {state.sheets.length > 1 && (
        <div className="secure-sheet-tabs" role="tablist">
          {state.sheets.map((item, index) => (
            <button
              key={item.name}
              role="tab"
              aria-selected={index === activeSheet}
              className={index === activeSheet ? "active" : ""}
              onClick={() => setActiveSheet(index)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
      <div className="secure-sheet-scroll" style={{ fontSize: `${zoom * 0.8}rem` }}>
        <table>
          <thead>
            <tr>
              <th className="secure-sheet-corner" />
              {Array.from({ length: sheet.columnCount }, (_, index) => (
                <th key={index}>{columnLabel(index)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row">{rowIndex + 1}</th>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.truncated && (
        <p className="secure-surface-note">
          Large sheet - display is capped at the first 2,000 rows and 80 columns.
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- SLIDES -- */

function SlideParagraph({ paragraph }) {
  const style = {
    textAlign:
      { ctr: "center", r: "right", just: "justify" }[paragraph.align] || "left",
    marginLeft: paragraph.level ? `${paragraph.level * 18}px` : undefined,
  };
  return (
    <p className={paragraph.bulleted ? "is-bulleted" : ""} style={style}>
      {paragraph.runs.map((run, index) => (
        <span
          key={index}
          style={{
            fontWeight: run.bold ? 700 : undefined,
            fontStyle: run.italic ? "italic" : undefined,
            textDecoration: run.underline ? "underline" : undefined,
            fontSize: run.size ? `${run.size}px` : undefined,
            color: run.color || undefined,
          }}
        >
          {run.text}
        </span>
      ))}
    </p>
  );
}

function SlideSurface({ bytes, zoom }) {
  const [deck, setDeck] = useState(null);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let parsed = null;
    try {
      parsed = parsePptx(bytes);
      setDeck(parsed);
    } catch (cause) {
      setError(cause.message);
    }
    return () => parsed?.release();
  }, [bytes]);

  if (error) return <SurfaceError message={error} />;
  if (!deck) return <SurfaceLoading label="Rebuilding slides" />;
  if (!deck.slides.length)
    return <SurfaceError message="This presentation contains no slides." />;

  const slide = deck.slides[current];
  /* Slides are authored at a fixed EMU size, so scale the whole stage. */
  const scale = (720 / deck.width) * zoom;

  return (
    <div className="secure-slides">
      <div
        className="secure-slide-stage"
        style={{
          width: deck.width * scale,
          height: deck.height * scale,
        }}
      >
        <div
          className="secure-slide-canvas"
          style={{
            width: deck.width,
            height: deck.height,
            transform: `scale(${scale})`,
          }}
        >
          {slide.elements.map((element, index) => {
            const box = {
              left: element.frame.x,
              top: element.frame.y,
              width: element.frame.width,
              height: element.frame.height,
              transform: element.frame.rotation
                ? `rotate(${element.frame.rotation}deg)`
                : undefined,
            };
            if (element.type === "image")
              return (
                <img
                  key={index}
                  className="secure-slide-image"
                  style={box}
                  src={element.url}
                  alt={element.alt}
                  draggable={false}
                />
              );
            if (element.type === "table")
              return (
                <div className="secure-slide-table" key={index} style={box}>
                  <table>
                    <tbody>
                      {element.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.cells
                            .filter((cell) => !cell.merged)
                            .map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                colSpan={cell.colSpan}
                                rowSpan={cell.rowSpan}
                              >
                                {cell.paragraphs.map((paragraph, pIndex) => (
                                  <SlideParagraph key={pIndex} paragraph={paragraph} />
                                ))}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            return (
              <div
                key={index}
                className="secure-slide-text"
                style={{ ...box, background: element.fill || undefined }}
              >
                {element.paragraphs.map((paragraph, pIndex) => (
                  <SlideParagraph key={pIndex} paragraph={paragraph} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="secure-slide-bar">
        <button
          disabled={current === 0}
          onClick={() => setCurrent((value) => Math.max(0, value - 1))}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          Slide {slide.number} of {deck.slides.length}
        </span>
        <button
          disabled={current === deck.slides.length - 1}
          onClick={() =>
            setCurrent((value) => Math.min(deck.slides.length - 1, value + 1))
          }
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <p className="secure-surface-note">
        Slides are reconstructed from the PowerPoint source. Text, images and
        tables keep their position; theme-level styling may differ from
        PowerPoint.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- shell -- */

function SurfaceLoading({ label }) {
  return (
    <div className="secure-surface-state">
      <Loader2 className="secure-spin" size={22} />
      <p>{label}…</p>
    </div>
  );
}

function SurfaceError({ message }) {
  return (
    <div className="secure-surface-state is-error">
      <AlertTriangle size={22} />
      <p>{message}</p>
    </div>
  );
}

const SURFACES = {
  pdf: PdfSurface,
  docx: DocxSurface,
  sheet: SheetSurface,
  slides: SlideSurface,
};

export default function SecureFileViewer({
  fileId,
  user = CURRENT_KB_USER,
  onClose,
}) {
  const record = useMemo(() => getSecureFile(fileId), [fileId]);
  const access = useMemo(() => evaluateAccess(record, user), [record, user]);
  const [bytes, setBytes] = useState(null);
  const [error, setError] = useState("");
  const [zoomIndex, setZoomIndex] = useState(3);

  useViewerLockdown(Boolean(record) && access.canView && !access.canDownload);

  useEffect(() => {
    if (!access.canView) return undefined;
    let active = true;
    resolveFileBytes(fileId, user)
      .then((buffer) => active && setBytes(buffer))
      .catch((cause) => active && setError(cause.message));
    return () => {
      active = false;
    };
  }, [fileId, user, access.canView]);

  /*
   * Only reachable when the grant allows downloads. The object URL is minted on
   * click and revoked immediately, so no download-able URL exists at rest.
   */
  const download = useCallback(() => {
    if (!access.canDownload || !bytes) return;
    const url = URL.createObjectURL(
      new Blob([bytes], { type: record.mime || "application/octet-stream" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = record.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [access.canDownload, bytes, record]);

  if (!record || !access.canView)
    return (
      <div className="secure-viewer is-denied">
        <div className="secure-denied-card">
          <Lock size={28} />
          <h2>This document is not available to you</h2>
          <p>{access.reason}</p>
          <p className="secure-denied-meta">
            Signed in as {user.name} ({user.email}). Ask the document owner to
            grant you view access.
          </p>
          {onClose && (
            <button className="secure-primary" onClick={onClose}>
              Back to library
            </button>
          )}
        </div>
      </div>
    );

  const Surface = SURFACES[record.kind];
  const zoom = ZOOM_STEPS[zoomIndex];

  return (
    <div className={`secure-viewer ${access.canDownload ? "" : "is-locked"}`}>
      <header className="secure-viewer-bar">
        <div className="secure-viewer-title">
          <strong title={record.name}>{record.name}</strong>
          <small>
            {record.formatLabel} · {formatBytes(record.size)} · Owner{" "}
            {record.ownerName}
          </small>
        </div>

        <div className="secure-viewer-tools">
          <span
            className={`secure-badge ${access.canDownload ? "is-open" : "is-locked"}`}
          >
            {access.canDownload ? <Eye size={13} /> : <ShieldCheck size={13} />}
            {access.canDownload ? "Download allowed" : "View only"}
          </span>
          <div className="secure-zoom">
            <button
              onClick={() => setZoomIndex((value) => Math.max(0, value - 1))}
              disabled={zoomIndex === 0}
              title="Zoom out"
            >
              <Minus size={14} />
            </button>
            <b>{Math.round(zoom * 100)}%</b>
            <button
              onClick={() =>
                setZoomIndex((value) => Math.min(ZOOM_STEPS.length - 1, value + 1))
              }
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              title="Zoom in"
            >
              <Plus size={14} />
            </button>
          </div>
          {access.canDownload && (
            <button className="secure-ghost" onClick={download} disabled={!bytes}>
              <Download size={14} /> Download
            </button>
          )}
          {onClose && (
            <button className="secure-icon" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="secure-viewer-body">
        {record.watermark && !access.canDownload && <Watermark user={user} />}
        {error ? (
          <SurfaceError message={error} />
        ) : !bytes ? (
          <SurfaceLoading label="Decrypting document" />
        ) : Surface ? (
          <Surface bytes={bytes} zoom={zoom} />
        ) : (
          <SurfaceError message="No viewer is available for this file type." />
        )}
      </div>
    </div>
  );
}
