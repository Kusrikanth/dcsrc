import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  FileImage,
  FileText,
  Heading,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  LockKeyhole,
  Menu,
  MonitorPlay,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Underline,
  Video,
  X,
} from "lucide-react";
import "./documentation-portal.css";
import {
  CURRENT_KB_USER,
  canAccess,
  defaultKnowledgeBase,
  getKnowledgeBase,
  getKnowledgeBaseByCode,
  kbStorageKey,
} from "./documentation-store.js";

const initialModules = [
  {
    name: "Getting started",
    items: ["About Digital Campus", "Documentation guide"],
  },
  {
    name: "Student management",
    items: [
      "Student profile",
      "Admission details",
      "Documents",
      "Student promotion",
    ],
  },
  {
    name: "Academics",
    items: [
      "Academic profile",
      "Class allocation",
      "Subject mapping",
      "Attendance entry",
    ],
  },
  {
    name: "Fees & accounts",
    items: ["Fee configuration", "Collect fees", "Concessions", "Refunds"],
  },
  { name: "Examinations", items: ["Exam setup", "Mark entry", "Report cards"] },
  {
    name: "Transport",
    items: ["Route management", "Student allocation", "Transport messaging"],
  },
  {
    name: "Administration",
    items: ["Approval configuration", "User roles", "Audit log"],
  },
];

function normalizeModules(items) {
  return items.map((module) => ({
    ...module,
    children: module.children || {},
  }));
}

function childPages(module, path) {
  return module.children?.[path.join(" / ")] || [];
}

function flattenModulePages(module, pages = module.items, parentPath = []) {
  return pages.flatMap((page) => {
    const path = [...parentPath, page];
    return [
      { page, path },
      ...flattenModulePages(module, childPages(module, path), path),
    ];
  });
}

const initialDoc = {
  title: "Student Profile",
  summary:
    "View and maintain a complete student record, including personal information, guardian details, enrolment status and academic history.",
  purpose:
    "The Student Profile is the central record for every learner in Digital Campus. Authorized teams use this screen to verify student information and understand the student’s complete journey across academic years.",
  navigation:
    "Student Management  ›  Students  ›  Search Student  ›  Student Profile",
  fields: [
    [
      "Student ID",
      "System-generated",
      "Unique student reference used across all ERP modules.",
    ],
    [
      "Student name",
      "Text · Required",
      "Student’s legal name as recorded in admission documents.",
    ],
    [
      "Class & section",
      "Selection · Required",
      "Current academic class and assigned section.",
    ],
    [
      "Admission status",
      "Status",
      "Active, inactive, withdrawn, alumni or transferred.",
    ],
    [
      "Primary contact",
      "Phone number",
      "Guardian number used for official school communication.",
    ],
  ],
  rules:
    "Only users with Student Profile – Edit permission can change the record. Student ID cannot be modified after admission is confirmed. Changes to class, section or admission status are written to the audit log.",
  customSections: [],
};

const CURRENT_EDITOR = CURRENT_KB_USER.name;
const DELETE_PASSWORD = import.meta.env.VITE_DELETE_PASSWORD || "Admin@123";
const editStamp = () => ({
  updatedAt: new Date().toISOString(),
  updatedBy: CURRENT_EDITOR,
});
const displayStamp = (meta) =>
  meta?.updatedAt
    ? `${new Date(meta.updatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · ${meta.updatedBy}`
    : "Not edited yet";

function plainText(html = "") {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent || "";
}

function searchableEntries(module, page, doc) {
  const entries = [];
  const add = (label, text, anchor) =>
    text && entries.push({ module, page, label, text: String(text), anchor });
  add("Page title", doc.title, "overview");
  if (doc.blankPage) {
    (doc.blocks || []).forEach((block) => {
      if (block.type === "heading")
        add("Heading", block.text, `block-${block.id}`);
      if (block.type === "body")
        add("Body", plainText(block.html), `block-${block.id}`);
      if (block.type === "points")
        add("Points", plainText(block.html), `block-${block.id}`);
      if (block.type === "media")
        add(
          block.mime?.startsWith("video/")
            ? "Video"
            : block.mime?.startsWith("image/")
              ? "Image"
              : "Attachment",
          block.name,
          `block-${block.id}`,
        );
      if (block.type === "embed-video")
        add(
          "Embedded video",
          `${block.title || ""} ${block.embedCode || ""}`,
          `block-${block.id}`,
        );
    });
  } else {
    add("Overview", doc.summary, "overview");
    add("Purpose", doc.purpose, "purpose");
    add("Navigation path", doc.navigation, "navigation");
    add("Permissions & business rules", doc.rules, "permissions");
    (doc.fields || []).forEach((row, index) =>
      add(`Field: ${row[0]}`, row.join(" · "), `field-${index}`),
    );
    (doc.customSections || []).forEach((section) =>
      add(
        section.title,
        `${section.title} ${section.body}`,
        `custom-${section.id}`,
      ),
    );
  }
  return entries;
}

function editableProps(isAdmin, onInput) {
  return isAdmin
    ? {
        contentEditable: true,
        suppressContentEditableWarning: true,
        onInput,
        spellCheck: true,
      }
    : {};
}

function openAssetDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("dc-document-assets", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("assets");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeAsset(file) {
  const id = crypto.randomUUID?.() || `${Date.now()}-${file.name}`;
  const db = await openAssetDb();
  await new Promise((resolve, reject) => {
    const request = db
      .transaction("assets", "readwrite")
      .objectStore("assets")
      .put(file, id);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  db.close();
  return id;
}

async function readAsset(id) {
  const db = await openAssetDb();
  const blob = await new Promise((resolve, reject) => {
    const request = db.transaction("assets").objectStore("assets").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob;
}

function RichTextBlock({ block, isAdmin, onChange, onPasteImage }) {
  const editorRef = useRef(null);
  const linkRangeRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const command = (name, value = null) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
  };
  const prepareLink = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection) return;
    let range = selection.rangeCount
      ? selection.getRangeAt(0).cloneRange()
      : document.createRange();
    if (!editor.contains(range.commonAncestorContainer)) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    let selectedText = range.toString().trim();
    if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
      const beforeCursor = range.startContainer.textContent.slice(
        0,
        range.startOffset,
      );
      const match = beforeCursor.match(/(?:https?:\/\/|www\.)[^\s]+$/i);
      if (match) {
        range.setStart(
          range.startContainer,
          range.startOffset - match[0].length,
        );
        selectedText = match[0];
      }
    }
    linkRangeRef.current = range;
    setLinkUrl(selectedText || "https://");
    setLinkError("");
    setLinkOpen(true);
  };
  const applyLink = () => {
    const editor = editorRef.current;
    const range = linkRangeRef.current;
    if (!editor || !range) return;
    let url = linkUrl.trim();
    if (/^www\./i.test(url)) url = `https://${url}`;
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) {
      setLinkError("Use https://, http://, mailto:, or tel:.");
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    if (range.collapsed) anchor.textContent = url;
    else anchor.appendChild(range.extractContents());
    range.insertNode(anchor);
    const caret = document.createRange();
    caret.setStartAfter(anchor);
    caret.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(caret);
    editor.focus();
    onChange(editor.innerHTML);
    setLinkOpen(false);
    setLinkUrl("");
    linkRangeRef.current = null;
  };
  const paste = (event) => {
    const image = [...(event.clipboardData?.items || [])]
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();
    if (image) {
      event.preventDefault();
      onPasteImage(image);
    }
  };
  return (
    <div className="docs-rich-block">
      {isAdmin && (
        <div className="docs-rich-toolbar">
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("bold")}
            title="Bold"
          >
            <Bold size={15} />
          </button>
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("italic")}
            title="Italic"
          >
            <Italic size={15} />
          </button>
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("underline")}
            title="Underline"
          >
            <Underline size={15} />
          </button>
          <i />
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("justifyLeft")}
            title="Align left"
          >
            <AlignLeft size={15} />
          </button>
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("justifyCenter")}
            title="Align center"
          >
            <AlignCenter size={15} />
          </button>
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("justifyRight")}
            title="Align right"
          >
            <AlignRight size={15} />
          </button>
          <i />
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("insertUnorderedList")}
            title="Bulleted list"
          >
            <List size={15} />
          </button>
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("insertOrderedList")}
            title="Numbered list"
          >
            <ListOrdered size={15} />
          </button>
          <button
            className={linkOpen ? "active" : ""}
            onMouseDown={(event) => event.preventDefault()}
            onClick={prepareLink}
            title="Add link"
          >
            <Link2 size={15} />
          </button>
        </div>
      )}
      {isAdmin && linkOpen && (
        <div className="docs-link-panel">
          <label>
            Link URL
            <input
              autoFocus
              value={linkUrl}
              onChange={(event) => {
                setLinkUrl(event.target.value);
                setLinkError("");
              }}
              onKeyDown={(event) => event.key === "Enter" && applyLink()}
              placeholder="https://example.com"
            />
          </label>
          {linkError && <span>{linkError}</span>}
          <button
            onClick={() => {
              setLinkOpen(false);
              linkRangeRef.current = null;
            }}
          >
            Cancel
          </button>
          <button className="apply" onClick={applyLink}>
            Apply link
          </button>
        </div>
      )}
      <div
        ref={editorRef}
        className="docs-rich-editor"
        contentEditable={isAdmin}
        suppressContentEditableWarning
        onBlur={(event) => onChange(event.currentTarget.innerHTML)}
        onPaste={paste}
        data-placeholder="Write your content here, or paste an image…"
        dangerouslySetInnerHTML={{ __html: block.html || "" }}
      />
    </div>
  );
}

