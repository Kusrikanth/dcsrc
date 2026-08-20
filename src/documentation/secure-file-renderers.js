import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth/mammoth.browser.js";
import * as XLSX from "xlsx";
import { unzipSync, strFromU8 } from "fflate";

/*
 * Turns stored bytes into something React can paint, without ever producing a
 * URL that points at the original file. Every renderer here consumes an
 * ArrayBuffer and returns plain data or a canvas painter - no anchor targets,
 * no object URLs for the source document itself.
 */

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/* Asset folders are mirrored into /public by scripts/sync-pdfjs-assets.mjs. */
const PDF_ASSETS = {
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  wasmUrl: "/pdfjs/wasm/",
};

/* ------------------------------------------------------------------- PDF -- */

export async function loadPdfDocument(arrayBuffer) {
  /*
   * pdf.js transfers and then detaches the buffer it is handed. The caller
   * keeps its copy for re-renders (zoom, page changes), so pass a clone.
   */
  const task = pdfjs.getDocument({
    data: arrayBuffer.slice(0),
    ...PDF_ASSETS,
    isEvalSupported: false,
  });
  const doc = await task.promise;
  return {
    pageCount: doc.numPages,
    /*
     * Teardown belongs to the loading task, not the document proxy - the proxy
     * only exposes cleanup(). Calling destroy() on the proxy throws, which in a
     * React effect cleanup takes the whole tree down with it.
     */
    destroy: () => task.destroy(),
    async paintPage(pageNumber, canvas, scale = 1.25) {
      const page = await doc.getPage(pageNumber);
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * ratio });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / ratio}px`;
      canvas.style.height = `${viewport.height / ratio}px`;
      const task = page.render({
        canvas,
        canvasContext: canvas.getContext("2d"),
        viewport,
      });
      await task.promise;
      page.cleanup();
    },
  };
}

/* ------------------------------------------------------------------ DOCX -- */

const ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "SUP", "SUB",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE", "HR", "SPAN", "DIV",
  "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "IMG",
]);
const ALLOWED_ATTRS = {
  IMG: new Set(["src", "alt", "width", "height"]),
  TH: new Set(["colspan", "rowspan"]),
  TD: new Set(["colspan", "rowspan"]),
};

/*
 * mammoth emits a narrow tag set, but the input is an untrusted upload, so the
 * output is walked against an allowlist before it goes anywhere near
 * dangerouslySetInnerHTML. Anchors are stripped entirely rather than
 * sanitised - a live link is an exfiltration path out of a view-only document.
 */
function sanitizeDocxHtml(html) {
  const parsed = new DOMParser().parseFromString(
    `<body>${html}</body>`,
    "text/html",
  );
  const walk = (node) => {
    [...node.children].forEach((child) => {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        const replacement = parsed.createElement("span");
        replacement.innerHTML = child.innerHTML;
        child.replaceWith(replacement);
        walk(replacement);
        return;
      }
      [...child.attributes].forEach((attribute) => {
        const permitted = ALLOWED_ATTRS[child.tagName];
        const name = attribute.name.toLowerCase();
        const isSafeImage =
          child.tagName === "IMG" &&
          name === "src" &&
          attribute.value.startsWith("data:image/");
        if (!permitted?.has(name) || (name === "src" && !isSafeImage))
          child.removeAttribute(attribute.name);
      });
      walk(child);
    });
  };
  walk(parsed.body);
  return parsed.body.innerHTML;
}

export async function renderDocx(arrayBuffer) {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return {
    html: sanitizeDocxHtml(result.value),
    notes: (result.messages || [])
      .filter((message) => message.type === "warning")
      .map((message) => message.message)
      .slice(0, 5),
  };
}

/* ----------------------------------------------------------------- SHEET -- */

export const SHEET_ROW_LIMIT = 2000;
export const SHEET_COLUMN_LIMIT = 80;

export function readWorkbook(arrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
    type: "array",
    cellDates: true,
    cellStyles: false,
    cellHTML: false,
  });
  let truncated = false;
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    if (rows.length > SHEET_ROW_LIMIT) truncated = true;
    const capped = rows.slice(0, SHEET_ROW_LIMIT).map((row) => {
      if (row.length > SHEET_COLUMN_LIMIT) truncated = true;
      return row
        .slice(0, SHEET_COLUMN_LIMIT)
        .map((cell) => (cell === null || cell === undefined ? "" : String(cell)));
    });
    const columnCount = capped.reduce((max, row) => Math.max(max, row.length), 0);
    return {
      name,
      columnCount,
      rows: capped.map((row) => {
        const padded = [...row];
        padded.length = columnCount;
        return [...padded].map((cell) => cell ?? "");
      }),
    };
  });
  return { sheets, truncated };
}

export function columnLabel(index) {
  let label = "";
  let value = index;
  while (value >= 0) {
    label = String.fromCharCode((value % 26) + 65) + label;
    value = Math.floor(value / 26) - 1;
  }
  return label;
}

/* ---------------------------------------------------------------- SLIDES -- */

const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const EMU_PER_PX = 9525;

const IMAGE_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  webp: "image/webp",
  tiff: "image/tiff",
  emf: "image/emf",
  wmf: "image/wmf",
};

function parseXml(files, path) {
  const entry = files[path];
  if (!entry) return null;
  const doc = new DOMParser().parseFromString(strFromU8(entry), "application/xml");
  return doc.querySelector("parsererror") ? null : doc;
}

function first(node, ns, tag) {
  return node?.getElementsByTagNameNS(ns, tag)?.[0] || null;
}

function childrenOf(node, ns, tag) {
  return node ? [...node.getElementsByTagNameNS(ns, tag)] : [];
}

/* Relationship id -> part path, resolved relative to the owning part. */
function readRelationships(files, partPath) {
  const segments = partPath.split("/");
  const relPath = `${segments.slice(0, -1).join("/")}/_rels/${segments.at(-1)}.rels`;
  const doc = parseXml(files, relPath);
  const map = {};
  if (!doc) return map;
  [...doc.getElementsByTagName("Relationship")].forEach((rel) => {
    const target = rel.getAttribute("Target") || "";
    const base = segments.slice(0, -1);
    const resolved = target.startsWith("/")
      ? target.slice(1)
      : [...base, ...target.split("/")]
          .reduce((stack, part) => {
            if (part === "..") stack.pop();
            else if (part !== ".") stack.push(part);
            return stack;
          }, [])
          .join("/");
    map[rel.getAttribute("Id")] = resolved;
  });
  return map;
}

function emuToPx(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / EMU_PER_PX : fallback;
}

function readFrame(node) {
  /*
   * Shapes and pictures carry <a:xfrm> inside spPr, but a graphicFrame (tables,
   * charts) carries <p:xfrm> directly on itself. Same attributes, different
   * namespace - miss the second one and every table silently vanishes.
   */
  const xfrm = first(node, NS_A, "xfrm") || first(node, NS_P, "xfrm");
  const off = first(xfrm, NS_A, "off");
  const ext = first(xfrm, NS_A, "ext");
  if (!off && !ext) return null;
  return {
    x: emuToPx(off?.getAttribute("x")),
    y: emuToPx(off?.getAttribute("y")),
    width: emuToPx(ext?.getAttribute("cx")),
    height: emuToPx(ext?.getAttribute("cy")),
    rotation: Number(xfrm?.getAttribute("rot") || 0) / 60000,
  };
}

function readSolidFill(node) {
  const fill = first(node, NS_A, "solidFill");
  const srgb = first(fill, NS_A, "srgbClr");
  if (srgb) return `#${srgb.getAttribute("val")}`;
  const scheme = first(fill, NS_A, "schemeClr");
  /* Theme colours need the master/theme part; approximate the common ones. */
  const named = { dk1: "#1f2933", dk2: "#33475b", lt1: "#ffffff", lt2: "#eef2f6" };
  return scheme ? named[scheme.getAttribute("val")] || null : null;
}

