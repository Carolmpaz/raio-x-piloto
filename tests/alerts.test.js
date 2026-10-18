import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAlerts, buildRecs } from "../src/core/alerts.js";
import { defaultPrem } from "../src/core/analysis.js";
import { sampleData } from "./helpers.js";

describe("alertas na planilha de exemplo", function () {
  const d = sampleData(),
    p = defaultPrem(d),
    al = buildAlerts(d, p);
  const keys = al.list.map(function (a) {
    return a.key;
  });

  it("dispara as regras esperadas para o cenário fictício", function () {
    ["adopt", "conc", "survey", "noinv", "abandon", "gap", "pend"].forEach(function (k) {
      assert.ok(keys.includes(k), "faltou o alerta " + k);
    });
  });
  it("aponta a vaga sem convites e a encerrada sem aprovados", function () {
    assert.match(
      al.list.find(function (a) {
        return a.key === "noinv";
      }).t,
      /V09 \(Heitor Alves\)/,
    );
    assert.match(
      al.list.find(function (a) {
        return a.key === "abandon";
      }).t,
      /V07 \(Elisa Prado/,
    );
  });
  it("gera no máximo três próximos passos, citando as pessoas envolvidas", function () {
    const recs = buildRecs(al, d, p);
    assert.ok(recs.length <= 3);
    assert.match(recs[0].d, /Elisa Prado e Heitor Alves/);
  });
  it("não dispara o alerta de adoção quando todos usam", function () {
    const allActive = Object.assign({}, d, {
      R: d.R.filter(function (r) {
        return d.C.some(function (c) {
          return c.rec === r.nome && c.done;
        });
      }),
    });
    const k = buildAlerts(allActive, defaultPrem(allActive)).list.map(function (a) {
      return a.key;
    });
    assert.ok(!k.includes("adopt"));
  });
});
