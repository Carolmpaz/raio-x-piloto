/* Leitura e validação da planilha exportada do painel. Recebe o workbook já lido e os utilitários do SheetJS. */
import { DAY, EPOCH, dayOf, hourOf, norm, num, ok, toSerial, wd } from "./format.js";

/** Abas e colunas esperadas. Cada coluna aceita sinônimos (comparação sem acento, por igualdade e depois por prefixo). */
export const SCHEMA = {
  convites: {
    label: "Convites",
    sheet: ["convite"],
    cols: {
      id: ["id candidato"],
      vaga: ["id vaga"],
      cargo: ["vaga", "cargo"],
      rec: ["recrutador"],
      area: ["area"],
      conv: ["data do convite"],
      status: ["status"],
      ent: ["data e hora", "data da entrevista"],
      dur: ["duracao"],
      hc: ["horario comercial"],
      apr: ["aprovado"],
      gest: ["confirmado"],
    },
    optional: ["hc", "dur", "gest", "cargo"],
  },
  vagas: {
    label: "Vagas",
    sheet: ["vaga"],
    cols: {
      id: ["id vaga"],
      cargo: ["vaga", "cargo"],
      rec: ["recrutador"],
      area: ["area"],
      sit: ["situacao"],
      dias: ["numero de dias", "dias"],
    },
    optional: ["cargo"],
  },
  recs: {
    label: "Recrutadores",
    sheet: ["recrutador"],
    cols: { nome: ["recrutador"], area: ["area"], acesso: ["data de liberacao"], nota: ["nota"] },
    optional: ["acesso", "nota"],
  },
};

export function findSheet(wb, keys, used) {
  const names = wb.SheetNames;
  for (let i = 0; i < names.length; i++) {
    const n = norm(names[i]);
    if (used.indexOf(names[i]) >= 0) continue;
    for (let j = 0; j < keys.length; j++) {
      if (n.indexOf(keys[j]) === 0) return names[i];
    }
  }
  return null;
}
export function findCol(headers, keys) {
  const H = headers.map(norm);
  let i, k;
  for (k = 0; k < keys.length; k++) {
    for (i = 0; i < H.length; i++) if (H[i] === keys[k]) return headers[i];
  }
  for (k = 0; k < keys.length; k++) {
    for (i = 0; i < H.length; i++) if (H[i].indexOf(keys[k]) === 0) return headers[i];
  }
  return null;
}

/** Procura em qualquer aba um texto com "exportad..." e extrai a data (e a hora, se houver). */
function findExportSerial(wb, utils) {
  let exportSerial = null;
  wb.SheetNames.forEach(function (n) {
    if (exportSerial !== null) return;
    const aoa = utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null });
    for (let i = 0; i < aoa.length && exportSerial === null; i++)
      for (let j = 0; j < aoa[i].length; j++) {
        const t = aoa[i][j];
        if (typeof t !== "string" || norm(t).indexOf("exportad") < 0) continue;
        let m = t.match(/(\d{2})\/(\d{2})\/(\d{4})[^0-9]{0,12}(\d{1,2})h(\d{2})?/);
        if (m) {
          exportSerial = (Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +(m[5] || 0)) - EPOCH) / DAY;
          break;
        }
        m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) {
          exportSerial = (Date.UTC(+m[3], +m[2] - 1, +m[1]) - EPOCH) / DAY;
          break;
        }
      }
  });
  return exportSerial;
}

/**
 * Valida e normaliza o workbook.
 * @returns {{errors:string[]}|{C:object[],V:object[],R:object[],exportSerial:number,start:number,warnings:string[]}}
 */
