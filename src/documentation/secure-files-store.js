import { CURRENT_KB_USER } from "./documentation-store.js";

/*
 * Storage + access layer for view-only documents.
 *
 * IMPORTANT - read before relying on this in production:
 * A browser can only render a document once the bytes have reached it, so no
 * purely client-side viewer can truly prevent a determined user from keeping a
 * copy. What this layer does is remove every download path the product offers,
 * keep payloads encrypted at rest so a casual IndexedDB dump yields ciphertext,
 * and funnel every byte release through a single authorisation check.
 *
 * `resolveFileBytes` is deliberately the ONLY way to obtain a decrypted
 * payload. When you move to a real backend, replace its body with an
 * authenticated fetch and keep the AES key server-side, released only after the
 * same access check runs there. Nothing else in the module needs to change.
 */

const DB_NAME = "dc-secure-files";
const DB_VERSION = 1;
const PAYLOAD_STORE = "payloads";
const INDEX_KEY = "dc-secure-file-index";
const KEYRING_KEY = "dc-secure-file-keyring";
const AUDIT_KEY = "dc-secure-file-audit";
const AUDIT_LIMIT = 500;

export const MAX_FILE_BYTES = 40 * 1024 * 1024;

/* Formats we can render in-page without ever handing over the original file. */
export const SUPPORTED_FORMATS = [
  { ext: "pdf", kind: "pdf", label: "PDF" },
  { ext: "docx", kind: "docx", label: "Word" },
  { ext: "xlsx", kind: "sheet", label: "Excel" },
  { ext: "xlsm", kind: "sheet", label: "Excel" },
  { ext: "xlsb", kind: "sheet", label: "Excel" },
  { ext: "xls", kind: "sheet", label: "Excel 97-2003" },
  { ext: "csv", kind: "sheet", label: "CSV" },
  { ext: "pptx", kind: "slides", label: "PowerPoint" },
];

/*
 * Legacy binary formats. There is no dependable in-browser renderer for these,
 * and falling back to a download link would defeat the entire point of the
 * feature, so they are refused at upload with a conversion hint instead.
 */
export const LEGACY_FORMATS = {
  doc: { label: "Word 97-2003 (.doc)", convertTo: "docx" },
  ppt: { label: "PowerPoint 97-2003 (.ppt)", convertTo: "pptx" },
};

export const ACCESS_RULES = [
  {
    value: "anyone",
    label: "Anyone in the organisation",
    hint: "Every signed-in user who opens the library can view this file.",
  },
  {
    value: "specific",
    label: "Specific people",
    hint: "Only the email addresses listed below can view this file.",
  },
  {
    value: "no-one",
    label: "No one",
    hint: "Locked. Only the owner can open it until this changes.",
  },
];

export function fileExtension(name = "") {
  return name.split(".").pop()?.toLowerCase() || "";
}

export function formatFor(name = "") {
  const ext = fileExtension(name);
  return SUPPORTED_FORMATS.find((format) => format.ext === ext) || null;
}

export const ACCEPT_ATTRIBUTE = SUPPORTED_FORMATS.map(
  (format) => `.${format.ext}`,
).join(",");

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function identify(user = CURRENT_KB_USER) {
  return {
    name: user?.name || "Unknown user",
    email: normalizeEmail(user?.email),
  };
}

/* ------------------------------------------------------------------ index -- */

export function getSecureFiles() {
  try {
    const saved = JSON.parse(localStorage.getItem(INDEX_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveSecureFiles(records) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(records));
}

export function getSecureFile(id) {
  return getSecureFiles().find((record) => record.id === id) || null;
}

/* ------------------------------------------------------------- encryption -- */

function readKeyring() {
  try {
    return JSON.parse(localStorage.getItem(KEYRING_KEY)) || {};
  } catch {
    return {};
  }
}

function writeKeyring(keyring) {
  localStorage.setItem(KEYRING_KEY, JSON.stringify(keyring));
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function createFileKey(id) {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  writeKeyring({ ...readKeyring(), [id]: toBase64(raw) });
  return key;
}

async function loadFileKey(id) {
  const material = readKeyring()[id];
  if (!material) throw new Error("The encryption key for this file is missing.");
  return crypto.subtle.importKey(
    "raw",
    fromBase64(material),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
}

function forgetFileKey(id) {
  const keyring = readKeyring();
  delete keyring[id];
  writeKeyring(keyring);
}

/* --------------------------------------------------------------- payloads -- */

function openPayloadDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PAYLOAD_STORE))
        request.result.createObjectStore(PAYLOAD_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function payloadRequest(mode, run) {
  return openPayloadDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const request = run(
          db.transaction(PAYLOAD_STORE, mode).objectStore(PAYLOAD_STORE),
        );
        request.onsuccess = () => {
          db.close();
          resolve(request.result);
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      }),
  );
}

async function putPayload(id, arrayBuffer) {
  const key = await createFileKey(id);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    arrayBuffer,
  );
  await payloadRequest("readwrite", (store) => store.put({ iv, cipher }, id));
}

async function deletePayload(id) {
  await payloadRequest("readwrite", (store) => store.delete(id));
  forgetFileKey(id);
}

/* ----------------------------------------------------------------- access -- */

export function isExpired(record) {
  if (!record?.expiresAt) return false;
  return new Date(record.expiresAt).getTime() < Date.now();
}

