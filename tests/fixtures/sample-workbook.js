/*
 * Planilha sintética no formato exportado pelo painel. Todos os nomes e números são fictícios.
 * Gerada com semente fixa: o mesmo código produz sempre o mesmo arquivo.
 * Usada pelos testes, gerada em memória.
 */
import { serialFromParts } from "../../src/core/format.js";

/* gerador pseudoaleatório determinístico (mulberry32) */
function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PILOT_START = serialFromParts(2025, 3, 3);
export const EXPORT_SERIAL = serialFromParts(2025, 3, 24, 9, 30);

const RECRUTADORES = [
  ["Ana Souza", "Tecnologia", 4.6],
  ["Bruno Lima", "Tecnologia", 4.4],
  ["Carla Mendes", "Tecnologia", null],
  ["Diego Rocha", "Operações", 4.8],
  ["Elisa Prado", "Operações", null],
  ["Fábio Nunes", "Operações", null],
  ["Gabriela Reis", "Comercial", null],
  ["Heitor Alves", "Comercial", null],
  ["Iara Costa", "Comercial", null],
  ["João Pires", "Logística", null],
];
/* id, cargo, recrutador, situação, dias até a lista, candidatos, taxa de aprovação */
const VAGAS = [
  ["V01", "Desenvolvedor(a) back-end", "Ana Souza", "Encerrada", 4, 48, 0.3],
  ["V02", "Analista de dados", "Ana Souza", "Ativa", null, 36, 0.3],
  ["V03", "Desenvolvedor(a) front-end", "Bruno Lima", "Encerrada", 5, 40, 0.25],
  ["V04", "Analista de suporte", "Bruno Lima", "Ativa", null, 30, 0.35],
  ["V05", "Operador(a) de armazém", "Diego Rocha", "Encerrada", 3, 60, 0.3],
  ["V06", "Líder de turno", "Diego Rocha", "Ativa", null, 34, 0.25],
  ["V07", "Assistente de operações", "Elisa Prado", "Encerrada", 2, 22, 0],
  ["V08", "Executivo(a) de vendas", "Gabriela Reis", "Ativa", null, 28, 0.3],
  ["V09", "Representante comercial", "Heitor Alves", "Ativa", null, 0, 0],
];

function areaOf(nome) {
  for (let i = 0; i < RECRUTADORES.length; i++) if (RECRUTADORES[i][0] === nome) return RECRUTADORES[i][1];
  return "";
}

function setFormat(ws, XLSX, colIdx, fmt) {
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let r = 1; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r: r, c: colIdx })];
    if (cell && cell.t === "n") cell.z = fmt;
  }
}

/** Monta o workbook com as abas Leia-me, Convites, Vagas e Recrutadores. */
export function buildSampleWorkbook(XLSX, seed) {
  const rand = rng(seed === undefined ? 42 : seed);
  const lastDay = Math.floor(EXPORT_SERIAL) - 1,
    span = lastDay - PILOT_START + 1;
  const convites = [
    [
      "ID candidato",
      "ID vaga",
      "Vaga",
      "Recrutador",
      "Área",
      "Data do convite",
      "Status da entrevista",
      "Data e hora da entrevista",
      "Duração (min)",
      "Horário comercial",
      "Aprovado para a próxima fase",
      "Confirmado pelo gestor",
    ],
  ];
  let cand = 1000;
  VAGAS.forEach(function (v) {
    const area = areaOf(v[2]),
      encerrada = v[3] === "Encerrada",
      doneRate = area === "Operações" ? 0.55 : 0.8;
    for (let i = 0; i < v[5]; i++) {
      /* convites concentrados na segunda metade do piloto */
      const conv = PILOT_START + Math.floor(Math.sqrt(rand()) * span) + (8 + Math.floor(rand() * 10)) / 24;
      /* entrevista de 0 a 4 dias após o convite; 65% em horário comercial, o resto à noite */
      const hour = rand() < 0.65 ? 8 + Math.floor(rand() * 10) : 18 + Math.floor(rand() * 5);
      let ent = Math.floor(conv) + Math.floor(rand() * rand() * 5) + (hour + Math.floor(rand() * 60) / 60) / 24;
      if (ent <= conv) ent += 1;
      const done = rand() < doneRate && ent < lastDay + 1; /* só até o dia anterior à exportação */
      const row = [
        "C" + cand++,
        v[0],
        v[1],
        v[2],
        area,
        conv,
        done ? "Concluída" : rand() < 0.5 ? "Não realizada" : "Convite enviado",
        null,
        null,
        null,
        null,
        null,
      ];
      if (done) {
        ent = Math.round(ent * 24 * 60) / (24 * 60);
        const dow = (new Date(Date.UTC(1899, 11, 30) + Math.floor(ent) * 86400000).getUTCDay() + 6) % 7,
          h = Math.floor((ent - Math.floor(ent)) * 24 + 1e-6);
        const apr = rand() < v[6] ? 1 : 0;
        row[7] = ent;
        row[8] = Math.round(12 + rand() * 14);
        row[9] = dow < 5 && h >= 8 && h < 18 ? "Sim" : "Não";
        row[10] = apr;
        row[11] = apr ? (encerrada ? (rand() < 0.8 ? "Sim" : "Não") : "Pendente") : null;
      }
      convites.push(row);
    }
  });
  const vagas = [
    [
      "ID vaga",
      "Vaga",
      "Recrutador",
      "Área",
      "Situação",
      "Número de dias para enviar a lista de aprovados para o gestor",
    ],
  ].concat(
    VAGAS.map(function (v) {
      return [v[0], v[1], v[2], areaOf(v[2]), v[3], v[4]];
    }),
  );
  const recs = [["Recrutador", "Área", "Data de liberação do acesso", "Nota na pesquisa de satisfação"]].concat(
    RECRUTADORES.map(function (r) {
      return [r[0], r[1], PILOT_START, r[2]];
    }),
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["Dados fictícios, gerados para demonstração."], ["Exportado em 24/03/2025 às 9h30"]]),
    "Leia-me",
  );
  const wsC = XLSX.utils.aoa_to_sheet(convites);
  setFormat(wsC, XLSX, 5, "dd/mm/yyyy hh:mm");
  setFormat(wsC, XLSX, 7, "dd/mm/yyyy hh:mm");
  XLSX.utils.book_append_sheet(wb, wsC, "Convites");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vagas), "Vagas");
  const wsR = XLSX.utils.aoa_to_sheet(recs);
  setFormat(wsR, XLSX, 2, "dd/mm/yyyy");
  XLSX.utils.book_append_sheet(wb, wsR, "Recrutadores");
  return wb;
}
