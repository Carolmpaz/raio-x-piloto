import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyze, areaTable, defaultPrem, listAreas, workdays } from "../src/core/analysis.js";
import { serialFromParts } from "../src/core/format.js";
import { sampleData } from "./helpers.js";

const MON = serialFromParts(2025, 3, 3);

/* dataset mínimo, montado à mão, com resultado conhecido */
function tiny() {
  function c(id, rec, area, dayOff, hour, done, apr, gest, hc) {
    return {
      id: id,
      vaga: "V-" + rec,
      cargo: "",
      rec: rec,
      area: area,
      conv: MON + dayOff,
      done: done,
      ent: done ? MON + dayOff + hour / 24 : null,
      dur: done ? 20 : null,
      hc: done ? hc : null,
      apr: apr,
      gest: gest,
    };
  }
  return {
    C: [
      c("1", "Ana", "TI", 0, 10, true, 1, "sim", true),
      c("2", "Ana", "TI", 1, 20, true, 1, "nao", false),
      c("3", "Ana", "TI", 5, 11, true, 0, null, false),
      c("4", "Bia", "RH", 2, 9, true, 1, "pend", true),
      c("5", "Bia", "RH", 2, 9, false, null, null, null),
    ],
    V: [
      { id: "V-Ana", cargo: "", rec: "Ana", area: "TI", sit: "encerrada", dias: 4 },
      { id: "V-Bia", cargo: "", rec: "Bia", area: "RH", sit: "ativa", dias: null },
      { id: "V-Caio", cargo: "", rec: "Caio", area: "RH", sit: "ativa", dias: null },
    ],
    R: [
      { nome: "Ana", area: "TI", acesso: MON, nota: 4.5 },
      { nome: "Bia", area: "RH", acesso: MON, nota: null },
      { nome: "Caio", area: "RH", acesso: MON, nota: null },
    ],
    exportSerial: MON + 7.4,
    start: MON,
    warnings: [],
  };
}

describe("workdays", function () {
  it("conta só segunda a sexta, inclusive nas pontas", function () {
    assert.equal(workdays(MON, MON + 6), 5);
    assert.equal(workdays(MON + 5, MON + 6), 0);
    assert.equal(workdays(MON, MON + 13), 10);
  });
});

describe("defaultPrem", function () {
  it("usa as datas da planilha e meta de 80% dos recrutadores", function () {
    const p = defaultPrem(tiny());
    assert.equal(p.exportDay, MON + 7);
    assert.equal(p.start, MON);
    assert.equal(p.end, MON + 28);
    assert.equal(p.goal, 2);
  });
});

describe("analyze", function () {
  const d = tiny(),
    p = defaultPrem(d),
    A = analyze(d, "Todas", p);
  it("conta o funil", function () {
    assert.equal(A.invited, 5);
    assert.equal(A.done, 4);
    assert.equal(A.apr, 3);
    assert.equal(A.conf, 1);
    assert.equal(A.disc, 1);
    assert.equal(A.pend, 1);
  });
  it("separa horário comercial e fim de semana", function () {
    assert.equal(A.out, 2);
    assert.equal(A.wknd, 1);
  });
  it("calcula o antes e depois a partir das premissas", function () {
    assert.equal(A.tri, 25);
    assert.equal(A.hBefore, (4 * 25) / 60);
    assert.equal(A.hAfter, (4 * 5) / 60);
    assert.equal(A.elapsed, 5);
    assert.equal(A.daysAfter, 4);
  });
  it("classifica o uso de cada recrutador", function () {
    const byName = {};
    A.recs.forEach(function (r) {
      byName[r.nome] = r.status;
    });
    assert.deepEqual(byName, { Ana: "Ativo", Bia: "Ativo", Caio: "Criou vaga sem entrevistas" });
    assert.equal(A.active, 2);
    assert.equal(A.access, 3);
  });
  it("marca vagas sem convites", function () {
    const v = A.vrows.find(function (x) {
      return x.id === "V-Caio";
    });
    assert.equal(v.alert, "Vaga criada sem convites");
    assert.equal(
      A.vrows.find(function (x) {
        return x.id === "V-Ana";
      }).gain,
      8,
    );
  });
  it("filtra por área", function () {
    const RH = analyze(d, "RH", p);
    assert.equal(RH.invited, 2);
    assert.equal(RH.done, 1);
    assert.equal(RH.access, 2);
  });
  it("o total da tabela por área é a análise de todas as áreas", function () {
    const t = areaTable(d, p);
    assert.deepEqual(
      t.map(function (a) {
        return a.area;
      }),
      listAreas(d).concat(["Todas"]),
    );
    assert.equal(t.at(-1).done, A.done);
  });
});

describe("analyze na planilha de exemplo", function () {
  const d = sampleData(),
    p = defaultPrem(d),
    A = analyze(d, "Todas", p);
  it("a soma das áreas fecha com o total", function () {
    const areas = areaTable(d, p).slice(0, -1);
    assert.equal(
      areas.reduce(function (s, a) {
        return s + a.done;
      }, 0),
      A.done,
    );
    assert.equal(
      areas.reduce(function (s, a) {
        return s + a.invited;
      }, 0),
      A.invited,
    );
  });
  it("o acumulado diário termina no total de entrevistas", function () {
    const last = A.days
      .filter(function (x) {
        return x.cum !== null;
      })
      .at(-1);
    assert.equal(last.cum, A.done);
  });
  it("é determinística", function () {
    assert.deepEqual(analyze(sampleData(), "Todas", p), A);
  });
});
