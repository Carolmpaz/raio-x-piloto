/* Renderização da página a partir dos resultados de analyze(). Chart.js é carregado como global por <script>. */
import { buildAlerts, buildRecs } from "../core/alerts.js";
import { analyze, areaTable } from "../core/analysis.js";
import { fDay, fDayY, fDec, fInt, fPct, ok } from "../core/format.js";
import { $, clear, css, el } from "./dom.js";

const charts = {};

function COLORS() {
  return {
    nara: css("--nara"),
    before: css("--before"),
    warn: css("--warn"),
    ink: css("--ink"),
    muted: css("--muted"),
    line: css("--line"),
    bad: css("--bad"),
    panel: css("--panel"),
  };
}
function mkChart(id, cfg) {
  const Chart = globalThis.Chart;
  if (charts[id]) charts[id].destroy();
  const c = COLORS();
  Chart.defaults.locale = "pt-BR";
  Chart.defaults.font.family = '"Manrope",system-ui,sans-serif';
  Chart.defaults.color = c.muted;
  Chart.defaults.borderColor = c.line;
  charts[id] = new Chart(document.getElementById(id), cfg);
}
function baseOpts(extra) {
  const c = COLORS();
  const o = {
    locale: "pt-BR",
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12, usePointStyle: false } },
      tooltip: { backgroundColor: c.ink, titleColor: c.panel, bodyColor: c.panel, padding: 10, cornerRadius: 8 },
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: c.line }, ticks: { precision: 0 } },
    },
  };
  if (extra) for (const k in extra) o[k] = extra[k];
  return o;
}
function fact(cls, big, txt) {
  const f = el("div", { class: "fact " + (cls || "") });
  f.appendChild(el("b", null, big));
  f.appendChild(el("span", { class: "small muted" }, txt));
  return f;
}