function MediaBlock({ block, isAdmin, onFile, onUpdate }) {
  const inputRef = useRef(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    let objectUrl = "";
    if (!block.assetId) {
      setUrl("");
      return undefined;
    }
    readAsset(block.assetId).then((blob) => {
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }
    });
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
  }, [block.assetId]);
  const accept =
    block.kind === "image"
      ? "image/*"
      : block.kind === "video"
        ? "video/*"
        : "*/*";
  const alignment = block.align || "center";
  const width = block.width || 100;
  const cropAspect = block.cropAspect || "original";
  const frameStyle = {
    width: `${width}%`,
    marginLeft: alignment === "left" ? 0 : "auto",
    marginRight: alignment === "right" ? 0 : "auto",
  };
  return (
    <div className="docs-media-block">
      {isAdmin && (
        <div className="docs-media-layout">
          <span>Placement</span>
          <button
            className={alignment === "left" ? "active" : ""}
            onClick={() => onUpdate({ align: "left" })}
            title="Align left"
          >
            <AlignLeft size={14} />
          </button>
          <button
            className={alignment === "center" ? "active" : ""}
            onClick={() => onUpdate({ align: "center" })}
            title="Align center"
          >
            <AlignCenter size={14} />
          </button>
          <button
            className={alignment === "right" ? "active" : ""}
            onClick={() => onUpdate({ align: "right" })}
            title="Align right"
          >
            <AlignRight size={14} />
          </button>
          <label>
            Width{" "}
            <input
              type="range"
              min="25"
              max="100"
              step="5"
              value={width}
              onChange={(event) =>
                onUpdate({ width: Number(event.target.value) })
              }
            />
            <b>{width}%</b>
          </label>
        </div>
      )}
      {url && block.mime?.startsWith("image/") && (
        <div
          className={`docs-image-frame ${cropAspect === "original" ? "original" : "cropped"}`}
          style={{
            ...frameStyle,
            ...(cropAspect !== "original" ? { aspectRatio: cropAspect } : {}),
          }}
        >
          <img
            src={url}
            alt={block.alt || block.name || "Documentation reference"}
            style={
              cropAspect === "original"
                ? undefined
                : {
                    objectPosition: `${block.cropX ?? 50}% ${block.cropY ?? 50}%`,
                    transform: `scale(${block.zoom || 1})`,
                    transformOrigin: `${block.cropX ?? 50}% ${block.cropY ?? 50}%`,
                  }
            }
          />
        </div>
      )}
      {url && block.mime?.startsWith("video/") && (
        <div className="docs-video-frame" style={frameStyle}>
          <video src={url} controls />
        </div>
      )}
      {url &&
        !block.mime?.startsWith("image/") &&
        !block.mime?.startsWith("video/") && (
          <div style={frameStyle}>
            <a className="docs-file-preview" href={url} download={block.name}>
              <Paperclip size={20} />
              <span>
                <strong>{block.name}</strong>
                <small>
                  {Math.ceil((block.size || 0) / 1024)} KB · Click to download
                </small>
              </span>
            </a>
          </div>
        )}
      {isAdmin && url && block.mime?.startsWith("image/") && (
        <div className="docs-crop-controls">
          <label>
            Crop
            <select
              value={cropAspect}
              onChange={(event) =>
                onUpdate({
                  cropAspect: event.target.value,
                  zoom: 1,
                  cropX: 50,
                  cropY: 50,
                })
              }
            >
              <option value="original">Original ratio</option>
              <option value="16 / 9">16:9 landscape</option>
              <option value="4 / 3">4:3 landscape</option>
              <option value="1 / 1">Square</option>
              <option value="3 / 4">3:4 portrait</option>
            </select>
          </label>
          {cropAspect !== "original" && (
            <div className="docs-crop-advanced">
              <label>
                Zoom
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.05"
                  value={block.zoom || 1}
                  onChange={(event) =>
                    onUpdate({ zoom: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Horizontal
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={block.cropX ?? 50}
                  onChange={(event) =>
                    onUpdate({ cropX: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Vertical
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={block.cropY ?? 50}
                  onChange={(event) =>
                    onUpdate({ cropY: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          )}
        </div>
      )}
      {!url && (
        <button
          className="docs-media-empty"
          disabled={!isAdmin}
          onClick={() => inputRef.current?.click()}
        >
          {block.kind === "image" ? (
            <Image size={24} />
          ) : block.kind === "video" ? (
            <Video size={24} />
          ) : (
            <Paperclip size={24} />
          )}
          <span>
            <strong>
              {isAdmin ? `Upload ${block.kind}` : "No attachment added"}
            </strong>
            <small>
              {isAdmin
                ? "Choose a file or paste an image into a rich text section."
                : ""}
            </small>
          </span>
        </button>
      )}
      {isAdmin && url && (
        <button
          className="docs-replace-media"
          onClick={() => inputRef.current?.click()}
        >
          Replace file
        </button>
      )}
      <input
        ref={inputRef}
        hidden
        type="file"
        accept={accept}
        onChange={(event) =>
          event.target.files?.[0] && onFile(event.target.files[0])
        }
      />
    </div>
  );
}

function normalizeEmbedUrl(value = "") {
  const iframeSource = value.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
  let source = (iframeSource || value).trim();
  if (!source) return "";
  try {
    const url = new URL(source);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (url.hostname.includes("youtube.com") && url.pathname === "/watch")
      return `https://www.youtube.com/embed/${url.searchParams.get("v") || ""}`;
    if (url.hostname === "youtu.be")
      return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
    if (
      url.hostname.includes("vimeo.com") &&
      !url.hostname.startsWith("player.")
    )
      return `https://player.vimeo.com/video/${url.pathname.split("/").filter(Boolean).pop()}`;
    return url.toString();
  } catch {
    return "";
  }
}

function EmbedVideoBlock({ block, isAdmin, onUpdate }) {
  const playableUrl = normalizeEmbedUrl(block.embedCode || "");
  const alignment = block.align || "center";
  const width = block.width || 100;
  const frameStyle = {
    width: `${width}%`,
    marginLeft: alignment === "left" ? 0 : "auto",
    marginRight: alignment === "right" ? 0 : "auto",
  };
  return (
    <div className="docs-embed-block">
      {isAdmin && (
        <div className="docs-media-layout">
          <span>Placement</span>
          <button
            className={alignment === "left" ? "active" : ""}
            onClick={() => onUpdate({ align: "left" })}
          >
            <AlignLeft size={14} />
          </button>
          <button
            className={alignment === "center" ? "active" : ""}
            onClick={() => onUpdate({ align: "center" })}
          >
            <AlignCenter size={14} />
          </button>
          <button
            className={alignment === "right" ? "active" : ""}
            onClick={() => onUpdate({ align: "right" })}
          >
            <AlignRight size={14} />
          </button>
          <label>
            Width{" "}
            <input
              type="range"
              min="30"
              max="100"
              step="5"
              value={width}
              onChange={(event) =>
                onUpdate({ width: Number(event.target.value) })
              }
            />
            <b>{width}%</b>
          </label>
        </div>
      )}
      {isAdmin && (
        <label className="docs-embed-input">
          Video URL or iframe code
          <textarea
            rows="3"
            value={block.embedCode || ""}
            onChange={(event) => onUpdate({ embedCode: event.target.value })}
            placeholder={
              'Paste a YouTube/Vimeo URL, embed URL, or <iframe src="…"></iframe>'
            }
          />
          <small>
            The external video is streamed from its original provider and is not
            uploaded to this Documentation.
          </small>
        </label>
      )}
      {playableUrl ? (
        <div className="docs-embed-frame" style={frameStyle}>
          <iframe
            src={playableUrl}
            title={block.title || "Embedded documentation video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div className="docs-embed-placeholder" style={frameStyle}>
          <MonitorPlay size={28} />
          <span>
            <strong>
              {isAdmin
                ? "Paste a valid video URL or iframe code"
                : "Video is unavailable"}
            </strong>
            <small>
              {isAdmin ? "A playable preview will appear here." : ""}
            </small>
          </span>
        </div>
      )}
    </div>
  );
}

function BlankPageEditor({
  draft,
  isAdmin,
  updateTitle,
  updateBlock,
  requestDelete,
  attachFile,
  addPastedImage,
  openPicker,
}) {
  return (
    <>
      <section id="overview" className="docs-hero docs-blank-hero">
        <div className="docs-kicker">
          <span>SCREEN DOCUMENTATION</span>
          <span>Last updated {displayStamp(draft.meta)}</span>
        </div>
        <h1 {...editableProps(isAdmin, updateTitle)}>{draft.title}</h1>
        {!(draft.blocks || []).length && (
          <p>
            {isAdmin
              ? "This page is blank. Add the first section and build the documentation in any order you need."
              : "Documentation has not been added to this page yet."}
          </p>
        )}
      </section>
      <div className="docs-block-canvas">
        {(draft.blocks || []).map((block, index) => (
          <section
            id={`block-${block.id}`}
            className={`docs-content-block block-${block.type}`}
            key={block.id}
          >
            {isAdmin && (
              <div className="docs-block-label">
                <span>
                  {index + 1}.{" "}
                  {block.type === "body" ? "Rich text" : block.type}
                </span>
                <small>Updated {displayStamp(block.meta)}</small>
                <button
                  onClick={() =>
                    requestDelete({
                      type: "block",
                      id: block.id,
                      label: `${block.type} section`,
                    })
                  }
                  title="Delete block"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
            {block.type === "heading" && (
              <div
                className={`docs-heading-block align-${block.align || "left"}`}
              >
                {isAdmin && (
                  <div className="docs-heading-settings">
                    <select
                      value={block.level || 2}
                      onChange={(event) =>
                        updateBlock(block.id, {
                          level: Number(event.target.value),
                        })
                      }
                    >
                      <option value="2">Heading 2</option>
                      <option value="3">Heading 3</option>
                      <option value="4">Heading 4</option>
                    </select>
                    <button
                      className={block.align === "left" ? "active" : ""}
                      onClick={() => updateBlock(block.id, { align: "left" })}
                    >
                      <AlignLeft size={14} />
                    </button>
                    <button
                      className={block.align === "center" ? "active" : ""}
                      onClick={() => updateBlock(block.id, { align: "center" })}
                    >
                      <AlignCenter size={14} />
                    </button>
                    <button
                      className={block.align === "right" ? "active" : ""}
                      onClick={() => updateBlock(block.id, { align: "right" })}
                    >
                      <AlignRight size={14} />
                    </button>
                  </div>
                )}
                {block.level === 2 ? (
                  <h2
                    {...editableProps(isAdmin, (event) =>
                      updateBlock(block.id, {
                        text: event.currentTarget.innerText,
                      }),
                    )}
                  >
                    {block.text}
                  </h2>
                ) : block.level === 3 ? (
                  <h3
                    {...editableProps(isAdmin, (event) =>
                      updateBlock(block.id, {
                        text: event.currentTarget.innerText,
                      }),
                    )}
                  >
                    {block.text}
                  </h3>
                ) : (
                  <h4
                    {...editableProps(isAdmin, (event) =>
                      updateBlock(block.id, {
                        text: event.currentTarget.innerText,
                      }),
                    )}
                  >
                    {block.text}
                  </h4>
                )}
              </div>
            )}
            {(block.type === "body" || block.type === "points") && (
              <RichTextBlock
                block={block}
                isAdmin={isAdmin}
                onChange={(html) => updateBlock(block.id, { html })}
                onPasteImage={(file) => addPastedImage(block.id, file)}
              />
            )}
            {block.type === "media" && (
              <MediaBlock
                block={block}
                isAdmin={isAdmin}
                onFile={(file) => attachFile(block.id, file)}
                onUpdate={(changes) => updateBlock(block.id, changes)}
              />
            )}
            {block.type === "embed-video" && (
              <EmbedVideoBlock
                block={block}
                isAdmin={isAdmin}
                onUpdate={(changes) => updateBlock(block.id, changes)}
              />
            )}
          </section>
        ))}
      </div>
      {isAdmin && (
        <button className="docs-add-block" onClick={openPicker}>
          <Plus size={18} />
          <span>
            <strong>Add section</strong>
            <small>
              Heading, rich text, points, image, video or attachment
            </small>
          </span>
        </button>
      )}
    </>
  );
}

export default function DocumentationPortal() {
  const queryParams = new URLSearchParams(window.location.search);
  const requestedCode = queryParams.get("code");
  const resolvedKnowledgeBase = requestedCode
    ? getKnowledgeBaseByCode(requestedCode)
    : getKnowledgeBase(queryParams.get("kb") || defaultKnowledgeBase.id);
  const knowledgeBase = resolvedKnowledgeBase || {
    ...defaultKnowledgeBase,
    id: "invalid",
    name: "Documentation not found",
    viewAccess: "no-one",
    editAccess: "no-one",
  };
  const knowledgeBaseId = knowledgeBase.id;
  const navigationStorageKey = kbStorageKey(knowledgeBaseId, "navigation");
  const documentsStorageKey = kbStorageKey(knowledgeBaseId, "documents");
  const mayView = canAccess(knowledgeBase.viewAccess, knowledgeBase.viewers);
  const mayEdit = canAccess(knowledgeBase.editAccess, knowledgeBase.editors);
  const [isAdmin, setIsAdmin] = useState(() =>
    queryParams.get("mode") === "viewer" ? false : mayEdit,
  );
  const [modules, setModules] = useState(() => {
    const fallback =
      knowledgeBaseId === defaultKnowledgeBase.id ? initialModules : [];
    try {
      return normalizeModules(
        JSON.parse(localStorage.getItem(navigationStorageKey)) || fallback,
      );
    } catch {
      return normalizeModules(fallback);
    }
  });
  const [documents, setDocuments] = useState(() => {
    const fallback =
      knowledgeBaseId === defaultKnowledgeBase.id
        ? {
            "Student management::Student profile":
              JSON.parse(localStorage.getItem("dc-doc-student-profile")) ||
              initialDoc,
          }
        : {};
    try {
      return JSON.parse(localStorage.getItem(documentsStorageKey)) || fallback;
    } catch {
      return fallback;
    }
  });
  const firstModule = modules.find((module) => module.items.length);
  const initialModuleName = firstModule?.name || "Documentation";
  const initialPageName = firstModule?.items[0] || knowledgeBase.name;
  const [activePage, setActivePage] = useState({
    module: initialModuleName,
    page: initialPageName,
    path: [initialPageName],
  });
  const activeKey = `${activePage.module}::${(activePage.path || [activePage.page]).join(" / ")}`;
  const [doc, setDoc] = useState(
    documents[activeKey] ||
      (knowledgeBaseId === defaultKnowledgeBase.id
        ? initialDoc
        : { title: knowledgeBase.name, blankPage: true, blocks: [] }),
  );
  const [draft, setDraft] = useState(doc);
  const [openModules, setOpenModules] = useState(
    firstModule ? [firstModule.name] : [],
  );
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [saved, setSaved] = useState(false);
  const [navEditor, setNavEditor] = useState(null);
  const [navName, setNavName] = useState("");
  const [navError, setNavError] = useState("");
  const [blockPicker, setBlockPicker] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (isAdmin) return undefined;
    const stop = (event) => event.preventDefault();
    const keys = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        ["c", "x", "a", "s", "p"].includes(event.key.toLowerCase())
      )
        event.preventDefault();
      if (event.key === "PrintScreen") {
        event.preventDefault();
        navigator.clipboard?.writeText(
          "Protected Digital Campus documentation",
        );
      }
    };
    document.addEventListener("copy", stop);
    document.addEventListener("cut", stop);
    document.addEventListener("contextmenu", stop);
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("copy", stop);
      document.removeEventListener("cut", stop);
      document.removeEventListener("contextmenu", stop);
      document.removeEventListener("keydown", keys);
    };
  }, [isAdmin]);

  const filteredModules = useMemo(
    () =>
      modules.filter(
        (module) =>
          !query ||
          module.name.toLowerCase().includes(query.toLowerCase()) ||
          flattenModulePages(module).some(({ page }) =>
            page.toLowerCase().includes(query.toLowerCase()),
          ),
      ),
    [query, modules],
  );
  const globalResults = useMemo(() => {
    const term = globalQuery.trim().toLowerCase();
    if (term.length < 2) return [];
    return modules
      .flatMap((module) =>
        flattenModulePages(module).flatMap(({ page, path }) =>
          searchableEntries(
            module.name,
            path.join(" → "),
            documents[`${module.name}::${path.join(" / ")}`] ||
              (module.name === "Student management" &&
              page === "Student profile" &&
              path.length === 1
                ? initialDoc
                : { title: page, blankPage: true, blocks: [] }),
          ).map((entry) => ({ ...entry, pageName: page, pagePath: path })),
        ),
      )
      .filter((entry) =>
        `${entry.module} ${entry.page} ${entry.label} ${entry.text}`
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 20);
  }, [globalQuery, modules, documents]);
  const update = (key) => (event) =>
    setDraft((value) => ({
      ...value,
      [key]: event.currentTarget.innerText,
      meta: editStamp(),
    }));
  const updateField = (index, column) => (event) =>
    setDraft((value) => ({
      ...value,
      fields: value.fields.map((row, rowIndex) =>
        rowIndex === index
          ? row.map((cell, cellIndex) =>
              cellIndex === column ? event.currentTarget.innerText : cell,
            )
          : row,
      ),
      meta: editStamp(),
    }));
  const save = () => {
    const publishedDraft = { ...draft, meta: editStamp() };
    const nextDocuments = { ...documents, [activeKey]: publishedDraft };
    setDoc(publishedDraft);
    setDraft(publishedDraft);
    setDocuments(nextDocuments);
    localStorage.setItem(documentsStorageKey, JSON.stringify(nextDocuments));
    localStorage.setItem(navigationStorageKey, JSON.stringify(modules));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };
  const toggleModule = (name) =>
    setOpenModules((value) =>
      value.includes(name)
        ? value.filter((item) => item !== name)
        : [...value, name],
    );
  const selectPage = (module, page, path = [page]) => {
    const key = `${module}::${path.join(" / ")}`;
    const selectedDoc = documents[key] || {
      title: page,
      blankPage: true,
      blocks: [],
    };
    setActivePage({ module, page, path });
    setDoc(selectedDoc);
    setDraft(selectedDoc);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openNavEditor = (type, module = "", parentPath = []) => {
    setNavName("");
    setNavError("");
    setNavEditor({ type, module, parentPath });
  };
  const addNavigationItem = () => {
    const name = navName.trim();
    if (!name) {
      setNavError("Enter a name to continue.");
      return;
    }
    if (navEditor.type === "module") {
      if (
        modules.some(
          (module) => module.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        setNavError("A module with this name already exists.");
        return;
      }
      const next = [...modules, { name, items: [], children: {} }];
      setModules(next);
      setOpenModules((value) => [...value, name]);
      localStorage.setItem(navigationStorageKey, JSON.stringify(next));
    } else {
      const parent = modules.find((module) => module.name === navEditor.module);
      const siblings = navEditor.parentPath.length
        ? childPages(parent, navEditor.parentPath)
        : parent?.items || [];
      if (siblings.some((item) => item.toLowerCase() === name.toLowerCase())) {
        setNavError("A page with this name already exists at this level.");
        return;
      }
      const next = modules.map((module) => {
        if (module.name !== navEditor.module) return module;
        if (!navEditor.parentPath.length)
          return { ...module, items: [...module.items, name] };
        const pathKey = navEditor.parentPath.join(" / ");
        return {
          ...module,
          children: {
            ...(module.children || {}),
            [pathKey]: [...childPages(module, navEditor.parentPath), name],
          },
        };
      });
      setModules(next);
      setOpenModules((value) =>
        value.includes(navEditor.module) ? value : [...value, navEditor.module],
      );
      localStorage.setItem(navigationStorageKey, JSON.stringify(next));
      const newPath = [...navEditor.parentPath, name];
      setOpenModules((value) => [
        ...new Set([
          ...value,
          `${navEditor.module}::${navEditor.parentPath.join(" / ")}`,
        ]),
      ]);
      window.setTimeout(() => selectPage(navEditor.module, name, newPath), 0);
    }
    setNavEditor(null);
    setNavName("");
  };
  const addContentSection = () =>
    setDraft((value) => ({
      ...value,
      customSections: [
        ...(value.customSections || []),
        {
          id: crypto.randomUUID?.() || String(Date.now()),
          title: "New section",
          body: "Write the documentation for this section here.",
        },
      ],
    }));
  const updateContentSection = (id, key) => (event) =>
    setDraft((value) => ({
      ...value,
      customSections: (value.customSections || []).map((section) =>
        section.id === id
          ? { ...section, [key]: event.currentTarget.innerText }
          : section,
      ),
    }));
  const removeContentSection = (id) =>
    setDraft((value) => ({
      ...value,
      customSections: (value.customSections || []).filter(
        (section) => section.id !== id,
      ),
    }));
  const addBlock = (type, extra = {}) => {
    const block = {
      id: crypto.randomUUID?.() || String(Date.now()),
      type,
      ...extra,
      meta: editStamp(),
    };
    if (type === "heading")
      Object.assign(block, { level: 2, text: "New heading", align: "left" });
    if (type === "body") Object.assign(block, { html: "" });
    if (type === "points")
      Object.assign(block, { html: "<ul><li>Add your first point</li></ul>" });
    if (type === "media")
      Object.assign(block, {
        kind: extra.kind || "image",
        assetId: "",
        name: "",
        mime: "",
        size: 0,
        align: "center",
        width: 100,
        cropAspect: "original",
        zoom: 1,
        cropX: 50,
        cropY: 50,
      });
    if (type === "embed-video")
      Object.assign(block, { embedCode: "", align: "center", width: 100 });
    setDraft((value) => ({
      ...value,
      blocks: [...(value.blocks || []), block],
    }));
    setBlockPicker(false);
  };
  const updateBlock = (id, changes) =>
    setDraft((value) => ({
      ...value,
      blocks: (value.blocks || []).map((block) =>
        block.id === id ? { ...block, ...changes, meta: editStamp() } : block,
      ),
      meta: editStamp(),
    }));
  const requestDelete = (request) => {
    setDeletePassword("");
    setDeleteError("");
    setDeleteRequest(request);
  };
  const confirmDelete = () => {
    if (deletePassword !== DELETE_PASSWORD) {
      setDeleteError("Incorrect administrator password. Nothing was deleted.");
      return;
    }
    if (deleteRequest.type === "block")
      setDraft((value) => ({
        ...value,
        blocks: (value.blocks || []).filter(
          (block) => block.id !== deleteRequest.id,
        ),
        meta: editStamp(),
      }));
    if (deleteRequest.type === "field")
      setDraft((value) => ({
        ...value,
        fields: (value.fields || []).filter(
          (_, index) => index !== deleteRequest.index,
        ),
        meta: editStamp(),
      }));
    if (deleteRequest.type === "structured-section")
      setDraft((value) => ({
        ...value,
        hiddenSections: [
          ...new Set([...(value.hiddenSections || []), deleteRequest.section]),
        ],
        meta: editStamp(),
      }));
    if (deleteRequest.type === "custom-section")
      setDraft((value) => ({
        ...value,
        customSections: (value.customSections || []).filter(
          (section) => section.id !== deleteRequest.id,
        ),
        meta: editStamp(),
      }));
    if (deleteRequest.type === "page") {
      const path = deleteRequest.path || [deleteRequest.page];
      const pathKey = path.join(" / ");
      const parentPath = path.slice(0, -1);
      const key = `${deleteRequest.module}::${pathKey}`;
      const nextModules = modules.map((module) => {
        if (module.name !== deleteRequest.module) return module;
        if (!parentPath.length)
          return {
            ...module,
            items: module.items.filter((page) => page !== deleteRequest.page),
            children: Object.fromEntries(
              Object.entries(module.children || {}).filter(
                ([childKey]) =>
                  childKey !== pathKey && !childKey.startsWith(`${pathKey} /`),
              ),
            ),
          };
        const parentKey = parentPath.join(" / ");
        return {
          ...module,
          children: Object.fromEntries(
            Object.entries({
              ...(module.children || {}),
              [parentKey]: childPages(module, parentPath).filter(
                (page) => page !== deleteRequest.page,
              ),
            }).filter(
              ([childKey]) =>
                childKey !== pathKey && !childKey.startsWith(`${pathKey} /`),
            ),
          ),
        };
      });
      const nextDocuments = Object.fromEntries(
        Object.entries(documents).filter(
          ([docKey]) => docKey !== key && !docKey.startsWith(`${key} /`),
        ),
      );
      setModules(nextModules);
      setDocuments(nextDocuments);
      localStorage.setItem(navigationStorageKey, JSON.stringify(nextModules));
      localStorage.setItem(documentsStorageKey, JSON.stringify(nextDocuments));
      if (activeKey === key || activeKey.startsWith(`${key} /`)) {
        const fallbackModule = nextModules.find(
          (module) => module.items.length,
        );
        if (fallbackModule)
          selectPage(fallbackModule.name, fallbackModule.items[0], [
            fallbackModule.items[0],
          ]);
      }
    }
    if (deleteRequest.type === "module") {
      const nextModules = modules.filter(
        (module) => module.name !== deleteRequest.module,
      );
      const nextDocuments = Object.fromEntries(
        Object.entries(documents).filter(
          ([key]) => !key.startsWith(`${deleteRequest.module}::`),
        ),
      );
      setModules(nextModules);
      setDocuments(nextDocuments);
      localStorage.setItem(navigationStorageKey, JSON.stringify(nextModules));
      localStorage.setItem(documentsStorageKey, JSON.stringify(nextDocuments));
      if (activePage.module === deleteRequest.module) {
        const fallbackModule = nextModules.find(
          (module) => module.items.length,
        );
        if (fallbackModule)
          selectPage(fallbackModule.name, fallbackModule.items[0]);
      }
    }
    setDeleteRequest(null);
    setDeletePassword("");
  };
  const attachFile = async (id, file) => {
    const assetId = await storeAsset(file);
    updateBlock(id, {
      assetId,
      name: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
    });
  };
  const addPastedImage = async (afterId, file) => {
    const assetId = await storeAsset(file);
    const block = {
      id: crypto.randomUUID?.() || String(Date.now()),
      type: "media",
      kind: "image",
      assetId,
      name: file.name || "Pasted image",
      mime: file.type,
      size: file.size,
      align: "center",
      width: 100,
      cropAspect: "original",
      zoom: 1,
      cropX: 50,
      cropY: 50,
      meta: editStamp(),
    };
    setDraft((value) => {
      const blocks = [...(value.blocks || [])];
      const index = blocks.findIndex((item) => item.id === afterId);
      blocks.splice(index + 1, 0, block);
      return { ...value, blocks };
    });
  };
  const openSearchResult = (result) => {
    selectPage(
      result.module,
      result.pageName || result.page,
      result.pagePath || [result.page],
    );
    setGlobalSearchOpen(false);
    window.setTimeout(
      () =>
        document
          .getElementById(result.anchor)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      120,
    );
  };
  const closeKnowledgeBase = () => {
    const hasUnpublishedChanges =
      isAdmin && JSON.stringify(draft) !== JSON.stringify(doc);
    if (
      hasUnpublishedChanges &&
      !window.confirm(
        "You have unpublished changes on this page. Close the Documentation and discard them?",
      )
    )
      return;
    window.dispatchEvent(
      new CustomEvent("digital-campus:knowledge-base-close"),
    );
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "digital-campus:knowledge-base-close" },
        "*",
      );
      return;
    }
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  };
  const renderPageTree = (module, pages, parentPath = [], depth = 0) =>
    pages.map((page) => {
      const path = [...parentPath, page];
      const pathKey = `${module.name}::${path.join(" / ")}`;
      const children = childPages(module, path);
      const expanded =
        openModules.includes(pathKey) ||
        (activePage.module === module.name &&
          (activePage.path || []).slice(0, path.length).join(" / ") ===
            path.join(" / "));
      return (
        <div className="docs-page-branch" key={path.join(" / ")}>
          <span
            className="docs-page-row"
            style={{ paddingLeft: `${depth * 15}px` }}
          >
            {children.length ? (
              <button
                className="docs-page-toggle"
                onClick={() =>
                  setOpenModules((value) =>
                    value.includes(pathKey)
                      ? value.filter((item) => item !== pathKey)
                      : [...value, pathKey],
                  )
                }
                aria-label={`${expanded ? "Collapse" : "Expand"} ${page}`}
              >
                {expanded ? (
                  <ChevronDown size={13} />
                ) : (
                  <ChevronRight size={13} />
                )}
              </button>
            ) : (
              <i className="docs-page-spacer" />
            )}
            <button
              onClick={() => selectPage(module.name, page, path)}
              className={`docs-page-link ${module.name === activePage.module && (activePage.path || []).join(" / ") === path.join(" / ") ? "active" : ""}`}
            >
              <FileText size={14} />
              {page}
            </button>
            {isAdmin && (
              <span className="docs-page-actions">
                <button
                  title={`Add subpage under ${page}`}
                  onClick={() => openNavEditor("page", module.name, path)}
                >
                  <Plus size={13} />
                </button>
                <button
                  className="danger"
                  title={`Delete ${page}`}
                  onClick={() =>
                    requestDelete({
                      type: "page",
                      module: module.name,
                      page,
                      path,
                      label: `${page} page and all of its subpages and content`,
                    })
                  }
                >
                  <Trash2 size={13} />
                </button>
              </span>
            )}
          </span>
          {children.length > 0 && expanded && (
            <div className="docs-subpage-tree">
              {renderPageTree(module, children, path, depth + 1)}
            </div>
          )}
        </div>
      );
    });

  if ((!isAdmin && !mayView) || (isAdmin && !mayEdit))
    return (
      <div className="docs-access-denied">
        <div>
          <LockKeyhole size={34} />
          <span>ACCESS RESTRICTED</span>
          <h1>{knowledgeBase.name}</h1>
          <p>
            You do not currently have permission to {isAdmin ? "edit" : "view"}{" "}
            this Documentation. Contact its administrator if you need access.
          </p>
          <a href="/">Return to Digital Campus</a>
        </div>
      </div>
    );

  return (
    <div className={`docs-app ${isAdmin ? "admin-mode" : "viewer-mode"}`}>
      <header className="docs-topbar">
        <button
          className="docs-mobile-menu"
          onClick={() => setMobileNav(true)}
          aria-label="Open navigation"
        >
          <Menu size={21} />
        </button>
        <a
          className="docs-brand"
          href={`/documentation?kb=${knowledgeBaseId}&mode=${isAdmin ? "admin" : "viewer"}`}
        >
          <span>dc</span>
          <strong>Digital Campus</strong>
          <small>{knowledgeBase.name.toUpperCase()}</small>
        </a>
        <div className="docs-global-search">
          <Search size={16} />
          <input
            value={globalQuery}
            onFocus={() => setGlobalSearchOpen(true)}
            onChange={(event) => {
              setGlobalQuery(event.target.value);
              setGlobalSearchOpen(true);
            }}
            placeholder="Search all modules, pages and content…"
            aria-label="Search all documentation"
          />
          {globalQuery && (
            <button
              onClick={() => setGlobalQuery("")}
              aria-label="Clear global search"
            >
              <X size={15} />
            </button>
          )}
          {globalSearchOpen && globalQuery.trim().length >= 2 && (
            <div className="docs-global-results">
              <header>
                <strong>Search results</strong>
                <span>
                  {globalResults.length} match
                  {globalResults.length === 1 ? "" : "es"}
                </span>
              </header>
              {globalResults.length ? (
                globalResults.map((result, index) => (
                  <button
                    key={`${result.module}-${result.page}-${result.anchor}-${index}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => openSearchResult(result)}
                  >
                    <Search size={14} />
                    <span>
                      <small>
                        {result.module} <ChevronRight size={10} /> {result.page}{" "}
                        <ChevronRight size={10} /> {result.label}
                      </small>
                      <strong>
                        {result.text.length > 105
                          ? `${result.text.slice(0, 105)}…`
                          : result.text}
                      </strong>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))
              ) : (
                <div className="docs-no-results">
                  <FileText size={20} />
                  <span>
                    <strong>No matching documentation</strong>
                    <small>
                      Try another keyword or publish the page content first.
                    </small>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="docs-role-switch" aria-label="Preview access role">
          <button
            disabled={!mayEdit}
            title={!mayEdit ? "You do not have edit access" : ""}
            className={isAdmin ? "active" : ""}
            onClick={() => mayEdit && setIsAdmin(true)}
          >
            <Pencil size={14} /> Admin
          </button>
          <button
            disabled={!mayView}
            title={!mayView ? "You do not have view access" : ""}
            className={!isAdmin ? "active" : ""}
            onClick={() => mayView && setIsAdmin(false)}
          >
            <Eye size={14} /> Viewer
          </button>
        </div>
        <div className="docs-user">
          <span>KS</span>
          <div>
            <strong>K. Srikanth</strong>
            <small>
              {isAdmin ? "Documentation admin" : "Read-only viewer"}
            </small>
          </div>
        </div>
        {isAdmin && (
          <a
            className="docs-manage-kb"
            href="/documentation-management"
            title="Manage Documentation"
          >
            <Settings2 size={16} />
            <span>Configure</span>
          </a>
        )}
        <button
          className="docs-close-portal"
          onClick={closeKnowledgeBase}
          title="Close Documentation"
        >
          <X size={17} />
          <span>Close</span>
        </button>
      </header>

      <aside className={`docs-sidebar ${mobileNav ? "open" : ""}`}>
        <div className="docs-sidebar-head">
          <strong>Knowledge sections</strong>
          <div>
            {isAdmin && (
              <button
                className="docs-add-module"
                onClick={() => openNavEditor("module")}
                title="Add section"
              >
                <Plus size={16} />
              </button>
            )}
            <button
              className="docs-close-nav"
              onClick={() => setMobileNav(false)}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <label className="docs-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documentation"
          />
        </label>
        <nav>
          {filteredModules.map((module) => (
            <div className="docs-module" key={module.name}>
              <button
                className={
                  module.name === activePage.module ? "current-group" : ""
                }
                onClick={() => toggleModule(module.name)}
              >
                {openModules.includes(module.name) ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
                <span>{module.name}</span>
                {isAdmin && (
                  <span className="docs-module-actions">
                    <i
                      role="button"
                      tabIndex="0"
                      title={`Add page to ${module.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openNavEditor("page", module.name);
                      }}
                    >
                      <Plus size={14} />
                    </i>
                    <i
                      className="danger"
                      role="button"
                      tabIndex="0"
                      title={`Delete ${module.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        requestDelete({
                          type: "module",
                          module: module.name,
                          label: `${module.name} module and all of its pages`,
                        });
                      }}
                    >
                      <Trash2 size={13} />
                    </i>
                  </span>
                )}
              </button>
              {(openModules.includes(module.name) || query) && (
                <div>
                  {renderPageTree(module, module.items)}
                  {isAdmin && module.items.length === 0 && (
                    <button
                      className="docs-empty-page"
                      onClick={() => openNavEditor("page", module.name)}
                    >
                      <Plus size={14} />
                      Add the first page
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="docs-security-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Protected content</strong>
            <small>Access and changes are recorded.</small>
          </div>
        </div>
      </aside>

      {mobileNav && (
        <button
          className="docs-mobile-scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="docs-main">
        <div className="docs-breadcrumb">
          <span>{activePage.module}</span>
          {(activePage.path || [activePage.page]).map((item, index) => (
            <span className="docs-breadcrumb-level" key={`${item}-${index}`}>
              <ChevronRight size={14} />
              {index === (activePage.path || [activePage.page]).length - 1 ? (
                <strong>{item}</strong>
              ) : (
                <span>{item}</span>
              )}
            </span>
          ))}
        </div>
        <div className="docs-layout">
          <article className="docs-article">
            {draft.blankPage ? (
              <BlankPageEditor
                draft={draft}
                isAdmin={isAdmin}
                updateTitle={update("title")}
                updateBlock={updateBlock}
                requestDelete={requestDelete}
                attachFile={attachFile}
                addPastedImage={addPastedImage}
                openPicker={() => setBlockPicker(true)}
              />
            ) : (
              <>
                <section id="overview" className="docs-hero">
                  <div className="docs-kicker">
                    <span>{activePage.module.toUpperCase()}</span>
                    <span>Last updated {displayStamp(draft.meta)}</span>
                  </div>
                  <h1 {...editableProps(isAdmin, update("title"))}>
                    {draft.title}
                  </h1>
                  <p {...editableProps(isAdmin, update("summary"))}>
                    {draft.summary}
                  </p>
                  <div className="docs-status">
                    <span>
                      <Check size={13} /> Published
                    </span>
                    <span>Version 2.4</span>
                    {isAdmin && (
                      <span className="editing">
                        <Pencil size={12} /> Editing enabled
                      </span>
                    )}
                  </div>
                </section>

                {!isAdmin && (
                  <div className="docs-protection-banner">
                    <LockKeyhole size={17} />
                    <div>
                      <strong>Read-only protected document</strong>
                      <span>
                        Copying, downloading and printing are restricted. Your
                        identity is watermarked on this page.
                      </span>
                    </div>
                  </div>
                )}

                {!(draft.hiddenSections || []).includes("purpose") && (
                  <section id="purpose" className="docs-section">
                    <div className="docs-protected-section-title">
                      <h2>Purpose</h2>
                      {isAdmin && (
                        <button
                          onClick={() =>
                            requestDelete({
                              type: "structured-section",
                              section: "purpose",
                              label: "Purpose section",
                            })
                          }
                        >
                          <Trash2 size={14} />
                          Delete section
                        </button>
                      )}
                    </div>
                    <p {...editableProps(isAdmin, update("purpose"))}>
                      {draft.purpose}
                    </p>
                  </section>
                )}
                {!(draft.hiddenSections || []).includes("navigation") && (
                  <section id="navigation" className="docs-section">
                    <div className="docs-protected-section-title">
                      <h2>Navigation path</h2>
                      {isAdmin && (
                        <button
                          onClick={() =>
                            requestDelete({
                              type: "structured-section",
                              section: "navigation",
                              label: "Navigation path section",
                            })
                          }
                        >
                          <Trash2 size={14} />
                          Delete section
                        </button>
                      )}
                    </div>
                    <div
                      className="docs-path"
                      {...editableProps(isAdmin, update("navigation"))}
                    >
                      {draft.navigation}
                    </div>
                  </section>
                )}
                {!(draft.hiddenSections || []).includes("fields") && (
                  <section id="fields" className="docs-section">
                    <div className="docs-section-title">
                      <div>
                        <h2>Fields & controls</h2>
                        <p>Details displayed on this screen.</p>
                      </div>
                      {isAdmin && (
                        <div className="docs-section-actions">
                          <button
                            onClick={() =>
                              setDraft((value) => ({
                                ...value,
                                fields: [
                                  ...value.fields,
                                  [
                                    "New field",
                                    "Type",
                                    "Add the field description.",
                                  ],
                                ],
                                meta: editStamp(),
                              }))
                            }
                          >
                            + Add field
                          </button>
                          <button
                            className="danger"
                            onClick={() =>
                              requestDelete({
                                type: "structured-section",
                                section: "fields",
                                label:
                                  "Fields & controls section and all field rows",
                              })
                            }
                          >
                            <Trash2 size={14} />
                            Delete section
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="docs-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Field name</th>
                            <th>Type</th>
                            <th>Description</th>
                            {isAdmin && (
                              <th className="docs-field-action-head">Action</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {draft.fields.map((row, index) => (
                            <tr id={`field-${index}`} key={index}>
                              {row.map((cell, column) => (
                                <td
                                  key={column}
                                  {...editableProps(
                                    isAdmin,
                                    updateField(index, column),
                                  )}
                                >
                                  {cell}
                                </td>
                              ))}
                              {isAdmin && (
                                <td className="docs-field-action">
                                  <button
                                    onClick={() =>
                                      requestDelete({
                                        type: "field",
                                        index,
                                        label: `${row[0]} field`,
                                      })
                                    }
                                    title={`Delete ${row[0]}`}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
                {!(draft.hiddenSections || []).includes("permissions") && (
                  <section id="permissions" className="docs-section">
                    <div className="docs-protected-section-title">
                      <h2>Permissions & business rules</h2>
                      {isAdmin && (
                        <button
                          onClick={() =>
                            requestDelete({
                              type: "structured-section",
                              section: "permissions",
                              label: "Permissions & business rules section",
                            })
                          }
                        >
                          <Trash2 size={14} />
                          Delete section
                        </button>
                      )}
                    </div>
                    <div className="docs-callout">
                      <ShieldCheck size={20} />
                      <p {...editableProps(isAdmin, update("rules"))}>
                        {draft.rules}
                      </p>
                    </div>
                  </section>
                )}
                {(draft.customSections || []).map((section) => (
                  <section
                    id={`custom-${section.id}`}
                    className="docs-section docs-custom-section"
                    key={section.id}
                  >
                    <div className="docs-custom-section-head">
                      <h2
                        {...editableProps(
                          isAdmin,
                          updateContentSection(section.id, "title"),
                        )}
                      >
                        {section.title}
                      </h2>
                      {isAdmin && (
                        <button
                          onClick={() =>
                            requestDelete({
                              type: "custom-section",
                              id: section.id,
                              label: `${section.title} section`,
                            })
                          }
                          title="Delete section"
                          aria-label={`Delete ${section.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    <div
                      className="docs-freeform"
                      {...editableProps(
                        isAdmin,
                        updateContentSection(section.id, "body"),
                      )}
                    >
                      {section.body}
                    </div>
                  </section>
                ))}
                {isAdmin && (
                  <button
                    className="docs-add-section"
                    onClick={addContentSection}
                  >
                    <Plus size={16} />
                    <span>
                      <strong>Add content section</strong>
                      <small>
                        Create another editable heading and content area for
                        this page.
                      </small>
                    </span>
                  </button>
                )}
                {!(draft.hiddenSections || []).includes("history") && (
                  <section id="history" className="docs-section">
                    <div className="docs-protected-section-title">
                      <h2>Version history</h2>
                      {isAdmin && (
                        <button
                          onClick={() =>
                            requestDelete({
                              type: "structured-section",
                              section: "history",
                              label: "Version history section",
                            })
                          }
                        >
                          <Trash2 size={14} />
                          Delete section
                        </button>
                      )}
                    </div>
                    <div className="docs-history">
                      <span>v2.4</span>
                      <div>
                        <strong>
                          Student profile fields and permissions updated
                        </strong>
                        <small>18 Aug 2026 · K. Srikanth</small>
                      </div>
                      <span>Current</span>
                    </div>
                    <div className="docs-history">
                      <span>v2.3</span>
                      <div>
                        <strong>Academic history guidance added</strong>
                        <small>02 Aug 2026 · Priya Nair</small>
                      </div>
                      <span>Published</span>
                    </div>
                  </section>
                )}
              </>
            )}
          </article>
        </div>
      </main>

      {isAdmin && (
        <div className="docs-editor-bar">
          <div>
            <Pencil size={16} />
            <span>
              <strong>Editing {activePage.page}</strong>
              <small>Changes are saved as a local draft until published.</small>
            </span>
          </div>
          <button className="secondary" onClick={() => setDraft(doc)}>
            Discard
          </button>
          <button className="primary" onClick={save}>
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? "Saved" : "Save & publish"}
          </button>
        </div>
      )}
      {navEditor && (
        <div
          className="docs-nav-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setNavEditor(null)
          }
        >
          <section
            className="docs-nav-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="docs-nav-modal-title"
          >
            <header>
              <div>
                <h2 id="docs-nav-modal-title">
                  {navEditor.type === "module"
                    ? "Add ERP module"
                    : navEditor.parentPath.length
                      ? "Add subpage"
                      : "Add documentation page"}
                </h2>
                <p>
                  {navEditor.type === "module"
                    ? "Create a new section in the left navigation."
                    : navEditor.parentPath.length
                      ? `This subpage will be added under ${navEditor.parentPath.join(" → ")}.`
                      : `This page will be added under ${navEditor.module}.`}
                </p>
              </div>
              <button onClick={() => setNavEditor(null)} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <label>
              {navEditor.type === "module"
                ? "Module name"
                : navEditor.parentPath.length
                  ? "Subpage name"
                  : "Page name"}
              <input
                autoFocus
                value={navName}
                onChange={(event) => {
                  setNavName(event.target.value);
                  setNavError("");
                }}
                onKeyDown={(event) =>
                  event.key === "Enter" && addNavigationItem()
                }
                placeholder={
                  navEditor.type === "module"
                    ? "e.g. Library management"
                    : navEditor.parentPath.length
                      ? "e.g. Eligibility rules"
                      : "e.g. Book issue"
                }
              />
              {navError && <span className="docs-nav-error">{navError}</span>}
            </label>
            <footer>
              <button className="secondary" onClick={() => setNavEditor(null)}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={!navName.trim()}
                onClick={addNavigationItem}
              >
                <Plus size={15} />
                {navEditor.type === "module"
                  ? "Add module"
                  : navEditor.parentPath.length
                    ? "Add subpage"
                    : "Add page"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {blockPicker && (
        <div
          className="docs-nav-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setBlockPicker(false)
          }
        >
          <section
            className="docs-block-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="block-picker-title"
          >
            <header>
              <div>
                <h2 id="block-picker-title">Add a section</h2>
                <p>
                  Choose the content type. You can keep adding sections in any
                  order.
                </p>
              </div>
              <button onClick={() => setBlockPicker(false)} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div className="docs-block-options">
              <button onClick={() => addBlock("heading")}>
                <Heading size={20} />
                <span>
                  <strong>Heading</strong>
                  <small>Section title with level and alignment</small>
                </span>
              </button>
              <button onClick={() => addBlock("body")}>
                <FileText size={20} />
                <span>
                  <strong>Rich text body</strong>
                  <small>
                    Formatted paragraphs, lists, links and alignment
                  </small>
                </span>
              </button>
              <button onClick={() => addBlock("points")}>
                <List size={20} />
                <span>
                  <strong>Points or steps</strong>
                  <small>Bulleted or numbered instructions</small>
                </span>
              </button>
              <button onClick={() => addBlock("media", { kind: "image" })}>
                <FileImage size={20} />
                <span>
                  <strong>Image</strong>
                  <small>Upload or preview a reference screenshot</small>
                </span>
              </button>
              <button onClick={() => addBlock("media", { kind: "video" })}>
                <Video size={20} />
                <span>
                  <strong>Video upload</strong>
                  <small>Upload and play a reference video</small>
                </span>
              </button>
              <button onClick={() => addBlock("embed-video")}>
                <MonitorPlay size={20} />
                <span>
                  <strong>Embed video</strong>
                  <small>Play from a URL or pasted iframe code</small>
                </span>
              </button>
              <button onClick={() => addBlock("media", { kind: "attachment" })}>
                <Paperclip size={20} />
                <span>
                  <strong>Attachment</strong>
                  <small>Display and download a supporting file</small>
                </span>
              </button>
            </div>
          </section>
        </div>
      )}
      {deleteRequest && (
        <div
          className="docs-nav-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setDeleteRequest(null)
          }
        >
          <section
            className="docs-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <header>
              <div className="docs-delete-icon">
                <Trash2 size={19} />
              </div>
              <div>
                <h2 id="delete-dialog-title">Confirm permanent deletion</h2>
                <p>This action cannot be undone.</p>
              </div>
              <button onClick={() => setDeleteRequest(null)} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div className="docs-delete-target">
              <small>You are deleting</small>
              <strong>{deleteRequest.label}</strong>
            </div>
            <label>
              Administrator password
              <input
                autoFocus
                type="password"
                value={deletePassword}
                onChange={(event) => {
                  setDeletePassword(event.target.value);
                  setDeleteError("");
                }}
                onKeyDown={(event) => event.key === "Enter" && confirmDelete()}
                placeholder="Enter your password"
              />
              {deleteError && <span>{deleteError}</span>}
            </label>
            <footer>
              <button
                className="secondary"
                onClick={() => setDeleteRequest(null)}
              >
                Cancel
              </button>
              <button
                className="danger"
                disabled={!deletePassword}
                onClick={confirmDelete}
              >
                <Trash2 size={14} />
                Delete permanently
              </button>
            </footer>
          </section>
        </div>
      )}
      {!isAdmin && (
        <div className="docs-watermarks" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <span key={index}>K. SRIKANTH · EMP-1008 · 18 AUG 2026</span>
          ))}
        </div>
      )}
      <div className="docs-toast" aria-live="polite">
        {saved && (
          <span>
            <Check size={15} /> Documentation published successfully
          </span>
        )}
      </div>
    </div>
  );
}
