"use client";

import { useEffect, useRef, useState } from "react";

function safeEval(expr: string): number | null {
  const normalized = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  if (!/^[\d+\-*/().% ]+$/.test(normalized)) return null;
  try {
    const result = Function(`"use strict"; return (${normalized})`)() as unknown;
    if (typeof result === "number" && isFinite(result) && result >= 0) {
      return Math.round(result * 100) / 100;
    }
    return null;
  } catch {
    return null;
  }
}

const ROWS = [
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "−"],
  ["0", "00", ".", "+"],
];

type CalculatorModalProps = {
  initial: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

function CalculatorModal({ initial, onConfirm, onCancel }: CalculatorModalProps) {
  const [expr, setExpr] = useState(initial);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const press = (key: string) => {
    if (key === "AC") { setExpr(""); return; }
    if (key === "⌫") { setExpr((e) => e.slice(0, -1)); return; }
    if (key === "=") {
      const result = safeEval(expr);
      if (result !== null) setExpr(String(result));
      return;
    }
    setExpr((e) => e + key);
  };

  const handleConfirm = () => {
    const result = safeEval(expr);
    onConfirm(result !== null ? String(result) : expr);
  };

  const display = expr || "0";

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="glass-card calc-modal"
        role="dialog"
        aria-label="計算機"
      >
        <div className="calc-modal-header">
          <p className="calc-modal-title">計算機</p>
          <button type="button" className="calc-modal-close" onClick={onCancel} aria-label="關閉">✕</button>
        </div>

        <div className="calc-modal-display">{display}</div>

        <div className="calc-modal-grid">
          {ROWS.map((row) =>
            row.map((btn) => (
              <button
                key={btn}
                type="button"
                className={`calc-modal-btn ${["+", "−", "×", "÷"].includes(btn) ? "calc-modal-btn-op" : ""}`}
                onClick={() => press(btn)}
              >
                {btn}
              </button>
            ))
          )}
        </div>

        <div className="calc-modal-control-row">
          <button type="button" className="calc-modal-btn calc-modal-btn-del" onClick={() => press("⌫")}>
            ⌫
          </button>
          <button type="button" className="calc-modal-btn calc-modal-btn-ac" onClick={() => press("AC")}>
            AC
          </button>
          <button type="button" className="calc-modal-btn calc-modal-btn-eq" onClick={() => press("=")}>
            =
          </button>
        </div>

        <div className="calc-modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={handleConfirm}>
            填入
          </button>
        </div>
      </div>
    </div>
  );
}

type AmountInputProps = {
  name: string;
  defaultValue?: number | string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

export function AmountInput({ name, defaultValue, placeholder, required, disabled }: AmountInputProps) {
  const [value, setValue] = useState(defaultValue != null ? String(defaultValue) : "");
  const [calcOpen, setCalcOpen] = useState(false);
  const lastClosedAt = useRef(0);

  const open = () => {
    if (disabled) return;
    if (Date.now() - lastClosedAt.current < 400) return;
    setCalcOpen(true);
  };

  const close = () => {
    lastClosedAt.current = Date.now();
    setCalcOpen(false);
  };

  return (
    <>
      <div className="amount-input-wrap">
        <input
          type="text"
          name={name}
          value={value}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly
          onClick={open}
          onChange={() => {}}
          className="amount-input-field"
        />
        <button
          type="button"
          className="amount-calc-btn"
          aria-label="開啟計算機"
          disabled={disabled}
          onClick={open}
        >
          🧮
        </button>
      </div>

      {calcOpen && (
        <CalculatorModal
          initial={value}
          onConfirm={(v) => { setValue(v); close(); }}
          onCancel={close}
        />
      )}
    </>
  );
}
