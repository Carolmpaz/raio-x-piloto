/* Regras de cálculo do raio-x. Funções puras: mesma entrada, mesmo resultado. */
import { dayOf, hourOf, mean, ok, wd } from "./format.js";

/** Premissas padrão (kickoff e contrato). Datas vêm da planilha. */
export function defaultPrem(d) {
  return {
    exportDay: dayOf(d.exportSerial),
    start: d.start,
    end: d.start + 28,
    pack: 800,
    triMin: 20,
    triMax: 30,
    dayMin: 6,
    dayMax: 8,
    daysBefore: 12,
    nara: 5,
    journey: 8,
    goal: Math.max(1, Math.round(d.R.length * 0.8)),
  };
}

/** Dias úteis (segunda a sexta) entre a e b, inclusive. */
export function workdays(a, b) {
  let n = 0;
  for (let s = a; s <= b; s++) if (wd(s) < 5) n++;
  return n;
}

/** Áreas na ordem em que aparecem em Recrutadores e depois em Convites. */
export function listAreas(d) {
  const areas = [];
  d.R.concat(d.C).forEach(function (x) {
    if (x.area && areas.indexOf(x.area) < 0) areas.push(x.area);
  });
  return areas;
}

export function analyze(d, area, p) {
  const inA = function (x) {
    return area === "Todas" || x.area === area;
  };
  const C = d.C.filter(inA),
    V = d.V.filter(inA),
    R = d.R.filter(inA);
  const D = C.filter(function (c) {
    return c.done;
  });
  const A = { area: area, invited: C.length, done: D.length };
  A.apr = D.filter(function (c) {
    return c.apr === 1;
  }).length;
  A.conf = C.filter(function (c) {
    return c.gest === "sim";
  }).length;
  A.disc = C.filter(function (c) {
    return c.gest === "nao";
  }).length;
  A.pend = C.filter(function (c) {
    return c.gest === "pend";
  }).length;
  A.out = D.filter(function (c) {
    return c.hc === false;
  }).length;
  A.wknd = D.filter(function (c) {
    return wd(c.ent) >= 5;
  }).length;
  const closed = V.filter(function (v) {
    return v.sit.indexOf("encerr") === 0 && ok(v.dias);
  });
  A.daysAfter = mean(
    closed.map(function (v) {
      return v.dias;
    }),
  );
  A.closedN = closed.length;
  const durs = D.map(function (c) {
    return c.dur;
  }).filter(ok);
  A.dur = mean(durs);
  const inH = D.filter(function (c) {
      return c.hc === true;
    }),
    outH = D.filter(function (c) {
      return c.hc === false;
    });
  A.aprIn = inH.length
    ? inH.filter(function (c) {
        return c.apr === 1;
      }).length / inH.length
    : NaN;
  A.aprOut = outH.length
    ? outH.filter(function (c) {
        return c.apr === 1;
      }).length / outH.length
    : NaN;
  function confRate(arr) {
    const s = arr.filter(function (c) {
        return c.gest === "sim";
      }).length,
      n = arr.filter(function (c) {
        return c.gest === "nao";
      }).length;
    return s + n ? s / (s + n) : NaN;
  }
  A.confIn = confRate(inH);
  A.confOut = confRate(outH);
  A.confInN = inH.filter(function (c) {
    return c.gest === "sim" || c.gest === "nao";
  }).length;
  A.confOutN = outH.filter(function (c) {
    return c.gest === "sim" || c.gest === "nao";
  }).length;
  A.vagas = V.length;
  A.vagasSemConv = V.filter(function (v) {
    return !C.some(function (c) {
      return c.vaga === v.id;
    });
  }).length;

  /* antes e depois */
  const tri = (p.triMin + p.triMax) / 2,
    perDay = (p.dayMin + p.dayMax) / 2,
    elapsed = workdays(p.start, p.exportDay - 1);
  A.elapsed = elapsed;
  A.hBefore = (A.done * tri) / 60;
  A.hAfter = (A.done * p.nara) / 60;
  A.dBefore = A.done / perDay;
  A.dAfter = A.hAfter / p.journey;
  A.fteBefore = elapsed ? A.dBefore / elapsed : NaN;
  A.fteAfter = elapsed ? A.dAfter / elapsed : NaN;
  A.tri = tri;

  /* recrutadores */
  A.recs = R.map(function (r) {
    const mine = d.C.filter(function (c) {
        return c.rec === r.nome;
      }),
      md = mine.filter(function (c) {
        return c.done;
      });
    const vg = d.V.filter(function (v) {
      return v.rec === r.nome;
    }).length;
    return {
      nome: r.nome,
      area: r.area,
      vagas: vg,
      conv: mine.length,
      done: md.length,
      apr: md.filter(function (c) {
        return c.apr === 1;
      }).length,
      nota: r.nota,
      status: md.length > 0 ? "Ativo" : vg > 0 ? "Criou vaga sem entrevistas" : "Sem uso",
    };
  }).sort(function (a, b) {
    return b.done - a.done || a.nome.localeCompare(b.nome);
  });
  A.active = A.recs.filter(function (r) {
    return r.done > 0;
  }).length;
  A.access = A.recs.length;
  const tot = A.recs.reduce(function (s, r) {
    return s + r.done;
  }, 0);
  A.top4 = tot
    ? A.recs.slice(0, 4).reduce(function (s, r) {
        return s + r.done;
      }, 0) / tot
    : NaN;
  const resp = A.recs.filter(function (r) {
    return ok(r.nota);
  });
  A.respN = resp.length;
  A.respAvg = mean(
    resp.map(function (r) {
      return r.nota;
    }),
  );
  A.respShare = tot
    ? resp.reduce(function (s, r) {
        return s + r.done;
      }, 0) / tot
    : NaN;
  A.respActive = resp.filter(function (r) {
    return r.done > 0;
  }).length;

  /* série diária e projeção */
  const days = [],
    last = p.exportDay - 1,
    ndays = p.end - p.start + 1;
  let cum = 0;
  const byDay = {};
  D.forEach(function (c) {
    const k = dayOf(c.ent);
    byDay[k] = (byDay[k] || 0) + 1;
  });
  const invByDay = {};
  C.forEach(function (c) {
    if (ok(c.conv)) {
      const k = dayOf(c.conv);
      invByDay[k] = (invByDay[k] || 0) + 1;
    }
  });
  let r7 = 0;
  for (let s = p.exportDay - 7; s < p.exportDay; s++) r7 += byDay[s] || 0;
  A.rate = r7 / 7;
  let proj = 0;
  for (let s2 = p.start; s2 <= p.end; s2++) {
    const n = byDay[s2] || 0;
    if (s2 <= last) {
      cum += n;
      proj = cum;
    } else {
      proj += A.rate;
    }
    days.push({
      s: s2,
      n: s2 <= last ? n : null,
      inv: s2 <= last ? invByDay[s2] || 0 : null,
      cum: s2 <= last ? cum : null,
      meta: (p.pack * (s2 - p.start + 1)) / ndays,
      proj: proj,
    });
  }
  A.days = days;
  A.peak = Math.max.apply(
    null,
    days.map(function (x) {
      return x.n || 0;
    }),
  );
  A.packShare = A.done / p.pack;
  A.packEnd = A.rate > 0 ? p.exportDay + Math.ceil((p.pack - A.done) / A.rate) - 1 : null;
  A.projEnd = A.done + A.rate * Math.max(0, p.end - p.exportDay + 1);

  /* semanas (começam na segunda; a semana 1 é a do início do piloto) */
  const monday0 = p.start - wd(p.start),
    weeks = {};
  D.forEach(function (c) {
    const w = Math.floor((dayOf(c.ent) - monday0) / 7) + 1;
    weeks[w] = weeks[w] || { n: 0, recs: {} };
    weeks[w].n++;
    weeks[w].recs[c.rec] = 1;
  });
  const lastFull = Math.floor((p.exportDay - 1 - monday0) / 7) + 1;
  A.weeks = [];
  for (let w = 1; w <= lastFull; w++) {
    const o = weeks[w] || { n: 0, recs: {} };
    A.weeks.push({ w: w, n: o.n, recs: Object.keys(o.recs).length });
  }

  /* hora do dia, dia da semana e tempo de resposta ao convite */
  A.hourIn = new Array(24).fill(0);
  A.hourOut = new Array(24).fill(0);
  D.forEach(function (c) {
    const h = hourOf(c.ent);
    if (c.hc) A.hourIn[h]++;
    else A.hourOut[h]++;
  });
  A.wk = new Array(7).fill(0);
  A.wkApr = new Array(7).fill(0);
  D.forEach(function (c) {
    const k = wd(c.ent);
    A.wk[k]++;
    if (c.apr === 1) A.wkApr[k]++;
  });
  const B = [0, 0, 0, 0, 0],
    hrs = [];
  D.forEach(function (c) {
    if (!ok(c.conv)) return;
    const h = (c.ent - c.conv) * 24;
    hrs.push(h);
    B[h < 6 ? 0 : h < 24 ? 1 : h < 48 ? 2 : h < 96 ? 3 : 4]++;
  });
  A.resp = B;
  hrs.sort(function (a, b) {
    return a - b;
  });
  A.respMedian = hrs.length ? hrs[Math.floor(hrs.length / 2)] : NaN;
  A.within48 = hrs.length
    ? hrs.filter(function (h) {
        return h < 48;
      }).length / hrs.length
    : NaN;

  /* vagas */
  A.vrows = V.map(function (v) {
    const mine = d.C.filter(function (c) {
        return c.vaga === v.id;
      }),
      md = mine.filter(function (c) {
        return c.done;
      });
    const ap = md.filter(function (c) {
        return c.apr === 1;
      }).length,
      cs = mine.filter(function (c) {
        return c.gest === "sim";
      }).length,
      ds = mine.filter(function (c) {
        return c.gest === "nao";
      }).length;
    const conc = mine.length ? md.length / mine.length : NaN,
      aprR = md.length ? ap / md.length : NaN,
      encer = v.sit.indexOf("encerr") === 0;
    let alert = "";
    if (!mine.length) alert = "Vaga criada sem convites";
    else if (encer && ap === 0) alert = "Encerrada sem aprovados";
    else if (conc < 0.6) alert = "Conclusão abaixo de 60%";
    else if (md.length && aprR < 0.1) alert = "Aprovação abaixo de 10%";
    return {
      id: v.id,
      cargo: v.cargo,
      rec: v.rec,
      area: v.area,
      sit: encer ? "encerrada" : "ativa",
      dias: v.dias,
      conv: mine.length,
      done: md.length,
      conc: conc,
      apr: ap,
      aprR: aprR,
      confR: cs + ds ? cs / (cs + ds) : NaN,
      gain: encer && ok(v.dias) ? p.daysBefore - v.dias : NaN,
      alert: alert,
    };
  });
  return A;
}

/** Uma análise por área, mais a linha "Todas" no fim. */
export function areaTable(d, p) {
  return listAreas(d)
    .map(function (a) {
      return analyze(d, a, p);
    })
    .concat([analyze(d, "Todas", p)]);
}
