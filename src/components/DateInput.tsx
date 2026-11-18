import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { isValidIso, isoToDisplay } from '../lib/dates';

/** Turn typed digits into DD/MM/YYYY, inserting the slashes automatically. */
function formatTyped(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function displayToIso(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isValidIso(iso) ? iso : null;
}

/**
 * Date field shown and typed as DD/MM/YYYY whatever the computer's region setting is.
 * Emits an ISO date (YYYY-MM-DD) when complete and valid, '' when empty, and the raw
 * text while incomplete or invalid (so validation can flag it).
 */
export function DateInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [text, setText] = useState(isValidIso(value) ? isoToDisplay(value) : value);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Sync when the value changes from outside (draft load, clear, calendar pick).
  useEffect(() => {
    if (isValidIso(value)) setText(isoToDisplay(value));
    else if (value === '') setText('');
  }, [value]);

  const emit = (t: string) => {
    setText(t);
    onChange(t === '' ? '' : (displayToIso(t) ?? t));
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`input pr-10 ${invalid ? 'input-error' : ''}`}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          // Allow deleting a slash naturally; otherwise auto-format the digits.
          emit(raw.length < text.length ? raw.replace(/[^\d/]/g, '') : formatTyped(raw));
        }}
      />
      <button
        type="button"
        aria-label="Open calendar"
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        onClick={openPicker}
      >
        <Calendar className="h-4 w-4" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute right-0 bottom-0 h-0 w-0 opacity-0"
        value={isValidIso(value) ? value : ''}
        onChange={(e) => e.target.value && emit(isoToDisplay(e.target.value))}
      />
    </div>
  );
}