/** Redesenha a página inteira para a área e as premissas informadas. */
export function renderAll(d, area, p) {
  const A = analyze(d, area, p),
    c = COLORS();
  const areaLabel = area === "Todas" ? "todas as áreas" : area;

  /* veredito e régua de dias */
  const vd = $("#verdict");
  if (A.done === 0) {
    vd.textContent = "Sem entrevistas concluídas em " + areaLabel + ". Escolha outra área para ver o antes e depois.";
  } else {
    vd.textContent = ok(A.daysAfter)
      ? "Em " +
        areaLabel +
        ", a lista chega ao gestor em " +
        fDec(A.daysAfter) +
        " dias úteis, contra " +
        fDec(p.daysBefore, 0) +
        " no processo anterior, e " +
        fPct(A.out / A.done) +
        " das entrevistas acontecem fora do horário comercial."
      : "Em " +
        areaLabel +
        ", " +
        fPct(A.out / A.done) +
        " das entrevistas acontecem fora do horário comercial. Ainda não há vagas encerradas para medir o tempo até a lista.";
  }
  const ruler = clear($("#ruler"));
  const maxD = Math.max(p.daysBefore, ok(A.daysAfter) ? A.daysAfter : 0, 1),
    cells = Math.ceil(maxD);
  function track(cls, label, val) {
    const t = el("div", { class: "track " + cls });
    t.appendChild(el("span", { class: "lab" }, label));
    const ds = el("div", {
      class: "days",
      role: "img",
      "aria-label": label + ": " + (ok(val) ? fDec(val) : "sem dado") + " dias úteis",
    });
    for (let i = 0; i < cells; i++) {
      const cell = el("div", { class: "day" });
      cell.style.width = "calc((100% - " + 3 * (cells - 1) + "px) / " + cells + ")";
      const fill = ok(val) ? Math.max(0, Math.min(1, val - i)) : 0;
      const ii = el("i");
      ii.style.width = fill * 100 + "%";
      cell.appendChild(ii);
      ds.appendChild(cell);
    }
    t.appendChild(ds);
    const nm = el("span", { class: "num" }, ok(val) ? fDec(val, cls === "before" ? 0 : 1) : "–");
    nm.appendChild(el("small", null, "dias"));
    t.appendChild(nm);
    return t;
  }
  ruler.appendChild(track("before", "Processo anterior", p.daysBefore));
  ruler.appendChild(track("nara", "Com a Nara", A.daysAfter));
  const ax = el("div", { class: "ruler-axis" });
  ax.appendChild(el("span"));
  ax.appendChild(
    el(
      "span",
      null,
      "Cada bloco é um dia útil, da abertura da vaga até a lista chegar ao gestor" +
        (ok(A.daysAfter) ? " (média de " + A.closedN + " vagas encerradas)" : "") +
        ".",
    ),
  );
  ax.appendChild(el("span"));
  ruler.appendChild(ax);

  const cmp = clear($("#cmp"));
  const head = el("div", { class: "cmp-row head" });
  ["Indicador", "Antes", "", "Com a Nara", "Variação"].forEach(function (h, i) {
    const s = el("span", { class: i === 2 ? "pair-h" : i === 4 ? "d" : i ? "v" : "" }, h);
    if (i === 1 || i === 3) s.style.textAlign = "right";
    head.appendChild(s);
  });
  cmp.appendChild(head);
  const rows = [
    [
      "Horas de recrutadora em triagem",
      A.hBefore,
      A.hAfter,
      fDec,
      "Entrevistas × " + fDec(A.tri, 0) + " min antes; × " + fDec(p.nara, 0) + " min para ler a avaliação",
    ],
    [
      "Dias de trabalho de recrutadora",
      A.dBefore,
      A.dAfter,
      fDec,
      "Antes: " +
        fDec((p.dayMin + p.dayMax) / 2) +
        " triagens por dia. Depois: horas ÷ jornada de " +
        fDec(p.journey, 0) +
        "h",
    ],
    [
      "Recrutadoras em tempo integral só triando",
      A.fteBefore,
      A.fteAfter,
      function (n) {
        return fDec(n);
      },
      "Dias de recrutadora ÷ " + A.elapsed + " dias úteis decorridos",
    ],
    [
      "Entrevistas fora do horário comercial",
      0,
      A.out,
      fInt,
      fPct(A.done ? A.out / A.done : NaN) + " do total; antes, a triagem só acontecia em horário comercial",
    ],
    ["Entrevistas em fim de semana", 0, A.wknd, fInt, "Antes era zero"],
    ["Duração da conversa com o candidato (min)", A.tri, A.dur, fDec, "Com a Nara, a conversa não ocupa a recrutadora"],
  ];
  rows.forEach(function (r) {
    const row = el("div", { class: "cmp-row" });
    const lab = el("span", null, r[0]);
    lab.appendChild(el("span", { class: "how" }, r[4]));
    row.appendChild(lab);
    row.appendChild(el("span", { class: "v" }, r[3](r[1])));
    const mx = Math.max(ok(r[1]) ? r[1] : 0, ok(r[2]) ? r[2] : 0) || 1,
      pair = el("div", { class: "pair", "aria-hidden": "true" });
    const a = el("span", { class: "a" });
    a.style.width = (ok(r[1]) ? Math.max((r[1] / mx) * 100, r[1] > 0 ? 1 : 0) : 0) + "%";
    const b = el("span", { class: "b" });
    b.style.width = (ok(r[2]) ? Math.max((r[2] / mx) * 100, r[2] > 0 ? 1 : 0) : 0) + "%";
    pair.appendChild(a);
    pair.appendChild(b);
    row.appendChild(pair);
    row.appendChild(el("span", { class: "v n" }, r[3](r[2])));
    const dv =
      r[1] === 0
        ? r[2] > 0
          ? "novo"
          : "–"
        : ok(r[1]) && ok(r[2])
          ? (r[2] >= r[1] ? "+" : "") + fPct(r[2] / r[1] - 1)
          : "–";
    row.appendChild(el("span", { class: "d" }, dv));
    cmp.appendChild(row);
  });

  /* indicadores */
  $("#kpiNote").textContent = "Dados até " + fDayY(p.exportDay - 1) + ", área: " + areaLabel + ".";
  const kp = clear($("#kpis"));
  [
    [
      "Entrevistas concluídas",
      fInt(A.done),
      "de " + fInt(A.invited) + " convidados (" + fPct(A.invited ? A.done / A.invited : NaN) + ")",
    ],
    ["Aprovados pela recrutadora", fInt(A.apr), fPct(A.done ? A.apr / A.done : NaN) + " das entrevistas"],
    [
      "Confirmação do gestor",
      fPct(A.conf + A.disc ? A.conf / (A.conf + A.disc) : NaN),
      A.conf + " de " + (A.conf + A.disc) + " avaliados; " + A.pend + " pendentes",
    ],
    ["Horas de triagem poupadas", fDec(A.hBefore - A.hAfter, 0), "com " + fDec(p.nara, 0) + " min por candidato"],
    ["Recrutadores ativos", A.active + " de " + A.access, fPct(A.access ? A.active / A.access : NaN) + " do time"],
    [
      "Pacote consumido",
      fPct(A.packShare),
      area === "Todas"
        ? A.packEnd
          ? "acaba em " + fDay(A.packEnd) + " no ritmo atual"
          : "–"
        : "parte desta área no pacote",
    ],
  ].forEach(function (k) {
    const w = el("div", { class: "kpi" });
    w.appendChild(el("dt", null, k[0]));
    const dd = el("dd", null, k[1]);
    dd.appendChild(el("small", null, k[2]));
    w.appendChild(dd);
    kp.appendChild(w);
  });

  /* ritmo do pacote */
  const labels = A.days.map(function (x) {
    return fDay(x.s);
  });
  mkChart("cPace", {
    data: {
      labels: labels,
      datasets: [
        {
          type: "bar",
          label: "Entrevistas no dia",
          data: A.days.map(function (x) {
            return x.n;
          }),
          backgroundColor: c.before,
          borderRadius: 4,
          yAxisID: "y1",
          order: 3,
        },
        {
          type: "line",
          label: "Acumulado real",
          data: A.days.map(function (x) {
            return x.cum;
          }),
          borderColor: c.ink,
          backgroundColor: c.ink,
          borderWidth: 2.5,
          pointRadius: 0,
          yAxisID: "y",
          order: 1,
        },
        {
          type: "line",
          label: "Projeção no ritmo atual",
          data: A.days.map(function (x) {
            return x.cum === null || x.s === p.exportDay - 1 ? x.proj : null;
          }),
          borderColor: c.warn,
          borderDash: [2, 4],
          borderWidth: 2,
          pointRadius: 0,
          yAxisID: "y",
          order: 1,
          spanGaps: false,
        },
        {
          type: "line",
          label: area === "Todas" ? "Meta linear do pacote" : "Meta linear do pacote (todas as áreas)",
          data: A.days.map(function (x) {
            return x.meta;
          }),
          borderColor: c.muted,
          borderDash: [6, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: "y",
          order: 2,
        },
      ],
    },
    options: baseOpts({
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
        y: {
          beginAtZero: true,
          position: "left",
          title: { display: true, text: "Acumulado" },
          grid: { color: c.line },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          title: { display: true, text: "Por dia" },
          grid: { display: false },
        },
      },
    }),
  });
  const pf = clear($("#paceFacts"));
  const W = A.weeks;
  pf.appendChild(
    fact("", fDec(A.rate) + " por dia", "ritmo médio dos 7 dias antes da exportação; pico de " + A.peak + " em um dia"),
  );
  if (W.length >= 2) {
    const w1 = W[W.length - 2],
      w2 = W[W.length - 1];
    pf.appendChild(
      fact(
        w2.recs < w1.recs ? "warn" : "good",
        (w2.n >= w1.n ? "+" : "") + fPct(w1.n ? w2.n / w1.n - 1 : NaN) + " na semana " + w2.w,
        w1.n + " → " + w2.n + " entrevistas; recrutadores ativos: " + w1.recs + " → " + w2.recs,
      ),
    );
  }
  if (area === "Todas" && A.packEnd)
    pf.appendChild(
      fact(
        A.packEnd < p.end ? "warn" : "good",
        "Pacote acaba em " + fDay(A.packEnd),
        "projeção de " +
          fInt(A.projEnd) +
          " entrevistas até " +
          fDay(p.end) +
          ", para " +
          fInt(p.pack) +
          " contratadas",
      ),
    );

  /* quando o candidato faz a entrevista */
  mkChart("cHour", {
    type: "bar",
    data: {
      labels: Array.from({ length: 24 }, function (_, h) {
        return String(h).padStart(2, "0") + "h";
      }),
      datasets: [
        { label: "Em horário comercial", data: A.hourIn, backgroundColor: c.before, borderRadius: 3, stack: "s" },
        { label: "Fora do horário", data: A.hourOut, backgroundColor: c.nara, borderRadius: 3, stack: "s" },
      ],
    },
    options: baseOpts({
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
        y: { stacked: true, beginAtZero: true, grid: { color: c.line }, ticks: { precision: 0 } },
      },
    }),
  });
  const wkNames = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
  mkChart("cWeek", {
    type: "bar",
    data: {
      labels: wkNames,
      datasets: [
        {
          label: "Entrevistas",
          data: A.wk,
          backgroundColor: wkNames.map(function (_, i) {
            return i >= 5 ? c.nara : c.before;
          }),
          borderRadius: 4,
        },
      ],
    },
    options: baseOpts({
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.ink,
          titleColor: c.panel,
          bodyColor: c.panel,
          callbacks: {
            afterLabel: function (ctx) {
              const i = ctx.dataIndex;
              return A.wk[i] ? "Aprovação: " + fPct(A.wkApr[i] / A.wk[i]) : "";
            },
          },
        },
      },
    }),
  });
  mkChart("cResp", {
    type: "bar",
    data: {
      labels: ["até 6h", "6 a 24h", "1 a 2 dias", "2 a 4 dias", "mais de 4 dias"],
      datasets: [{ label: "Entrevistas", data: A.resp, backgroundColor: c.nara, borderRadius: 4 }],
    },
    options: baseOpts({
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: c.ink, titleColor: c.panel, bodyColor: c.panel },
      },
    }),
  });
  const tf = clear($("#timeFacts"));
  tf.appendChild(
    fact(
      "good",
      fPct(A.done ? A.out / A.done : NaN) + " fora do horário",
      A.out + " entrevistas que o processo anterior não atenderia; " + A.wknd + " no fim de semana",
    ),
  );
  if (ok(A.aprOut) && ok(A.aprIn))
    tf.appendChild(
      fact(
        A.aprOut >= A.aprIn - 0.02 ? "good" : "warn",
        "Aprovação " + fPct(A.aprOut) + " x " + fPct(A.aprIn),
        A.aprOut >= A.aprIn - 0.02
          ? "fora x dentro do horário comercial: quem entrevista fora do horário não é pior candidato"
          : "fora x dentro do horário comercial: a aprovação é menor fora do horário",
      ),
    );
  if (ok(A.confOut) && ok(A.confIn))
    tf.appendChild(
      fact(
        Math.abs(A.confOut - A.confIn) > 0.08 ? "warn" : "",
        "Gestor confirma " + fPct(A.confOut) + " x " + fPct(A.confIn),
        "fora x dentro do horário, com " +
          A.confOutN +
          " e " +
          A.confInN +
          " decisões; amostra pequena, ler com cautela",
      ),
    );
  tf.appendChild(
    fact(
      "",
      fPct(A.within48) + " em até 2 dias",
      "mediana de " +
        fDec(A.respMedian / 24) +
        " dias entre o convite e a entrevista: avaliar a adesão antes disso é cedo",
    ),
  );

  /* funil e tabela por área */
  const fu = clear($("#funnel"));
  const steps = [
    ["Convidados", A.invited],
    ["Fizeram a entrevista", A.done],
    ["Aprovados pela recrutadora", A.apr],
    ["Avaliados pelo gestor", A.conf + A.disc],
    ["Confirmados pelo gestor", A.conf],
  ];
  steps.forEach(function (s, i) {
    const r = el("div", { class: "fstep" });
    const lab = el("span", null, s[0]);
    if (i)
      lab.appendChild(
        el(
          "span",
          { class: "conv" },
          i === 3 ? "(vagas encerradas)" : fPct(steps[i - 1][1] ? s[1] / steps[i - 1][1] : NaN) + " da etapa anterior",
        ),
      );
    r.appendChild(lab);
    const b = el("div", { class: "fbar" });
    const ii = el("i");
    ii.style.width = (A.invited ? (s[1] / A.invited) * 100 : 0) + "%";
    b.appendChild(ii);
    r.appendChild(b);
    r.appendChild(el("span", { class: "n" }, fInt(s[1])));
    fu.appendChild(r);
  });
  const at = areaTable(d, p),
    tA = clear($("#tArea"));
  const hd = [
    "Área",
    "Recrutadores ativos",
    "Vagas",
    "Convidados",
    "Entrevistas",
    "% conclusão",
    "Aprovados",
    "% aprovação",
    "Confirmação do gestor",
    "Duração média (min)",
    "Dias até a lista",
  ];
  const thr = el("tr");
  hd.forEach(function (h, i) {
    thr.appendChild(el("th", { class: i ? "r" : "" }, h));
  });
  const thd = el("thead");
  thd.appendChild(thr);
  tA.appendChild(thd);
  const tb = el("tbody");
  at.forEach(function (a) {
    const tr = el("tr", a.area === "Todas" ? { class: "total" } : null);
    const cells = [
      a.area === "Todas" ? "Total" : a.area,
      a.active + " de " + a.access,
      fInt(a.vagas),
      fInt(a.invited),
      fInt(a.done),
      fPct(a.invited ? a.done / a.invited : NaN),
      fInt(a.apr),
      fPct(a.done ? a.apr / a.done : NaN),
      fPct(a.conf + a.disc ? a.conf / (a.conf + a.disc) : NaN),
      fDec(a.dur),
      fDec(a.daysAfter),
    ];
    cells.forEach(function (v, i) {
      tr.appendChild(el("td", { class: i ? "r" : "" }, v));
    });
    tb.appendChild(tr);
  });
  tA.appendChild(tb);

  /* adoção */
  $("#adoptNote").textContent =
    A.active +
    " de " +
    A.access +
    " recrutadores com pelo menos uma entrevista" +
    (A.active > 4 ? "; os 4 maiores somam " + fPct(A.top4) + " do volume." : ".");
  const recs = A.recs;
  mkChart("cRec", {
    type: "bar",
    data: {
      labels: recs.map(function (r) {
        return r.nome;
      }),
      datasets: [
        {
          label: "Entrevistas",
          data: recs.map(function (r) {
            return r.done;
          }),
          backgroundColor: recs.map(function (r) {
            return r.done > 0 ? c.nara : r.vagas > 0 ? c.warn : c.before;
          }),
          borderRadius: 4,
          minBarLength: 3,
        },
      ],
    },
    options: baseOpts({
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.ink,
          titleColor: c.panel,
          bodyColor: c.panel,
          callbacks: {
            afterLabel: function (ctx) {
              const r = recs[ctx.dataIndex];
              return r.area + " · " + r.status;
            },
          },
        },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: c.line }, ticks: { precision: 0 } },
        y: { grid: { display: false }, ticks: { autoSkip: false } },
      },
    }),
  });
  const tR = clear($("#tRec"));
  const th2 = el("thead"),
    tr2 = el("tr");
  ["Recrutador", "Área", "Vagas", "Entrevistas", "Nota", "Uso"].forEach(function (h, i) {
    tr2.appendChild(el("th", { class: i >= 2 && i <= 4 ? "r" : "" }, h));
  });
  th2.appendChild(tr2);
  tR.appendChild(th2);
  const tb2 = el("tbody");
  recs.forEach(function (r) {
    const tr = el("tr");
    tr.appendChild(el("td", null, r.nome));
    tr.appendChild(el("td", null, r.area));
    tr.appendChild(el("td", { class: "r" }, fInt(r.vagas)));
    tr.appendChild(el("td", { class: "r" }, fInt(r.done)));
    tr.appendChild(el("td", { class: "r" }, ok(r.nota) ? fDec(r.nota) : "–"));
    const td = el("td");
    td.appendChild(
      el("span", { class: "pill " + (r.status === "Ativo" ? "ok" : r.status === "Sem uso" ? "" : "warn") }, r.status),
    );
    tr.appendChild(td);
    tb2.appendChild(tr);
  });
  tR.appendChild(tb2);
  const sf = clear($("#surveyFacts"));
  if (A.respN) {
    sf.appendChild(
      fact(
        A.respShare >= 0.8 && A.respN / A.access < 0.6 ? "warn" : "",
        "Nota " + fDec(A.respAvg) + " com " + A.respN + " de " + A.access + " respostas",
        A.respActive +
          " dos " +
          A.respN +
          " respondentes são usuários ativos, que somam " +
          fPct(A.respShare) +
          " do volume",
      ),
    );
  } else sf.appendChild(fact("", "Sem respostas na pesquisa", "nenhuma nota preenchida para " + areaLabel));

  /* vaga a vaga */
  const tV = clear($("#tVagas"));
  const th3 = el("thead"),
    tr3 = el("tr");
  [
    "Vaga",
    "Cargo",
    "Recrutador",
    "Área",
    "Situação",
    "Convites",
    "Entrevistas",
    "% conclusão",
    "Aprovados",
    "% aprovação",
    "Confirmação do gestor",
    "Dias até a lista",
    "Ganho (dias)",
    "Alerta",
  ].forEach(function (h, i) {
    tr3.appendChild(el("th", { class: i >= 5 && i <= 12 ? "r" : "" }, h));
  });
  th3.appendChild(tr3);
  tV.appendChild(th3);
  const tb3 = el("tbody");
  A.vrows.forEach(function (v) {
    const tr = el("tr");
    [v.id, v.cargo, v.rec, v.area, v.sit].forEach(function (x) {
      tr.appendChild(el("td", null, x));
    });
    [
      fInt(v.conv),
      fInt(v.done),
      fPct(v.conc),
      fInt(v.apr),
      fPct(v.aprR),
      fPct(v.confR),
      v.sit === "encerrada" && ok(v.dias) ? fInt(v.dias) : "em andamento",
      ok(v.gain) ? "+" + fInt(v.gain) : "–",
    ].forEach(function (x) {
      tr.appendChild(el("td", { class: "r" }, x));
    });
    const td = el("td");
    if (v.alert)
      td.appendChild(el("span", { class: "pill " + (v.alert.indexOf("sem") >= 0 ? "bad" : "warn") }, v.alert));
    tr.appendChild(td);
    tb3.appendChild(tr);
  });
  tV.appendChild(tb3);

  /* alertas e próximos passos (sempre todas as áreas) */
  const al = buildAlerts(d, p),
    ab = clear($("#alerts"));
  if (!al.list.length)
    ab.appendChild(el("p", { class: "empty" }, "Nenhuma regra de alerta disparou para esta planilha."));
  al.list.forEach(function (a) {
    const w = el("div", { class: "alert " + a.lvl });
    w.appendChild(el("span", { class: "dot", "aria-hidden": "true" }));
    const tx = el("div");
    tx.appendChild(el("b", null, a.t));
    tx.appendChild(el("p", null, a.d));
    w.appendChild(tx);
    ab.appendChild(w);
  });
  const rl = clear($("#recs"));
  buildRecs(al, d, p).forEach(function (r) {
    const li = el("li");
    const dv = el("div");
    dv.appendChild(el("b", null, r.t));
    dv.appendChild(el("p", null, r.d));
    li.appendChild(dv);
    rl.appendChild(li);
  });
  const T = al.T,
    tC = clear($("#tCrit"));
  const th4 = el("thead"),
    tr4 = el("tr");
  ["Critério", "Atual", "Meta sugerida", "Status"].forEach(function (h, i) {
    tr4.appendChild(el("th", { class: i === 1 || i === 2 ? "r" : "" }, h));
  });
  th4.appendChild(tr4);
  tC.appendChild(th4);
  const crit = [
    ["Recrutadores ativos", T.active, p.goal, fInt, ">="],
    ["Volume dos 4 maiores usuários", T.top4, 0.6, fPct, "<="],
    ["Dias úteis até a lista", T.daysAfter, 5, fDec, "<="],
    ["Confirmação do gestor", T.conf + T.disc ? T.conf / (T.conf + T.disc) : NaN, 0.75, fPct, ">="],
    ["Taxa de resposta da pesquisa", T.access ? T.respN / T.access : NaN, 0.8, fPct, ">="],
  ];
  const tb4 = el("tbody");
  crit.forEach(function (k) {
    const tr = el("tr");
    tr.appendChild(el("td", null, k[0]));
    tr.appendChild(el("td", { class: "r" }, k[3](k[1])));
    tr.appendChild(el("td", { class: "r" }, (k[4] === ">=" ? "pelo menos " : "no máximo ") + k[3](k[2])));
    const good = ok(k[1]) && (k[4] === ">=" ? k[1] >= k[2] : k[1] <= k[2]);
    const td = el("td");
    td.appendChild(el("span", { class: "pill " + (good ? "ok" : "warn") }, good ? "Atingido" : "Atenção"));
    tr.appendChild(td);
    tb4.appendChild(tr);
  });
  tC.appendChild(tb4);
}
