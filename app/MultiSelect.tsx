"use client";

import { useEffect, useRef, useState } from "react";

// Multi-select dropdown styled to match the mono-pill filters. Button shows a
// summary ("All venues" / a single value / "N venues"); the popover holds a
// checkbox list. Closes on outside-click or Escape. Empty selection = no filter.
export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  /** Plural, lowercase-able noun, e.g. "venues". */
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);

  const summary =
    selected.length <= 1 ? (selected[0] ?? `All ${label}`) : `${selected.length} ${label}`;

  return (
    <div className="ms" ref={ref}>
      <button
        type="button"
        className={`ms-btn ${selected.length ? "on" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Filter by ${label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ms-summary">{summary}</span>
        <span className="ms-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="ms-pop" role="listbox" aria-multiselectable="true" aria-label={label}>
          {selected.length > 0 && (
            <button type="button" className="ms-clear" onClick={() => onChange([])}>
              Clear {label}
            </button>
          )}
          {options.map((opt) => {
            const on = selected.includes(opt);
            return (
              <label key={opt} className="ms-opt" role="option" aria-selected={on}>
                <input type="checkbox" checked={on} onChange={() => toggle(opt)} />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
