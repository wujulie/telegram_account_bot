"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  name: string;
  defaultValue?: number | string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

function safeEval(expr: string): number | null {
  // Normalise display operators to JS operators
  const normalized = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  // Only allow safe characters
  if (!/^[\d+\-*/().% ]+$/.test(normalized)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${normalized})`)() as unknown;
    if (typeof result === "number" && isFinite(result) && result >= 0) {
      return Math.round(result * 100) / 100;
    }
    return null;
  } catch {
    return null;
  }
}

const BUTTONS = [
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "−"],
  [".", "0", "⌫", "+"],
];

export function AmountInput({ name, defaultValue, placeholder, required, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState(defaultValue != null ? String(defaultValue) : "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        confirm();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, expr]);

  const press = (key: string) => {
    if (key === "C") { setExpr(""); return; }
    if (key === "⌫") { setExpr((e) => e.slice(0, -1)); return; }
    if (key === "=") {
      const result = safeEval(expr);
      if (result !== null) setExpr(String(result));
      return;
    }
    setExpr((e) => e + key);
  };

  const confirm = () => {
    const result = safeEval(expr);
    const final = result !== null ? String(result) : expr;
    setExpr(final);
    // Sync hidden input for form submission
    if (hiddenRef.current) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      nativeSetter?.call(hiddenRef.current, final);
      hiddenRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setOpen(false);
  };

  const display = expr || "0";
  const evaluated = safeEval(expr);
  const preview = evaluated !== null && String(evaluated) !== expr ? `= ${evaluated}` : null;

  return (
    <div ref={wrapRef} className="calc-wrap">
      {/* Visible display — click to open */}
      <div
        className={`calc-trigger ${disabled ? "calc-trigger-disabled" : ""}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="輸入金額"
        onClick={() => !disabled && setOpen(true)}
        onKeyDown={(e) => e.key === "Enter" && !disabled && setOpen(true)}
      >
        <span className={expr ? "" : "calc-placeholder"}>{expr || placeholder || "0"}</span>
        {preview && <span className="calc-preview">{preview}</span>}
      </div>

      {/* Hidden input for form submission */}
      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        required={required}
        defaultValue={defaultValue}
      />

      {open && (
        <div className="calculator-popup" role="dialog" aria-label="計算機">
          <div className="calc-display">
            <span className="calc-expr">{display}</span>
            {preview && <span className="calc-preview">{preview}</span>}
          </div>

          <div className="calc-grid">
            {BUTTONS.map((row) =>
              row.map((btn) => (
                <button
                  key={btn}
                  type="button"
                  className={`calc-btn ${["+", "−", "×", "÷"].includes(btn) ? "calc-btn-op" : ""} ${btn === "⌫" ? "calc-btn-del" : ""}`}
                  onClick={() => press(btn)}
                >
                  {btn}
                </button>
              ))
            )}
          </div>

          <div className="calc-bottom">
            <button type="button" className="calc-btn calc-btn-clear" onClick={() => press("C")}>
              清除
            </button>
            <button type="button" className="calc-btn calc-btn-eq" onClick={() => press("=")}>
              =
            </button>
            <button type="button" className="calc-btn-confirm" onClick={confirm}>
              確認
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
