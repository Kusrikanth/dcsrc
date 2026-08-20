import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock3,
  Eye,
  FileSpreadsheet,
  FileText,
  Files,
  History,
  Lock,
  Presentation,
  ShieldCheck,
  Trash2,
  Upload,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import { CURRENT_KB_USER } from "./documentation-store.js";
import {
  ACCEPT_ATTRIBUTE,
  ACCESS_RULES,
  MAX_FILE_BYTES,
  deleteSecureFile,
  evaluateAccess,
  formatBytes,
  getAuditTrail,
  getSecureFiles,
  isExpired,
  updateSecureFile,
  uploadSecureFile,
} from "./secure-files-store.js";
import SecureFileViewer from "./SecureFileViewer.jsx";
import "./secure-files.css";

/*
 * The provider screen. Owners upload here and decide, per file, who may open it
 * and whether that person may ever take a copy away. Everyone else sees only
 * the files they have been granted, with no route to the bytes but the viewer.
 */

const KIND_ICONS = {
  pdf: FileText,
  docx: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }) : "";
}

function parseEmails(value) {
  return [...new Set(
    value
      .split(/[\s,;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry)),
  )];
}

function AccessSummary({ record }) {
  if (record.status === "revoked")
    return (
      <span className="secure-chip is-danger">
        <Lock size={12} /> Revoked
      </span>
    );
  if (isExpired(record))
    return (
      <span className="secure-chip is-danger">
        <Clock3 size={12} /> Expired {formatDate(record.expiresAt)}
      </span>
    );
  if (record.viewAccess === "no-one")
    return (
      <span className="secure-chip is-danger">
        <Lock size={12} /> Locked
      </span>
    );
  if (record.viewAccess === "anyone")
    return (
      <span className="secure-chip">
        <Users size={12} /> Anyone in the organisation
      </span>
    );
  return (
    <span className="secure-chip">
      <UserRoundCheck size={12} /> {record.viewers?.length || 0} person
      {record.viewers?.length === 1 ? "" : "s"}
    </span>
  );
}

/* ------------------------------------------------------------ access form -- */

