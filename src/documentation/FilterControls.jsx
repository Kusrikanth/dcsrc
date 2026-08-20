import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  X,
} from "lucide-react";

const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};
const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};
const addDays = (value, count) => {
  const date = new Date(value);
  date.setDate(date.getDate() + count);
  return date;
};
const addMonths = (value, count) => {
  const date = new Date(value);
  date.setDate(1);
  date.setMonth(date.getMonth() + count);
  return date;
};
const startOfWeek = (value) =>
  addDays(startOfDay(value), -new Date(value).getDay());
const sameDay = (a, b) =>
  a && b && startOfDay(a).getTime() === startOfDay(b).getTime();
const shortDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const datePresets = [
  {
    key: "today",
    label: "Today",
    range: (now) => [startOfDay(now), endOfDay(now)],
  },
  {
    key: "yesterday",
    label: "Yesterday",
    range: (now) => [startOfDay(addDays(now, -1)), endOfDay(addDays(now, -1))],
  },
  {
    key: "this-week",
    label: "This Week",
    range: (now) => [startOfWeek(now), endOfDay(now)],
  },
  {
    key: "last-week",
    label: "Last Week",
    range: (now) => {
      const start = addDays(startOfWeek(now), -7);
      return [start, endOfDay(addDays(start, 6))];
    },
  },
  {
    key: "last-30",
    label: "Last 30 Days",
    range: (now) => [startOfDay(addDays(now, -29)), endOfDay(now)],
  },
  {
    key: "last-90",
    label: "Last 90 Days",
    range: (now) => [startOfDay(addDays(now, -89)), endOfDay(now)],
  },
];

export const emptyRange = { preset: "", start: "", end: "" };

export function dateRangeLabel(range) {
  if (!range?.start && !range?.end) return "Any time";
  const preset = datePresets.find((item) => item.key === range.preset);
  if (preset) return preset.label;
  if (sameDay(range.start, range.end)) return shortDate(range.start);
  return `${shortDate(range.start)} – ${shortDate(range.end)}`;
}

function useDismiss(open, close) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "mousedown" && ref.current?.contains(event.target))
        return;
      close();
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, [open, close]);
  return ref;
}

export function PeopleFilter({ label, options, value, onChange, emptyLabel }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useDismiss(open, () => setOpen(false));
  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(needle));
  }, [options, search]);
  const summary =
    value.length === 0
      ? emptyLabel
      : value.length === 1
        ? value[0]
        : `${value.length} people`;
  const toggle = (name) =>
    onChange(
      value.includes(name)
        ? value.filter((item) => item !== name)
        : [...value, name],
    );

  return (
    <div className="kbm-filter" ref={ref}>
      <button
        className={`kbm-filter-trigger${value.length ? " on" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
      >
        <Users size={12} />
        <small>{label}</small>
        <strong>{summary}</strong>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="kbm-filter-pop">
          <label className="kbm-filter-search">
            <Search size={13} />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}`}
            />
            {search && (
              <button title="Clear search" onClick={() => setSearch("")}>
                <X size={12} />
              </button>
            )}
          </label>
          <div className="kbm-filter-options">
            {matches.map((option) => (
              <button key={option} onClick={() => toggle(option)}>
                <span
                  className={`kbm-check${value.includes(option) ? " on" : ""}`}
                >
                  {value.includes(option) && <Check size={11} />}
                </span>
                {option}
              </button>
            ))}
            {!matches.length && <p>No match for this search.</p>}
          </div>
          <footer>
            <span>
              {value.length ? `${value.length} selected` : "None selected"}
            </span>
            <button disabled={!value.length} onClick={() => onChange([])}>
              Clear
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}