/*
 * Single source of truth for "what may this person do with this file".
 * Every viewer, list and byte-release path routes through here so a rule change
 * cannot be applied in one place and forgotten in another.
 */
export function evaluateAccess(record, user = CURRENT_KB_USER) {
  const person = identify(user);
  const blocked = { canView: false, canDownload: false, isOwner: false };
  if (!record) return { ...blocked, reason: "This file no longer exists." };

  /*
   * Owning a file grants management rights - open it, change its grants, delete
   * it - but NOT an automatic download. "Allow download" is the only switch
   * that decides whether anyone gets the original bytes, owner included;
   * otherwise the toggle silently does nothing for the person most likely to be
   * testing it.
   */
  if (normalizeEmail(record.ownerEmail) === person.email)
    return {
      canView: true,
      canDownload: Boolean(record.allowDownload),
      isOwner: true,
      reason: "You own this file.",
    };

  if (record.status === "revoked")
    return { ...blocked, reason: "Access to this file has been revoked." };
  if (isExpired(record))
    return {
      ...blocked,
      reason: `Access expired on ${new Date(record.expiresAt).toLocaleDateString()}.`,
    };

  const granted =
    record.viewAccess === "anyone" ||
    (record.viewAccess === "specific" &&
      (record.viewers || []).some(
        (entry) => normalizeEmail(entry) === person.email,
      ));

  if (!granted)
    return {
      ...blocked,
      reason: "You have not been granted access to this file.",
    };

  return {
    canView: true,
    canDownload: Boolean(record.allowDownload),
    isOwner: false,
    reason: "View access granted.",
  };
}

export function visibleSecureFiles(user = CURRENT_KB_USER) {
  return getSecureFiles()
    .map((record) => ({ record, access: evaluateAccess(record, user) }))
    .filter(({ access }) => access.canView);
}

/* ------------------------------------------------------------------ audit -- */

export function getAuditTrail(fileId) {
  try {
    const entries = JSON.parse(localStorage.getItem(AUDIT_KEY)) || [];
    return fileId
      ? entries.filter((entry) => entry.fileId === fileId)
      : entries;
  } catch {
    return [];
  }
}

export function recordAudit(fileId, action, user = CURRENT_KB_USER) {
  const person = identify(user);
  const entries = [
    {
      fileId,
      action,
      by: person.name,
      email: person.email,
      at: new Date().toISOString(),
    },
    ...getAuditTrail(),
  ].slice(0, AUDIT_LIMIT);
  localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
}

/* ----------------------------------------------------------------- writes -- */

export async function uploadSecureFile(
  file,
  options = {},
  user = CURRENT_KB_USER,
) {
  const person = identify(user);
  const ext = fileExtension(file.name);
  const legacy = LEGACY_FORMATS[ext];
  if (legacy)
    throw new Error(
      `${legacy.label} cannot be displayed without downloading it. Save the file as .${legacy.convertTo} and upload it again.`,
    );
  const format = formatFor(file.name);
  if (!format)
    throw new Error(
      `.${ext || "?"} files are not supported. Upload a PDF, Word, Excel or PowerPoint file.`,
    );
  if (file.size > MAX_FILE_BYTES)
    throw new Error(
      `${formatBytes(file.size)} exceeds the ${formatBytes(MAX_FILE_BYTES)} limit for view-only files.`,
    );

  const id = crypto.randomUUID?.() || `file-${Date.now()}`;
  await putPayload(id, await file.arrayBuffer());

  const record = {
    id,
    name: file.name,
    ext,
    kind: format.kind,
    formatLabel: format.label,
    size: file.size,
    mime: file.type || "",
    uploadedAt: new Date().toISOString(),
    ownerName: person.name,
    ownerEmail: person.email,
    kbId: options.kbId || null,
    viewAccess: options.viewAccess || "specific",
    viewers: options.viewers || [],
    expiresAt: options.expiresAt || null,
    allowDownload: Boolean(options.allowDownload),
    watermark: options.watermark !== false,
    status: "active",
  };

  saveSecureFiles([record, ...getSecureFiles()]);
  recordAudit(id, "uploaded", user);
  return record;
}

export function updateSecureFile(id, patch, user = CURRENT_KB_USER) {
  let updated = null;
  saveSecureFiles(
    getSecureFiles().map((record) => {
      if (record.id !== id) return record;
      updated = { ...record, ...patch };
      return updated;
    }),
  );
  if (updated) recordAudit(id, "access-updated", user);
  return updated;
}

export async function deleteSecureFile(id, user = CURRENT_KB_USER) {
  await deletePayload(id);
  saveSecureFiles(getSecureFiles().filter((record) => record.id !== id));
  recordAudit(id, "deleted", user);
}

/* ----------------------------------------------------------- byte release -- */

/*
 * The one and only gate that turns a stored file back into readable bytes.
 * Swap the body for an authenticated API call when a backend exists; keep the
 * access check, keep the single entry point.
 */
export async function resolveFileBytes(id, user = CURRENT_KB_USER) {
  const record = getSecureFile(id);
  const access = evaluateAccess(record, user);
  if (!access.canView) throw new Error(access.reason);

  const payload = await payloadRequest("readonly", (store) => store.get(id));
  if (!payload) throw new Error("The stored file could not be found.");

  const key = await loadFileKey(id);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: payload.iv },
    key,
    payload.cipher,
  );
  recordAudit(id, "viewed", user);
  return plain;
}
