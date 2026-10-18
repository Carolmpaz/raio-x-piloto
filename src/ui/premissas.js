/* Painel de premissas: liga os campos do formulário às chaves usadas em analyze(). */
import { defaultPrem } from "../core/analysis.js";
import { fromIso, isoOf, num, ok } from "../core/format.js";

export const PREM_IDS = {
  pExport: "exportDay",
  pStart: "start",
  pEnd: "end",
  pPack: "pack",
  pTriMin: "triMin",
  pTriMax: "triMax",
  pDayMin: "dayMin",
  pDayMax: "dayMax",
  pDaysBefore: "daysBefore",
  pNara: "nara",
  pJourney: "journey",
  pGoal: "goal",
};
const DATE_KEYS = ["exportDay", "start", "end"];

export function writePrem(p) {
  for (const id in PREM_IDS) {
    const k = PREM_IDS[id],
      e = document.getElementById(id);
    e.value = DATE_KEYS.indexOf(k) >= 0 ? isoOf(p[k]) : p[k];
  }
}

/** Lê o formulário; campos vazios ou inválidos voltam ao valor padrão. */
export function readPrem(d) {
  const p = {};
  for (const id in PREM_IDS) {
    const k = PREM_IDS[id],
      v = document.getElementById(id).value;
    p[k] = DATE_KEYS.indexOf(k) >= 0 ? fromIso(v) : num(v);
  }
  const def = defaultPrem(d);
  for (const k2 in p) if (!ok(p[k2])) p[k2] = def[k2];
  return p;
}
