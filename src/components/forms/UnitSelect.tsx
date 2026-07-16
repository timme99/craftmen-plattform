"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { CANONICAL_UNITS } from "@/lib/utils/units";

const CUSTOM = "__custom__";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// Einheiten-Auswahl mit kanonischer Liste und Freitext als Ausweichoption.
export default function UnitSelect({ value, onChange, className }: Props) {
  const isCanonical = value === "" || (CANONICAL_UNITS as readonly string[]).includes(value);
  const [customMode, setCustomMode] = useState(!isCanonical);

  if (customMode) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className ?? "w-16 border border-gray-300 rounded px-1.5 py-1 text-sm"}
          placeholder="Einheit"
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            onChange("");
            setCustomMode(false);
          }}
          title="Zurück zur Auswahl"
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === CUSTOM) {
          setCustomMode(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
      className={className ?? "w-24 border border-gray-300 rounded px-1.5 py-1 text-sm"}
    >
      <option value="">— keine —</option>
      {CANONICAL_UNITS.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
      <option value={CUSTOM}>Andere…</option>
    </select>
  );
}