export function DateRangeFilter({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [view, setView] = useState(() =>
    addMonths(value?.start ? new Date(value.start) : new Date(), 0),
  );
  const ref = useDismiss(open, () => {
    setOpen(false);
    setDraft(null);
  });
  const now = new Date();
  const active = Boolean(value?.start || value?.end);

  const pickPreset = (preset) => {
    const [start, end] = preset.range(now);
    onChange({
      preset: preset.key,
      start: start.toISOString(),
      end: end.toISOString(),
    });
    setDraft(null);
    setOpen(false);
  };

  const pickDay = (day) => {
    if (!draft || draft.end || day < draft.start) {
      setDraft({ start: day, end: null });
      return;
    }
    onChange({
      preset: "",
      start: startOfDay(draft.start).toISOString(),
      end: endOfDay(day).toISOString(),
    });
    setDraft(null);
    setOpen(false);
  };

  const selection = draft || {
    start: value?.start ? new Date(value.start) : null,
    end: value?.end ? new Date(value.end) : null,
  };

  const renderMonth = (offset) => {
    const month = addMonths(view, offset);
    const year = month.getFullYear();
    const first = new Date(year, month.getMonth(), 1);
    const total = new Date(year, month.getMonth() + 1, 0).getDate();
    const cells = [
      ...Array(first.getDay()).fill(null),
      ...Array.from(
        { length: total },
        (_, index) => new Date(year, month.getMonth(), index + 1),
      ),
    ];
    return (
      <div className="kbm-cal-month" key={offset}>
        <header>
          {offset === 0 && (
            <button
              title="Previous month"
              onClick={() => setView(addMonths(view, -1))}
            >
              <ChevronLeft size={14} />
            </button>
          )}
          <select
            value={year}
            onChange={(event) =>
              setView(
                addMonths(
                  new Date(Number(event.target.value), month.getMonth(), 1),
                  -offset,
                ),
              )
            }
          >
            {Array.from(
              { length: 11 },
              (_, index) => now.getFullYear() - 5 + index,
            ).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={month.getMonth()}
            onChange={(event) =>
              setView(
                addMonths(new Date(year, Number(event.target.value), 1), -offset),
              )
            }
          >
            {monthNames.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
          {offset === 1 && (
            <button
              title="Next month"
              onClick={() => setView(addMonths(view, 1))}
            >
              <ChevronRight size={14} />
            </button>
          )}
        </header>
        <div className="kbm-cal-grid">
          {dayNames.map((day) => (
            <small key={day}>{day}</small>
          ))}
          {cells.map((day, index) => {
            if (!day) return <i key={`blank-${index}`} />;
            const inRange =
              selection.start &&
              selection.end &&
              day >= startOfDay(selection.start) &&
              day <= endOfDay(selection.end);
            const edge =
              sameDay(day, selection.start) || sameDay(day, selection.end);
            return (
              <button
                key={day.toISOString()}
                className={`${inRange ? "in" : ""}${edge ? " edge" : ""}${
                  sameDay(day, now) ? " today" : ""
                }`}
                onClick={() => pickDay(day)}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="kbm-filter" ref={ref}>
      <button
        className={`kbm-filter-trigger${active ? " on" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
      >
        <CalendarRange size={12} />
        <small>{label}</small>
        <strong>{dateRangeLabel(value)}</strong>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="kbm-filter-pop kbm-cal-pop">
          <div className="kbm-cal-presets">
            <strong>Choose a Period</strong>
            {datePresets.map((preset) => (
              <button
                key={preset.key}
                className={value?.preset === preset.key ? "on" : ""}
                onClick={() => pickPreset(preset)}
              >
                {preset.label}
              </button>
            ))}
            <button
              className="kbm-cal-any"
              onClick={() => {
                onChange(emptyRange);
                setDraft(null);
                setOpen(false);
              }}
            >
              Any time
            </button>
          </div>
          <div className="kbm-cal-body">
            <div className="kbm-cal-months">{[0, 1].map(renderMonth)}</div>
            <footer>
              <span>
                {draft?.start && !draft.end
                  ? `${shortDate(draft.start)} – select an end date`
                  : dateRangeLabel(value)}
              </span>
              <button onClick={() => setOpen(false)}>Close</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