function readParagraphs(textBody) {
  return childrenOf(textBody, NS_A, "p").map((paragraph) => {
    const properties = first(paragraph, NS_A, "pPr");
    const runs = [...paragraph.childNodes]
      .filter(
        (node) =>
          node.namespaceURI === NS_A && ["r", "br", "fld"].includes(node.localName),
      )
      .map((node) => {
        if (node.localName === "br") return { text: "\n", lineBreak: true };
        const runProperties = first(node, NS_A, "rPr");
        const textNode = first(node, NS_A, "t");
        return {
          text: textNode?.textContent || "",
          bold: runProperties?.getAttribute("b") === "1",
          italic: runProperties?.getAttribute("i") === "1",
          underline: Boolean(runProperties?.getAttribute("u")),
          /* OOXML stores font size in hundredths of a point. */
          size: runProperties?.getAttribute("sz")
            ? Number(runProperties.getAttribute("sz")) / 100
            : null,
          color: readSolidFill(runProperties),
        };
      })
      .filter((run) => run.text);
    return {
      runs,
      align: properties?.getAttribute("algn") || null,
      level: Number(properties?.getAttribute("lvl") || 0),
      bulleted:
        Boolean(first(properties, NS_A, "buChar") || first(properties, NS_A, "buAutoNum")) &&
        !first(properties, NS_A, "buNone"),
    };
  });
}

