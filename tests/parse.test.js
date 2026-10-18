import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serialFromParts } from "../src/core/format.js";
import { findCol, parseWorkbook } from "../src/core/parse.js";
import { EXPORT_SERIAL, PILOT_START } from "./fixtures/sample-workbook.js";
import { XLSX, sampleData, workbook } from "./helpers.js";

const SEG_10H = serialFromParts(2025, 3, 3, 10, 0),
  SEG_21H = serialFromParts(2025, 3, 3, 21, 0),
  SAB_10H = serialFromParts(2025, 3, 8, 10, 0);

function minimal(convRows, extra) {
  const sheets = {
    Convites: [
      [
        "ID candidato",
        "ID vaga",
        "Recrutador",
        "Área",
        "Data do convite",
        "Status da entrevista",
        "Data e hora da entrevista",
        "Aprovado para a próxima fase",
      ],
    ].concat(convRows),
    Vagas: [
      ["ID vaga", "Recrutador", "Área", "Situação", "Número de dias"],
      ["V1", "Ana", "TI", "Ativa", null],
    ],
    Recrutadores: [
      ["Recrutador", "Área"],
      ["Ana", "TI"],
    ],
  };
  for (const k in extra) sheets[k] = extra[k];
  return workbook(sheets);
}

describe("findCol", function () {
  it("prefere igualdade exata e depois aceita prefixo, sem acento", function () {
    assert.equal(findCol(["Vaga", "ID vaga"], ["id vaga"]), "ID vaga");
    assert.equal(findCol(["Duração (min)"], ["duracao"]), "Duração (min)");
    assert.equal(findCol(["Outra"], ["duracao"]), null);
  });
});

describe("parseWorkbook: validação", function () {
  it("lista as abas que faltam", function () {
    const r = parseWorkbook(workbook({ Vagas: [["ID vaga"]] }), XLSX.utils);
    assert.ok(
      r.errors.some(function (e) {
        return e.includes("Convites");
      }),
    );
    assert.ok(
      r.errors.some(function (e) {
        return e.includes("Recrutadores");
      }),
    );
  });
  it("lista as colunas obrigatórias que faltam", function () {
    const wb = workbook({
      Convites: [
        ["ID candidato", "ID vaga"],
        ["C1", "V1"],
      ],
      Vagas: [
        ["ID vaga", "Recrutador", "Área", "Situação", "Dias"],
        ["V1", "Ana", "TI", "Ativa", 1],
      ],
      Recrutadores: [
        ["Recrutador", "Área"],
        ["Ana", "TI"],
      ],
    });
    const r = parseWorkbook(wb, XLSX.utils);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0], /Convites.*recrutador.*area.*data do convite/);
  });
  it("recusa planilha sem nenhuma entrevista concluída", function () {
    const r = parseWorkbook(minimal([["C1", "V1", "Ana", "TI", SEG_10H, "Não realizada", null, 0]]), XLSX.utils);
    assert.deepEqual(r.errors, ["Nenhuma entrevista concluída com data foi encontrada na aba Convites."]);
  });
});

describe("parseWorkbook: tolerância a dados incompletos", function () {
  it("sem a coluna Horário comercial, deduz pelo dia e hora", function () {
    const r = parseWorkbook(
      minimal([
        ["C1", "V1", "Ana", "TI", SEG_10H - 1, "Concluída", SEG_10H, 1],
        ["C2", "V1", "Ana", "TI", SEG_10H - 1, "Concluída", SEG_21H, 0],
        ["C3", "V1", "Ana", "TI", SEG_10H - 1, "Concluída", SAB_10H, 0],
      ]),
      XLSX.utils,
    );
    assert.deepEqual(
      r.C.map(function (c) {
        return c.hc;
      }),
      [true, false, false],
    );
  });
  it("ignora entrevistas concluídas sem data e avisa", function () {
    const r = parseWorkbook(
      minimal([
        ["C1", "V1", "Ana", "TI", SEG_10H, "Concluída", SEG_10H, 1],
        ["C2", "V1", "Ana", "TI", SEG_10H, "Concluída", null, 1],
      ]),
      XLSX.utils,
    );
    assert.equal(
      r.C.filter(function (c) {
        return c.done;
      }).length,
      1,
    );
    assert.match(r.warnings[0], /^1 entrevista/);
  });
  it("inclui recrutadores que só aparecem em convites", function () {
    const r = parseWorkbook(minimal([["C1", "V1", "Bia", "RH", SEG_10H, "Concluída", SEG_10H, 1]]), XLSX.utils);
    assert.deepEqual(
      r.R.map(function (x) {
        return x.nome;
      }),
      ["Ana", "Bia"],
    );
  });
  it("sem Leia-me, usa o dia seguinte à última entrevista como exportação", function () {
    const r = parseWorkbook(minimal([["C1", "V1", "Ana", "TI", SEG_10H, "Concluída", SAB_10H, 1]]), XLSX.utils);
    assert.equal(r.exportSerial, Math.floor(SAB_10H) + 1);
  });
  it("com Leia-me, lê a data e a hora da exportação", function () {
    const r = parseWorkbook(
      minimal([["C1", "V1", "Ana", "TI", SEG_10H, "Concluída", SEG_10H, 1]], {
        "Leia-me": [["Exportado em 10/03/2025 às 8h15"]],
      }),
      XLSX.utils,
    );
    assert.equal(r.exportSerial, serialFromParts(2025, 3, 10, 8, 15));
  });
});

describe("parseWorkbook: planilha de exemplo", function () {
  it("lê as datas do piloto e mantém todas as linhas", function () {
    const d = sampleData();
    assert.equal(d.errors, undefined);
    assert.equal(d.start, PILOT_START);
    assert.ok(Math.abs(d.exportSerial - EXPORT_SERIAL) < 1e-6);
    assert.equal(d.R.length, 10);
    assert.equal(d.V.length, 9);
    assert.ok(d.C.length > 200);
  });
});
