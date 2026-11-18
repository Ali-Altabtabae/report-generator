import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import type { Substation } from '../types/report';
import { duplicateCodes, searchSubstations } from '../lib/substations';

const label = (s: Substation) => `${s.code} — ${s.fullName}`;

export function SubstationCombobox({
  id,
  substations,
  value,
  onChange,
  invalid,
  disabled,
}: {
  id: string;
  substations: Substation[];
  value: Substation | null;
  onChange: (s: Substation | null) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value ? label(value) : '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dupes = useMemo(() => duplicateCodes(substations), [substations]);

  // Keep the text in sync when the selection changes from outside (draft load / clear).
  useEffect(() => {
    setText(value ? label(value) : '');
  }, [value]);

  const query = value ? '' : text;
  const results = useMemo(() => searchSubstations(substations, query, 60), [substations, query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (s: Substation) => {
    onChange(s);
    setText(label(s));
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  };

  const showList = open && !disabled;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${results[active].no}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={disabled ? 'Loading substations…' : 'Search by code or full name...'}
        className={`input pr-9 pl-9 ${invalid ? 'input-error' : ''} ${value ? 'font-medium' : ''}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (value) onChange(null);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {text && !disabled && (
        <button
          type="button"
          aria-label="Clear substation"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setText('');
            onChange(null);
            setActive(0);
            setOpen(true);
            inputRef.current?.focus();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {showList && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Substations"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-slate-500" role="option" aria-disabled="true" aria-selected="false">
              No matching substation
            </li>
          ) : (
            results.map((s, i) => {
              const selected = value?.no === s.no;
              return (
                <li
                  key={s.no}
                  id={`${listId}-${s.no}`}
                  data-index={i}
                  role="option"
                  aria-selected={selected}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? 'bg-blue-50' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(s)}
                >
                  <span className="w-24 shrink-0 font-mono text-xs font-semibold text-blue-800">{s.code}</span>
                  <span className="flex-1 text-slate-700">{s.fullName}</span>
                  {dupes.has(s.code) && <span className="text-xs text-slate-400">NO {s.no}</span>}
                  {selected && <Check className="h-4 w-4 text-blue-700" aria-hidden />}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