function AccessPanel({ record, onChange, onDelete, onClose }) {
  const [viewerText, setViewerText] = useState((record.viewers || []).join("\n"));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setViewerText((record.viewers || []).join("\n"));
    setConfirmDelete(false);
  }, [record.id]);

  /*
   * Committed on every keystroke rather than on blur. A grant that only saves
   * when the field happens to lose focus is a grant people think they made and
   * did not - the raw text stays in local state so typing still feels normal.
   */
  const commitViewers = (text) => {
    setViewerText(text);
    onChange({ viewers: parseEmails(text) });
  };

  return (
    <aside className="secure-access-panel">
      <header>
        <div>
          <strong>Access</strong>
          <small>{record.name}</small>
        </div>
        <button className="secure-icon" onClick={onClose} title="Close">
          <X size={16} />
        </button>
      </header>

      <section>
        <h4>Who can view this file</h4>
        {ACCESS_RULES.map((rule) => (
          <label key={rule.value} className="secure-radio">
            <input
              type="radio"
              name={`access-${record.id}`}
              checked={record.viewAccess === rule.value}
              onChange={() => onChange({ viewAccess: rule.value })}
            />
            <span>
              <b>{rule.label}</b>
              <small>{rule.hint}</small>
            </span>
          </label>
        ))}
      </section>

      {record.viewAccess === "specific" && (
        <section>
          <h4>Granted people</h4>
          <textarea
            rows={4}
            value={viewerText}
            placeholder={"priya@digitalcampus.edu\nravi@digitalcampus.edu"}
            onChange={(event) => commitViewers(event.target.value)}
          />
          <p className="secure-hint">
            One email per line. Access is saved as you type; anything that is
            not a valid address is ignored.
          </p>
          {record.viewers?.length > 0 && (
            <div className="secure-viewer-chips">
              {record.viewers.map((email) => (
                <span key={email}>{email}</span>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h4>Limits</h4>
        <label className="secure-field">
          <span>
            <CalendarClock size={14} /> Access expires on
          </span>
          <input
            type="date"
            value={record.expiresAt ? record.expiresAt.slice(0, 10) : ""}
            onChange={(event) =>
              onChange({
                expiresAt: event.target.value
                  ? new Date(`${event.target.value}T23:59:59`).toISOString()
                  : null,
              })
            }
          />
        </label>

        <label className="secure-toggle">
          <input
            type="checkbox"
            checked={Boolean(record.allowDownload)}
            onChange={(event) => onChange({ allowDownload: event.target.checked })}
          />
          <span>
            <b>Allow download</b>
            <small>
              Off by default, and it applies to everyone including you. Turning
              it on lets anyone with view access save the original file - the
              opposite of view-only.
            </small>
          </span>
        </label>

        <label className="secure-toggle">
          <input
            type="checkbox"
            checked={record.watermark !== false}
            onChange={(event) => onChange({ watermark: event.target.checked })}
          />
          <span>
            <b>Watermark with viewer identity</b>
            <small>
              Stamps the reader's email and the time across every page, so a
              screenshot carries its own source.
            </small>
          </span>
        </label>
      </section>

      <section className="secure-danger-zone">
        <h4>Revocation</h4>
        <p className="secure-hint">
          Revoking cuts off every recipient at once. You keep access as the
          owner - delete the file to remove it entirely.
        </p>
        <button
          className="secure-ghost"
          onClick={() =>
            onChange({ status: record.status === "revoked" ? "active" : "revoked" })
          }
        >
          {record.status === "revoked"
            ? "Restore access for recipients"
            : "Revoke access for everyone else"}
        </button>
        {confirmDelete ? (
          <div className="secure-confirm">
            <p>Delete this file and its access grants permanently?</p>
            <div>
              <button className="secure-danger" onClick={() => onDelete(record.id)}>
                Yes, delete
              </button>
              <button className="secure-ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="secure-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> Delete file
          </button>
        )}
      </section>

      <section>
        <h4>
          <History size={14} /> Activity
        </h4>
        <ul className="secure-audit">
          {getAuditTrail(record.id)
            .slice(0, 12)
            .map((entry, index) => (
              <li key={index}>
                <b>{entry.action.replace("-", " ")}</b>
                <span>{entry.by}</span>
                <small>{new Date(entry.at).toLocaleString()}</small>
              </li>
            ))}
          {getAuditTrail(record.id).length === 0 && <li>No activity yet.</li>}
        </ul>
      </section>
    </aside>
  );
}

/* ----------------------------------------------------------------- screen -- */

export default function SecureFileLibrary() {
  const queryParams = new URLSearchParams(window.location.search);
  const endUserMode = queryParams.get("mode") === "viewer";

  const [files, setFiles] = useState(() => getSecureFiles());
  const [openFileId, setOpenFileId] = useState(queryParams.get("file") || null);
  const [panelFileId, setPanelFileId] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  /*
   * Access rules are only convincing if you can see them bite. In provider mode
   * you can borrow another person's identity to check what they would get,
   * without needing a second login.
   */
  const [previewEmail, setPreviewEmail] = useState("");
  const inputRef = useRef(null);

  const identity = useMemo(
    () =>
      previewEmail
        ? { name: previewEmail.split("@")[0], email: previewEmail }
        : CURRENT_KB_USER,
    [previewEmail],
  );

  const refresh = useCallback(() => setFiles(getSecureFiles()), []);

  /*
   * While you are borrowing someone else's identity the list must show exactly
   * what they would see - otherwise the preview proves nothing. Only an owner
   * looking through their own eyes sees files they cannot open.
   */
  const simulating = endUserMode || Boolean(previewEmail);
  const rows = useMemo(
    () =>
      files
        .map((record) => ({ record, access: evaluateAccess(record, identity) }))
        .filter(({ access }) => !simulating || access.canView),
    [files, identity, simulating],
  );

  const handleFiles = useCallback(
    async (list) => {
      setUploadError("");
      setBusy(true);
      const failures = [];
      for (const file of [...list]) {
        try {
          /*
           * Sequential on purpose - each upload encrypts its own payload, and
           * running several AES passes over large decks at once stalls the UI.
           */
          await uploadSecureFile(file, { viewAccess: "specific", viewers: [] });
        } catch (cause) {
          failures.push(`${file.name}: ${cause.message}`);
        }
      }
      setBusy(false);
      refresh();
      if (failures.length) setUploadError(failures.join(" "));
    },
    [refresh],
  );

  const patch = useCallback(
    (id, changes) => {
      updateSecureFile(id, changes);
      refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id) => {
      await deleteSecureFile(id);
      setPanelFileId(null);
      if (openFileId === id) setOpenFileId(null);
      refresh();
    },
    [openFileId, refresh],
  );

  const panelRecord = files.find((record) => record.id === panelFileId);

  if (openFileId)
    return (
      <SecureFileViewer
        fileId={openFileId}
        user={identity}
        onClose={() => {
          setOpenFileId(null);
          refresh();
        }}
      />
    );

  return (
    <div className="secure-library">
      <header className="secure-library-head">
        <div>
          <h1>
            <ShieldCheck size={22} /> View-only document library
          </h1>
          <p>
            Upload PDF, Word, Excel and PowerPoint files. Recipients read them
            inside the app - no download link, no attachment, no copy.
          </p>
        </div>
        <div className="secure-identity">
          <label>
            <Eye size={14} /> Previewing as
          </label>
          {endUserMode ? (
            <b>{CURRENT_KB_USER.email}</b>
          ) : (
            <input
              type="email"
              value={previewEmail}
              placeholder={CURRENT_KB_USER.email}
              onChange={(event) => setPreviewEmail(event.target.value.trim())}
            />
          )}
          <small>
            {previewEmail
              ? "Showing what this person can open."
              : "Your own access. Type an email to test someone else's."}
          </small>
        </div>
      </header>

      {!endUserMode && (
        <div
          className={`secure-dropzone ${dragging ? "is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <Upload size={26} />
          <strong>{busy ? "Encrypting and storing…" : "Upload documents"}</strong>
          <small>
            Drag files here or click to browse · PDF, DOCX, XLSX, XLS, CSV, PPTX
            · up to {formatBytes(MAX_FILE_BYTES)} each
          </small>
          <small className="secure-hint">
            New uploads start locked to <b>specific people</b> with no one on the
            list - set access before sharing.
          </small>
          <input
            ref={inputRef}
            hidden
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      )}

      {uploadError && (
        <p className="secure-error">
          <AlertTriangle size={15} /> {uploadError}
        </p>
      )}

      <div className="secure-library-body">
        <div className="secure-file-grid">
          {rows.map(({ record, access }) => {
            const Icon = KIND_ICONS[record.kind] || FileText;
            return (
              <article
                key={record.id}
                className={`secure-file-card ${access.canView ? "" : "is-blocked"}`}
              >
                <div className="secure-file-icon">
                  <Icon size={20} />
                  <span>{record.ext.toUpperCase()}</span>
                </div>
                <div className="secure-file-main">
                  <strong title={record.name}>{record.name}</strong>
                  <small>
                    {formatBytes(record.size)} · {record.ownerName} ·{" "}
                    {formatDate(record.uploadedAt)}
                  </small>
                  <div className="secure-file-tags">
                    <AccessSummary record={record} />
                    {record.allowDownload ? (
                      <span className="secure-chip is-warn">Download allowed</span>
                    ) : (
                      <span className="secure-chip is-good">
                        <ShieldCheck size={12} /> View only
                      </span>
                    )}
                    {record.expiresAt && !isExpired(record) && (
                      <span className="secure-chip">
                        <Clock3 size={12} /> Until {formatDate(record.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="secure-file-actions">
                  <button
                    className="secure-primary"
                    disabled={!access.canView}
                    onClick={() => setOpenFileId(record.id)}
                    title={access.canView ? "Open viewer" : access.reason}
                  >
                    <Eye size={14} /> Open
                  </button>
                  {!endUserMode && access.isOwner && (
                    <button
                      className="secure-ghost"
                      onClick={() => setPanelFileId(record.id)}
                    >
                      <Users size={14} /> Access
                    </button>
                  )}
                  {!access.canView && (
                    <small className="secure-reason">{access.reason}</small>
                  )}
                </div>
              </article>
            );
          })}

          {rows.length === 0 && (
            <div className="secure-empty">
              <Files size={30} />
              <strong>
                {endUserMode || previewEmail
                  ? "Nothing has been shared with this person yet"
                  : "No documents uploaded yet"}
              </strong>
              <small>
                {endUserMode || previewEmail
                  ? "Files appear here once an owner grants view access."
                  : "Upload a PDF, Word, Excel or PowerPoint file to get started."}
              </small>
            </div>
          )}
        </div>

        {panelRecord && !endUserMode && (
          <AccessPanel
            record={panelRecord}
            onChange={(changes) => patch(panelRecord.id, changes)}
            onDelete={remove}
            onClose={() => setPanelFileId(null)}
          />
        )}
      </div>

      <footer className="secure-disclosure">
        <Check size={14} />
        <p>
          <b>What view-only means here.</b> The app offers no download, print or
          copy path, payloads are encrypted at rest, every grant is checked
          before a single byte is decrypted, and each open is logged. A browser
          must still receive the bytes to draw them, so this deters copying
          rather than making it impossible - it is not DRM. For stronger
          guarantees, render pages server-side and stream images to the client.
        </p>
      </footer>
    </div>
  );
}
