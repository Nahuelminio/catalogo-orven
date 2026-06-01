import { useEffect } from "react";

/** Toast flotante. tipo: "ok" | "error" | "warn" */
export default function Toast({ mensaje, tipo = "ok", onClose }) {
  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(onClose, 2800);
    return () => clearTimeout(t);
  }, [mensaje]);

  if (!mensaje) return null;

  return (
    <div className={`toast toast-${tipo}`} onClick={onClose}>
      {tipo === "ok"   && "✓ "}
      {tipo === "error" && "✗ "}
      {tipo === "warn"  && "⚠️ "}
      {mensaje}
    </div>
  );
}