export function parseWorkbook(wb, utils) {
  const errors = [],
    out = {},
    used = [];
  ["convites", "vagas", "recs"].forEach(function (key) {
    const sc = SCHEMA[key],
      sh = findSheet(wb, sc.sheet, used);
    if (!sh) {
      errors.push("Falta a aba “" + sc.label + "”.");
      return;
    }
    used.push(sh);
    const rows = utils.sheet_to_json(wb.Sheets[sh], { defval: null, raw: true });
    if (!rows.length) {
      errors.push("A aba “" + sh + "” está vazia.");
      return;
    }
    const headers = Object.keys(rows[0]),
      map = {},
      miss = [];
    for (const c in sc.cols) {
      const col = findCol(headers, sc.cols[c]);
      if (col) map[c] = col;
      else if (sc.optional.indexOf(c) < 0) miss.push(sc.cols[c][0]);
    }
    if (miss.length) {
      errors.push("Na aba “" + sh + "” faltam as colunas: " + miss.join(", ") + ".");
      return;
    }
    out[key] = { rows: rows, map: map, sheet: sh };
  });
  if (errors.length) return { errors: errors };

  const cm = out.convites.map,
    C = [];
  let bad = 0;
  out.convites.rows.forEach(function (r) {
    const st = norm(r[cm.status]);
    const done = st.indexOf("conclu") === 0;
    const ent = toSerial(r[cm.ent]),
      conv = toSerial(r[cm.conv]);
    if (!r[cm.vaga] && !r[cm.id]) return;
    if (done && ent === null) bad++;
    const hcv = cm.hc ? norm(r[cm.hc]) : "";
    let hc = null;
    /* sem a coluna (ou com valor desconhecido), vale segunda a sexta, das 8h às 17h59 */
    if (done && ent !== null) {
      hc = hcv === "sim" ? true : hcv === "nao" ? false : wd(ent) < 5 && hourOf(ent) >= 8 && hourOf(ent) < 18;
    }
    const g = cm.gest ? norm(r[cm.gest]) : "";
    C.push({
      id: r[cm.id],
      vaga: String(r[cm.vaga]),
      cargo: cm.cargo ? r[cm.cargo] : "",
      rec: String(r[cm.rec] || "").trim(),
      area: String(r[cm.area] || "").trim(),
      conv: conv,
      done: done && ent !== null,
      ent: ent,
      dur: cm.dur ? num(r[cm.dur]) : null,
      hc: hc,
      apr: num(r[cm.apr]),
      gest: g === "sim" ? "sim" : g === "nao" ? "nao" : g.indexOf("pend") === 0 ? "pend" : null,
    });
  });
  const vm = out.vagas.map,
    V = [];
  out.vagas.rows.forEach(function (r) {
    if (!r[vm.id]) return;
    V.push({
      id: String(r[vm.id]),
      cargo: vm.cargo ? r[vm.cargo] : "",
      rec: String(r[vm.rec] || "").trim(),
      area: String(r[vm.area] || "").trim(),
      sit: norm(r[vm.sit]),
      dias: num(r[vm.dias]),
    });
  });
  const rm = out.recs.map,
    R = [];
  out.recs.rows.forEach(function (r) {
    if (!r[rm.nome]) return;
    R.push({
      nome: String(r[rm.nome]).trim(),
      area: String(r[rm.area] || "").trim(),
      acesso: rm.acesso ? toSerial(r[rm.acesso]) : null,
      nota: rm.nota ? num(r[rm.nota]) : null,
    });
  });
  /* recrutadores que aparecem em convites ou vagas, mas não na aba Recrutadores */
  C.concat(V).forEach(function (x) {
    if (
      x.rec &&
      !R.some(function (r) {
        return r.nome === x.rec;
      })
    )
      R.push({ nome: x.rec, area: x.area, acesso: null, nota: null });
  });

  /* data da exportação vem do Leia-me; sem ela, vale o dia seguinte à última entrevista */
  let exportSerial = findExportSerial(wb, utils);
  const ents = C.filter(function (c) {
    return c.done;
  }).map(function (c) {
    return c.ent;
  });
  if (!ents.length) return { errors: ["Nenhuma entrevista concluída com data foi encontrada na aba Convites."] };
  const lastEnt = Math.max.apply(null, ents);
  if (exportSerial === null) exportSerial = dayOf(lastEnt) + 1;
  const starts = R.map(function (r) {
    return r.acesso;
  }).filter(ok);
  const convs = C.map(function (c) {
    return c.conv;
  }).filter(ok);
  const start = dayOf(starts.length ? Math.min.apply(null, starts) : Math.min.apply(null, convs));
  const warn = bad ? [bad + " entrevista(s) marcadas como concluídas sem data foram ignoradas."] : [];
  return { C: C, V: V, R: R, exportSerial: exportSerial, start: start, warnings: warn };
}
