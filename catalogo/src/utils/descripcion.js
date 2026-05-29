/**
 * Convierte texto plano de descripción a markdown formateado.
 */
export function prepararDescripcion(texto) {
  if (!texto) return "";
  let t = texto.replace(/\r\n/g, "\n").trim();

  // Si ya tiene saltos de línea, convertir bullets unicode y devolver
  if (t.includes("\n")) {
    return t.replace(/^[•·▪▸►‣]\s*/gm, "- ");
  }

  // ── Detectar claves "Palabra(s): " ────────────────────────────
  // El 2do carácter debe ser minúscula para excluir siglas ("ATM", "LED", "CR2025"...)
  const keyRegex = /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ][a-záéíóúñA-ZÁÉÍÓÚÑ ]{0,20}?):\s+/g;
  const segmentos = [];
  let m;
  while ((m = keyRegex.exec(t)) !== null) {
    segmentos.push({
      clave:       m[1].trim(),
      inicio:      keyRegex.lastIndex,
      inicioMatch: m.index,
    });
  }

  if (segmentos.length === 0) return t;

  // ── Construir items ───────────────────────────────────────────
  const items = [];

  // Texto intro antes de la primera clave
  if (segmentos[0].inicioMatch > 0) {
    const prev = t.slice(0, segmentos[0].inicioMatch).trim();
    if (prev) items.push({ tipo: "parrafo", valor: prev });
  }

  for (let i = 0; i < segmentos.length; i++) {
    const seg = segmentos[i];
    const fin = i + 1 < segmentos.length ? segmentos[i + 1].inicioMatch : t.length;
    const valor = t.slice(seg.inicio, fin).trim();

    if (!valor) {
      items.push({ tipo: "header", valor: seg.clave });
      continue;
    }

    // Separar valor + features sin clave pegadas (split por minúscula→mayúscula)
    const partes = valor
      .replace(/([a-záéíóúñ])(\s+)([A-ZÁÉÍÓÚÑ])/g, "$1\n$3")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    items.push({ tipo: "clave", clave: seg.clave, valor: partes[0] });
    for (let j = 1; j < partes.length; j++) {
      items.push({ tipo: "feature", valor: partes[j] });
    }
  }

  // ── Detectar párrafo de cierre (solo mira los últimos 2 items) ──
  const esFrase = (s) => s?.endsWith(".") && s?.includes(",") && s?.length > 55;

  const n = items.length;
  if (n >= 2 && items[n - 1].tipo === "feature" && items[n - 2].tipo === "feature") {
    const combinado = `${items[n - 2].valor} ${items[n - 1].valor}`;
    if (esFrase(combinado)) {
      items.splice(n - 2, 2, { tipo: "cierre", valor: combinado });
    }
  }
  // Si el último item solo ya es una frase completa
  const last = items[items.length - 1];
  if (last?.tipo === "feature" && esFrase(last.valor)) {
    last.tipo = "cierre";
  }

  // ── Generar markdown ──────────────────────────────────────────
  return items.map((item) => {
    if (item.tipo === "parrafo") return `${item.valor}\n`;
    if (item.tipo === "header")  return `\n**${item.valor}**\n`;
    if (item.tipo === "clave")   return `- **${item.clave}:** ${item.valor}`;
    if (item.tipo === "cierre")  return `\n${item.valor}`;
    return `- ${item.valor}`;
  }).join("\n").trim();
}
