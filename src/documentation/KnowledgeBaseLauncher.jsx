import { useEffect, useState } from "react";
import { BookOpen, X } from "lucide-react";
import "./documentation-launcher.css";

export default function KnowledgeBaseLauncher({
  code,
  label = "View information",
  icon: Icon = BookOpen,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (event) =>
      event.data?.type === "digital-campus:knowledge-base-close" &&
      setOpen(false);
    window.addEventListener("message", close);
    return () => window.removeEventListener("message", close);
  }, []);
  return (
    <>
      <button
        type="button"
        className={`kb-launch-button ${className}`}
        onClick={() => setOpen(true)}
        title={label}
      >
        <Icon size={18} />
        <span>{label}</span>
      </button>
      {open && (
        <div
          className="kb-launch-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <div className="kb-launch-shell">
            <button
              className="kb-launch-close"
              onClick={() => setOpen(false)}
              aria-label="Close document"
            >
              <X size={19} />
            </button>
            <iframe
              title={label}
              src={`/documentation?code=${encodeURIComponent(code)}&mode=viewer&embedded=1`}
            />
          </div>
        </div>
      )}
    </>
  );
}
