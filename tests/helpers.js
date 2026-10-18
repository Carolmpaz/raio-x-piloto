import { createRequire } from "node:module";
import { parseWorkbook } from "../src/core/parse.js";
import { buildSampleWorkbook } from "./fixtures/sample-workbook.js";

/* mesma versão do SheetJS servida para o navegador */
export const XLSX = createRequire(import.meta.url)("../vendor/xlsx-0.18.5.full.min.js");

/** Monta um workbook a partir de { "Nome da aba": [[cabeçalho...], [linha...]] }. */
export function workbook(sheets) {
  const wb = XLSX.utils.book_new();
  for (const name in sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheets[name]), name);
  return wb;
}

/** Workbook sintético após uma volta completa por arquivo .xlsx (escrita e leitura). */
export function sampleData() {
  const buf = XLSX.write(buildSampleWorkbook(XLSX), { type: "buffer", bookType: "xlsx" });
  return parseWorkbook(XLSX.read(buf, { type: "buffer" }), XLSX.utils);
}
