import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Eye,
  FileText,
  Filter,
  Link2,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Share2,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  CURRENT_KB_USER,
  createKnowledgeBaseCode,
  defaultKnowledgeBase,
  getKnowledgeBases,
  kbStorageKey,
  saveKnowledgeBases,
} from "./documentation-store.js";
import {
  DateRangeFilter,
  PeopleFilter,
  emptyRange,
} from "./FilterControls.jsx";
import "./documentation-management.css";
import "./documentation-code.css";

const slug = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `knowledge-base-${Date.now()}`;
const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const accessLabel = {
  anyone: "Anyone",
  selected: "Selected people",
  "no-one": "No one",
};
const statusFilters = ["all", "active", "draft", "archived"];
const sortLabel = {
  updated: "Last updated",
  created: "Recently created",
  name: "Name (A–Z)",
};

export default function DocumentationManagement() {
  const [items, setItems] = useState(getKnowledgeBases);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [shareItemId, setShareItemId] = useState("");
  const [status, setStatus] = useState("all");
  const [access, setAccess] = useState("all");
  const [creator, setCreator] = useState([]);
  const [created, setCreated] = useState(emptyRange);
  const [sort, setSort] = useState("updated");
  const creators = useMemo(
    () =>
      [
        ...new Set(
          items.map((item) => item.createdBy || item.updatedBy).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const statusCounts = useMemo(
    () =>
      items.reduce(
        (counts, item) => ({
          ...counts,
          all: counts.all + 1,
          [item.status]: (counts[item.status] || 0) + 1,
        }),
        { all: 0 },
      ),
    [items],
  );
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items
      .filter((item) => {
        if (
          search &&
          !`${item.name} ${item.purpose} ${item.accessCode}`
            .toLowerCase()
            .includes(search)
        )
          return false;
        if (status !== "all" && item.status !== status) return false;
        if (access !== "all" && item.viewAccess !== access) return false;
        if (
          creator.length &&
          !creator.includes(item.createdBy || item.updatedBy)
        )
          return false;
        if (created.start || created.end) {
          const stamp = new Date(item.createdAt || item.updatedAt).getTime();
          if (created.start && stamp < new Date(created.start).getTime())
            return false;
          if (created.end && stamp > new Date(created.end).getTime())
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        const key = sort === "created" ? "createdAt" : "updatedAt";
        return new Date(b[key] || 0) - new Date(a[key] || 0);
      });
  }, [items, query, status, access, creator, created, sort]);
  const filtersActive =
    Boolean(query.trim()) ||
    status !== "all" ||
    access !== "all" ||
    creator.length > 0 ||
    Boolean(created.start || created.end);
  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setAccess("all");
    setCreator([]);
    setCreated(emptyRange);
  };

  const persist = (next) => {
    setItems(next);
    saveKnowledgeBases(next);
  };
  useEffect(() => {
    if (!shareItemId) return undefined;
    const dismiss = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "mousedown" && event.target.closest(".kbm-share-wrap"))
        return;
      setShareItemId("");
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, [shareItemId]);
  const copyShareValue = async (key, value) => {
    await navigator.clipboard?.writeText(value);
    setCopiedCode(key);
    window.setTimeout(() => setCopiedCode(""), 1800);
  };
  const openCreate = () =>
    setEditor({
      id: "",
      name: "",
      purpose: "",
      viewAccess: "anyone",
      editAccess: "selected",
      viewers: "",
      editors: CURRENT_KB_USER.email,
      status: "active",
    });
  const openEdit = (item) =>
    setEditor({
      ...item,
      viewers: (item.viewers || []).join(", "),
      editors: (item.editors || []).join(", "),
    });
  const save = () => {
    if (!editor.name.trim()) {
      setError("Documentation name is required.");
      return;
    }
    const now = new Date().toISOString();
    const id = editor.id || slug(editor.name);
    const record = {
      ...editor,
      id,
      accessCode: editor.accessCode || createKnowledgeBaseCode(editor.name),
      name: editor.name.trim(),
      purpose: editor.purpose.trim(),
      viewers: editor.viewers
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      editors: editor.editors
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      createdAt: editor.createdAt || now,
      createdBy: editor.createdBy || CURRENT_KB_USER.name,
      updatedAt: now,
      updatedBy: CURRENT_KB_USER.name,
    };
    persist(
      items.some((item) => item.id === id)
        ? items.map((item) => (item.id === id ? record : item))
        : [...items, record],
    );
    setEditor(null);
    setError("");
  };
  const confirmDelete = () => {
    if (
      deletePassword !== (import.meta.env.VITE_DELETE_PASSWORD || "Admin@123")
    ) {
      setError("Incorrect administrator password.");
      return;
    }
    persist(items.filter((item) => item.id !== deleteItem.id));
    localStorage.removeItem(kbStorageKey(deleteItem.id, "navigation"));
    localStorage.removeItem(kbStorageKey(deleteItem.id, "documents"));
    setDeleteItem(null);
    setDeletePassword("");
    setError("");
  };

  return (
    <div className="kbm-app">
      <header className="kbm-top">
        <a href="/">
          <span>dc</span>
          <strong>Digital Campus</strong>
        </a>
        <div>
          <BookOpen size={18} />
          <span>
            <strong>Documentation management</strong>
            <small>Create documentation spaces and control access</small>
          </span>
        </div>
        <a className="kbm-close" href="/">
          <X size={17} />
          Close
        </a>
      </header>
      <main>
        <section className="kbm-hero">
          <div>
            <span>ORGANIZATION KNOWLEDGE</span>
            <h1>Documentation</h1>
            <p>
              Create and manage documentation libraries for policies, ERP
              guidance, departments and other organizational purposes.
            </p>
          </div>
          <button onClick={openCreate}>
            <Plus size={17} />
            Create Documentation
          </button>
        </section>
        <section className="kbm-toolbar">
          <div className="kbm-toolbar-row">
            <label className="kbm-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, purpose or reference code"
              />
            </label>
            <div className="kbm-status-tabs">
              {statusFilters.map((value) => (
                <button
                  key={value}
                  className={status === value ? "active" : ""}
                  onClick={() => setStatus(value)}
                >
                  {value === "all" ? "All" : value}
                  <span>{statusCounts[value] || 0}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="kbm-toolbar-row kbm-filters">
            <Filter size={13} />
            <label>
              View access
              <select
                value={access}
                onChange={(event) => setAccess(event.target.value)}
              >
                <option value="all">Anyone with any access</option>
                {Object.entries(accessLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <PeopleFilter
              label="Created by"
              emptyLabel="Everyone"
              options={creators}
              value={creator}
              onChange={setCreator}
            />
            <DateRangeFilter
              label="Created"
              value={created}
              onChange={setCreated}
            />
            <label className="kbm-sort">
              <ArrowUpDown size={12} />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                {Object.entries(sortLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {filtersActive && (
              <button className="kbm-clear" onClick={clearFilters}>
                <X size={12} />
                Clear filters
              </button>
            )}
            <span>
              Showing {filtered.length} of {items.length} Documentation item
              {items.length === 1 ? "" : "s"}
            </span>
          </div>
        </section>
        <div className="kbm-list">
          {filtered.map((item) => (
            <article key={item.id}>
              <div className="kbm-card-icon">
                <BookOpen size={20} />
              </div>
              <div className="kbm-row-info">
                <h2>
                  {item.name}
                  <span className={`kbm-status ${item.status}`}>
                    {item.status}
                  </span>
                </h2>
                <p>{item.purpose || "No purpose description has been added."}</p>
                <small>
                  Updated {formatDate(item.updatedAt)} by {item.updatedBy}
                </small>
              </div>
              <div className="kbm-row-meta">
                <small>Created by</small>
                <strong title={item.createdBy || item.updatedBy}>
                  {item.createdBy || item.updatedBy}
                </strong>
                <span>{formatDate(item.createdAt)}</span>
              </div>
              <div className="kbm-access">
                <span>
                  <Eye size={14} />
                  <small>View access</small>
                  <strong>{accessLabel[item.viewAccess]}</strong>
                </span>
                <span>
                  <Pencil size={14} />
                  <small>Edit access</small>
                  <strong>{accessLabel[item.editAccess]}</strong>
                </span>
              </div>
              <footer>
                <div>
                  <div className="kbm-share-wrap">
                    <button
                      title="Share Documentation"
                      aria-haspopup="true"
                      aria-expanded={shareItemId === item.id}
                      className={shareItemId === item.id ? "active" : ""}
                      onClick={() =>
                        setShareItemId((value) =>
                          value === item.id ? "" : item.id,
                        )
                      }
                    >
                      <Share2 size={15} />
                    </button>
                    {shareItemId === item.id && (
                      <div className="kbm-share-menu" role="dialog">
                        <header>
                          <span>
                            <strong>Share Documentation</strong>
                            <small>Copy an option to use elsewhere</small>
                          </span>
                          <button
                            title="Close"
                            onClick={() => setShareItemId("")}
                          >
                            <X size={14} />
                          </button>
                        </header>
                        <button
                          onClick={() =>
                            copyShareValue(`code:${item.id}`, item.accessCode)
                          }
                        >
                          {copiedCode === `code:${item.id}` ? (
                            <Check size={16} />
                          ) : (
                            <Copy size={16} />
                          )}
                          <span>
                            <strong>Reference code</strong>
                            <small>{item.accessCode}</small>
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            copyShareValue(
                              `url:${item.id}`,
                              `${window.location.origin}/documentation?code=${encodeURIComponent(item.accessCode)}&mode=viewer`,
                            )
                          }
                        >
                          {copiedCode === `url:${item.id}` ? (
                            <Check size={16} />
                          ) : (
                            <Link2 size={16} />
                          )}
                          <span>
                            <strong>Viewer URL</strong>
                            <small>View-only documentation link</small>
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            const label = `View ${item.name}`.replace(
                              /"/g,
                              "&quot;",
                            );
                            const snippet = `import DocumentationLauncher from './DocumentationLauncher.jsx';\n\n<DocumentationLauncher\n  code="${item.accessCode}"\n  label="${label}"\n/>`;
                            copyShareValue(`jsx:${item.id}`, snippet);
                          }}
                        >
                          {copiedCode === `jsx:${item.id}` ? (
                            <Check size={16} />
                          ) : (
                            <Code2 size={16} />
                          )}
                          <span>
                            <strong>Launcher code</strong>
                            <small>React integration snippet</small>
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  <button title="Configure" onClick={() => openEdit(item)}>
                    <Settings2 size={15} />
                  </button>
                  {item.id !== defaultKnowledgeBase.id && (
                    <button
                      className="danger"
                      title="Delete"
                      onClick={() => {
                        setDeleteItem(item);
                        setError("");
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  <a
                    href={`/documentation?code=${item.accessCode}&mode=viewer`}
                  >
                    <Eye size={14} />
                    View
                  </a>
                  <a
                    className="primary"
                    href={`/documentation?kb=${item.id}&mode=admin`}
                  >
                    <Pencil size={14} />
                    Manage
                    <ChevronRight size={14} />
                  </a>
                </div>
              </footer>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <div className="kbm-empty">
            <FileText size={30} />
            <h2>No Documentation found</h2>
            <p>
              {filtersActive
                ? "No items match the current filters."
                : "Create your first documentation library to get started."}
            </p>
            {filtersActive && (
              <button onClick={clearFilters}>
                <X size={13} />
                Clear filters
              </button>
            )}
          </div>
        )}
      </main>
      {editor && (
        <div className="kbm-modal-bg">
          <section className="kbm-modal">
            <header>
              <div>
                <h2>
                  {editor.id
                    ? "Configure Documentation"
                    : "Create Documentation"}
                </h2>
                <p>Define its purpose and who may view or edit it.</p>
              </div>
              <button onClick={() => setEditor(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="kbm-form">
              <label>
                Name
                <input
                  autoFocus
                  value={editor.name}
                  onChange={(event) => {
                    setEditor({ ...editor, name: event.target.value });
                    setError("");
                  }}
                  placeholder="e.g. HR Policies"
                />
              </label>
              <label>
                Purpose
                <textarea
                  rows="3"
                  value={editor.purpose}
                  onChange={(event) =>
                    setEditor({ ...editor, purpose: event.target.value })
                  }
                  placeholder="What will this Documentation contain?"
                />
              </label>
              <div className="kbm-permissions">
                <AccessField
                  label="Who can view?"
                  icon={Eye}
                  value={editor.viewAccess}
                  people={editor.viewers}
                  onChange={(changes) => setEditor({ ...editor, ...changes })}
                  accessKey="viewAccess"
                  peopleKey="viewers"
                />
                <AccessField
                  label="Who can edit?"
                  icon={Pencil}
                  value={editor.editAccess}
                  people={editor.editors}
                  onChange={(changes) => setEditor({ ...editor, ...changes })}
                  accessKey="editAccess"
                  peopleKey="editors"
                />
              </div>
              <label>
                Status
                <select
                  value={editor.status}
                  onChange={(event) =>
                    setEditor({ ...editor, status: event.target.value })
                  }
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              {error && <p className="kbm-error">{error}</p>}
            </div>
            <footer>
              <button onClick={() => setEditor(null)}>Cancel</button>
              <button className="primary" onClick={save}>
                <Check size={15} />
                {editor.id ? "Save configuration" : "Create Documentation"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {deleteItem && (
        <div className="kbm-modal-bg">
          <section className="kbm-delete">
            <header>
              <LockKeyhole size={21} />
              <div>
                <h2>Delete Documentation?</h2>
                <p>{deleteItem.name} and its configuration will be removed.</p>
              </div>
            </header>
            <label>
              Administrator password
              <input
                autoFocus
                type="password"
                value={deletePassword}
                onChange={(event) => {
                  setDeletePassword(event.target.value);
                  setError("");
                }}
              />
              {error && <span>{error}</span>}
            </label>
            <footer>
              <button onClick={() => setDeleteItem(null)}>Cancel</button>
              <button className="danger" onClick={confirmDelete}>
                <Trash2 size={14} />
                Delete permanently
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function AccessField({
  label,
  icon: Icon,
  value,
  people,
  onChange,
  accessKey,
  peopleKey,
}) {
  return (
    <fieldset>
      <legend>
        <Icon size={15} />
        {label}
      </legend>
      <div>
        {["anyone", "selected", "no-one"].map((option) => (
          <button
            type="button"
            key={option}
            className={value === option ? "active" : ""}
            onClick={() => onChange({ [accessKey]: option })}
          >
            {option === "anyone" ? (
              <Users size={14} />
            ) : option === "selected" ? (
              <ShieldCheck size={14} />
            ) : (
              <LockKeyhole size={14} />
            )}
            {accessLabel[option]}
          </button>
        ))}
      </div>
      {value === "selected" && (
        <label>
          People or email addresses
          <textarea
            rows="2"
            value={people}
            onChange={(event) => onChange({ [peopleKey]: event.target.value })}
            placeholder="name@organization.com, Another Person"
          />
          <small>Separate multiple entries with commas.</small>
        </label>
      )}
    </fieldset>
  );
}
