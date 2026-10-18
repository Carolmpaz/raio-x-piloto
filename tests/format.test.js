import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fDay,
  fDayY,
  fDec,
  fInt,
  fPct,
  fromIso,
  hourOf,
  isoOf,
  norm,
  num,
  serialFromParts,
  toSerial,
  wd,
} from "../src/core/format.js";

describe("formatação pt-BR", function () {
  it("formata inteiros, decimais e percentuais", function () {
    assert.equal(fInt(1234.6), "1.235");
    assert.equal(fDec(3.14159), "3,1");
    assert.equal(fDec(2, 0), "2");
    assert.equal(fPct(0.256), "26%");
    assert.equal(fPct(0.256, 1), "25,6%");
  });
  it("mostra traço para valores ausentes ou inválidos", function () {
    [null, undefined, NaN, Infinity].forEach(function (v) {
      assert.equal(fInt(v), "–");
      assert.equal(fDec(v), "–");
      assert.equal(fPct(v), "–");
    });
  });
});

describe("datas no formato serial do Excel", function () {
  const s = serialFromParts(2025, 3, 3, 14, 30); /* segunda-feira, 14h30 */
  it("extrai dia, dia da semana e hora", function () {
    assert.equal(fDay(s), "03/03");
    assert.equal(fDayY(s), "03/03/2025");
    assert.equal(wd(s), 0);
    assert.equal(wd(serialFromParts(2025, 3, 9)), 6);
    assert.equal(hourOf(s), 14);
  });
  it("converte de e para ISO", function () {
    assert.equal(isoOf(s), "2025-03-03");
    assert.equal(fromIso("2025-03-03"), Math.floor(s));
    assert.equal(fromIso(""), null);
  });
  it("aceita número, texto brasileiro e texto ISO", function () {
    assert.equal(toSerial(45719.5), 45719.5);
    assert.equal(toSerial("03/03/2025 14:30"), s);
    assert.equal(toSerial("2025-03-03T14:30"), s);
    assert.equal(toSerial("3/3/2025"), Math.floor(s));
  });
  it("devolve null para entradas vazias ou irreconhecíveis", function () {
    assert.equal(toSerial(null), null);
    assert.equal(toSerial(""), null);
    assert.equal(toSerial("amanhã"), null);
  });
});

describe("normalização de texto e números", function () {
  it("remove acentos, caixa e espaços extras", function () {
    assert.equal(norm("  Duração   (min) "), "duracao (min)");
    assert.equal(norm(null), "");
  });
  it("lê números com vírgula decimal", function () {
    assert.equal(num("4,5"), 4.5);
    assert.equal(num(3), 3);
    assert.equal(num(""), null);
    assert.equal(num("n/a"), null);
  });
});
