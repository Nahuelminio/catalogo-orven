/**
 * Genera y descarga un CSV con BOM UTF-8 (Excel lo abre bien).
 * @param {object[]} filas  - array de objetos
 * @param {string[]} cols   - columnas a incluir (y su orden)
 * @param {string[]} labels - encabezados legibles (mismo orden que cols)
 * @param {string}   nombre - nombre del archivo sin extensión
 */
export function descargarCSV(filas, cols, labels, nombre) {
  if (!filas.length) return;
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const contenido = [
    labels.join(","),
    ...filas.map((r) => cols.map((c) => escape(r[c])).join(",")),
  ].join("\n");
  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = nombre + ".csv"; a.click();
  URL.revokeObjectURL(url);
}