function readTable(graphicFrame) {
  const table = first(graphicFrame, NS_A, "tbl");
  if (!table) return null;
  const grid = childrenOf(first(table, NS_A, "tblGrid"), NS_A, "gridCol").map(
    (column) => emuToPx(column.getAttribute("w"), 100),
  );
  const rows = childrenOf(table, NS_A, "tr").map((row) => ({
    height: emuToPx(row.getAttribute("h"), 24),
    cells: childrenOf(row, NS_A, "tc").map((cell) => ({
      paragraphs: readParagraphs(first(cell, NS_A, "txBody")),
      colSpan: Number(cell.getAttribute("gridSpan") || 1),
      rowSpan: Number(cell.getAttribute("rowSpan") || 1),
      merged:
        cell.getAttribute("hMerge") === "1" || cell.getAttribute("vMerge") === "1",
    })),
  }));
  return { grid, rows };
}

/*
 * PPTX has no browser-native renderer, so slides are reconstructed from the
 * OOXML: every shape carries an absolute offset and extent in EMUs, which map
 * cleanly onto absolutely-positioned boxes. Layout and master inheritance is
 * not resolved, so text that relies on placeholder defaults falls back to
 * sensible sizes rather than the exact theme.
 */
export function parsePptx(arrayBuffer) {
  const files = unzipSync(new Uint8Array(arrayBuffer));
  const presentation = parseXml(files, "ppt/presentation.xml");
  if (!presentation)
    throw new Error("This PowerPoint file could not be read - it may be corrupt.");

  const size = first(presentation, NS_P, "sldSz");
  const slideWidth = emuToPx(size?.getAttribute("cx"), 960);
  const slideHeight = emuToPx(size?.getAttribute("cy"), 540);

  const presentationRels = readRelationships(files, "ppt/presentation.xml");
  const slidePaths = childrenOf(first(presentation, NS_P, "sldIdLst"), NS_P, "sldId")
    .map((slideId) => presentationRels[slideId.getAttributeNS(NS_R, "id")])
    .filter(Boolean);

  const objectUrls = [];
  const slides = slidePaths.map((slidePath, index) => {
    const doc = parseXml(files, slidePath);
    const rels = readRelationships(files, slidePath);
    const tree = first(doc, NS_P, "spTree");
    const elements = [];

    [...(tree?.childNodes || [])]
      .filter((node) => node.namespaceURI === NS_P)
      .forEach((node) => {
        if (node.localName === "sp") {
          const frame = readFrame(first(node, NS_P, "spPr"));
          const paragraphs = readParagraphs(first(node, NS_P, "txBody"));
          if (!paragraphs.some((paragraph) => paragraph.runs.length)) return;
          elements.push({
            type: "text",
            frame,
            paragraphs,
            fill: readSolidFill(first(node, NS_P, "spPr")),
          });
        }

        if (node.localName === "pic") {
          const blip = first(node, NS_A, "blip");
          const target = rels[blip?.getAttributeNS(NS_R, "embed")];
          const bytes = target && files[target];
          if (!bytes) return;
          const ext = target.split(".").pop()?.toLowerCase() || "png";
          const url = URL.createObjectURL(
            new Blob([bytes], { type: IMAGE_MIME[ext] || "image/png" }),
          );
          objectUrls.push(url);
          elements.push({
            type: "image",
            frame: readFrame(first(node, NS_P, "spPr")),
            url,
            alt: first(node, NS_P, "cNvPr")?.getAttribute("name") || "Slide image",
          });
        }

        if (node.localName === "graphicFrame") {
          const table = readTable(node);
          if (table)
            elements.push({ type: "table", frame: readFrame(node), ...table });
        }
      });

    return {
      number: index + 1,
      elements: elements.filter((element) => element.frame),
    };
  });

  return {
    width: slideWidth,
    height: slideHeight,
    slides,
    /* Slide images are the only object URLs we mint; the viewer revokes them. */
    release: () => objectUrls.forEach((url) => URL.revokeObjectURL(url)),
  };
}
