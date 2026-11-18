import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { normalize } from '../lib/substations';

/**
 * Free-text input with a searchable suggestion list. The user can pick a
 * suggestion or type any other value.
 */
export function SuggestInput({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = normalize(value);
    if (!q || options.includes(value)) return options;
    const starts = options.filter((o) => normalize(o).startsWith(q));
    const contains = options.filter((o) => !normalize(o).startsWith(q) && normalize(o).includes(q));
    return [...starts, ...contains];
  }, [options, value]);

  useEffect(() => setActive(0), [value]);

  const showList = open && results.length > 0;
  const choose = (o: string) => {
    onChange(o);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className="input pr-14"
        placeholder={placeholder ?? 'Search or type...'}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) setOpen(true);
            else setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && showList && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === 'Escape' && open) {
            e.preventDefault();
            setOpen(false);
          }
        }}
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
        {value && (
          <button
            type="button"
            aria-label="Clear"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-label="Show suggestions"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {showList && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {results.map((o, i) => (
            <li
              key={o}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o === value}
              className={`cursor-pointer px-3 py-2 text-slate-700 ${i === active ? 'bg-blue-50' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
