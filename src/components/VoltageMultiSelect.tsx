import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { VOLTAGE_OPTIONS } from '../data/voltageOptions';

/** Normalise "66", "66 kv", "66KV" -> "66kV". */
function normalizeVoltage(raw: string): string {
  const t = raw.trim().replace(/\s+/g, '');
  const m = /^(\d+(?:\.\d+)?)(kv)?$/i.exec(t);
  return m ? `${m[1]}kV` : raw.trim();
}

export function VoltageMultiSelect({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  invalid?: boolean;
}) {
  const [other, setOther] = useState('');
  const custom = value.filter((v) => !VOLTAGE_OPTIONS.includes(v));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const addOther = () => {
    const v = normalizeVoltage(other);
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setOther('');
  };

  return (
    <div
      id={id}
      role="group"
      aria-label="Voltage"
      aria-describedby={invalid ? `${id}-error` : undefined}
      className={`rounded-md border bg-white p-2 ${invalid ? 'border-red-500' : 'border-slate-300'}`}
    >
      <div className="flex flex-wrap gap-2">
        {VOLTAGE_OPTIONS.map((v) => {
          const on = value.includes(v);
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(v)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                on ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400'
              }`}
            >
              {v}
              {on && <X className="h-3.5 w-3.5" aria-hidden />}
            </button>
          );
        })}
        {custom.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed
            aria-label={`Remove ${v}`}
            onClick={() => toggle(v)}
            className="inline-flex items-center gap-1 rounded-full border border-blue-700 bg-blue-700 px-3 py-1 text-sm font-medium text-white"
          >
            {v}
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ))}
        <div className="flex items-center gap-1">
          <input
            type="text"
            aria-label="Other voltage (kV)"
            placeholder="Other kV"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOther();
              }
            }}
            className="w-24 rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm focus:border-blue-600 focus:outline-none"
          />
          <button type="button" onClick={addOther} disabled={!other.trim()} className="btn btn-ghost px-2 py-1" aria-label="Add other voltage">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      {value.length > 0 && <p className="mt-2 text-xs text-slate-500">Selected: {value.join(', ')}</p>}
    </div>
  );
}
