export const CURRENT_KB_USER = {
  name: "K. Srikanth",
  email: "srikanth@digitalcampus.edu",
};

export const defaultKnowledgeBase = {
  id: "digital-campus-erp",
  name: "Digital Campus ERP Documentation",
  purpose: "Screen-by-screen product documentation for the Digital Campus ERP.",
  viewAccess: "anyone",
  editAccess: "anyone",
  viewers: [],
  editors: [],
  status: "active",
  createdAt: "2026-08-18T09:00:00.000Z",
  createdBy: "K. Srikanth",
  updatedAt: "2026-08-18T09:00:00.000Z",
  updatedBy: "K. Srikanth",
  accessCode: "KB-ERP-DOCS-001",
};

export function createKnowledgeBaseCode(name = "DOC") {
  const prefix =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .split("-")
      .slice(0, 3)
      .join("-")
      .slice(0, 18) || "DOC";
  const suffix =
    crypto.randomUUID?.().replace(/-/g, "").slice(0, 5).toUpperCase() ||
    Date.now().toString(36).slice(-5).toUpperCase();
  return `KB-${prefix}-${suffix}`;
}

export function getKnowledgeBases() {
  try {
    const saved = JSON.parse(localStorage.getItem("dc-knowledge-bases"));
    if (!saved?.length) return [defaultKnowledgeBase];
    const normalized = saved.map((item) => ({
      ...item,
      accessCode: item.accessCode || createKnowledgeBaseCode(item.name),
      createdBy: item.createdBy || item.updatedBy || CURRENT_KB_USER.name,
      createdAt: item.createdAt || item.updatedAt,
    }));
    if (
      normalized.some(
        (item, index) =>
          item.accessCode !== saved[index].accessCode ||
          item.createdBy !== saved[index].createdBy ||
          item.createdAt !== saved[index].createdAt,
      )
    )
      localStorage.setItem("dc-knowledge-bases", JSON.stringify(normalized));
    return normalized;
  } catch {
    return [defaultKnowledgeBase];
  }
}

export function saveKnowledgeBases(items) {
  localStorage.setItem("dc-knowledge-bases", JSON.stringify(items));
}

export function getKnowledgeBase(id) {
  return (
    getKnowledgeBases().find((item) => item.id === id) || defaultKnowledgeBase
  );
}

export function getKnowledgeBaseByCode(code) {
  return (
    getKnowledgeBases().find(
      (item) =>
        item.accessCode?.toLowerCase() ===
        String(code || "")
          .trim()
          .toLowerCase(),
    ) || null
  );
}

export function canAccess(rule, people = [], user = CURRENT_KB_USER) {
  if (rule === "anyone") return true;
  if (rule === "no-one") return false;
  return people.some(
    (person) =>
      person.trim().toLowerCase() === user.email.toLowerCase() ||
      person.trim().toLowerCase() === user.name.toLowerCase(),
  );
}

export function kbStorageKey(kbId, type) {
  if (kbId === defaultKnowledgeBase.id)
    return type === "navigation" ? "dc-doc-navigation" : "dc-documents";
  return `dc-kb-${kbId}-${type}`;
}
