/* Alertas e próximos passos: regras fixas, aplicadas sempre a todas as áreas. */
import { analyze, areaTable } from "./analysis.js";
import { fDay, fDec, fInt, fPct } from "./format.js";

export function buildAlerts(d, p) {
  const T = analyze(d, "Todas", p),
    list = [],
    byArea = areaTable(d, p).slice(0, -1);
  if (T.access && T.active / T.access < 0.6)
    list.push({
      lvl: "bad",
      key: "adopt",
      t: "Só " + T.active + " de " + T.access + " recrutadores fizeram entrevistas",
      d: "O ritmo do pacote vem de poucas pessoas. Para decidir o anual, o cliente vai olhar o time inteiro.",
    });
  if (T.top4 >= 0.6 && T.active > 4)
    list.push({
      lvl: "warn",
      key: "conc",
      t: "4 recrutadores concentram " + fPct(T.top4) + " do volume",
      d: "Se um deles parar, o ritmo cai. O resultado ainda não está distribuído pelo time.",
    });
  if (T.respN && T.respShare >= 0.8 && T.respN / T.access < 0.6)
    list.push({
      lvl: "warn",
      key: "survey",
      t: "A nota " + fDec(T.respAvg) + " vem de " + T.respN + " de " + T.access + " recrutadores",
      d: "Quem respondeu soma " + fPct(T.respShare) + " do volume: a pesquisa mede quem já usa, não o time.",
    });
  const noInv = T.vrows.filter(function (v) {
      return v.conv === 0;
    }),
    abandon = T.vrows.filter(function (v) {
      return v.alert === "Encerrada sem aprovados";
    });
  if (noInv.length)
    list.push({
      lvl: "warn",
      key: "noinv",
      t:
        noInv.length +
        " vaga(s) criada(s) sem convites: " +
        noInv
          .map(function (v) {
            return v.id + " (" + v.rec + ")";
          })
          .join(", "),
      d: "O resumo do painel conta " + T.vagas + " vagas, mas só " + (T.vagas - noInv.length) + " têm candidatos.",
    });
  if (abandon.length)
    list.push({
      lvl: "bad",
      key: "abandon",
      t:
        abandon.length +
        " vaga(s) encerrada(s) sem aprovados: " +
        abandon
          .map(function (v) {
            return v.id + " (" + v.rec + ", " + v.done + " de " + v.conv + " entrevistas)";
          })
          .join(", "),
      d: "O tempo curto até a lista dessas vagas não é rapidez: elas foram fechadas sem lista. Vale conversar com quem as criou.",
    });
  byArea.forEach(function (a) {
    if (a.invited >= 10 && a.done / a.invited < T.done / T.invited - 0.15)
      list.push({
        lvl: "warn",
        key: "gap",
        area: a.area,
        t:
          a.area +
          " conclui " +
          fPct(a.done / a.invited) +
          " das entrevistas, contra " +
          fPct(T.done / T.invited) +
          " no geral",
        d:
          "Candidatos dessa área desistem mais. Entrevistas duram em média " +
          fDec(a.dur) +
          " min, contra " +
          fDec(T.dur) +
          " min no geral.",
      });
  });
  byArea.forEach(function (a) {
    if (a.invited === 0 && a.access > 0)
      list.push({
        lvl: "warn",
        key: "gap",
        area: a.area,
        t: a.area + " ainda não fez nenhuma entrevista",
        d: a.access + " recrutador(es) com acesso e nenhum convite enviado.",
      });
  });
  if (T.packEnd !== null && T.packEnd < p.end)
    list.push({
      lvl: "warn",
      key: "pack",
      t: "No ritmo atual, o pacote acaba em " + fDay(T.packEnd) + ", antes do fim do piloto (" + fDay(p.end) + ")",
      d:
        "Projeção de " +
        fInt(T.projEnd) +
        " entrevistas até o fim. Assunto para alinhar internamente antes de falar com o cliente.",
    });
  const W = T.weeks;
  if (W.length >= 2) {
    const a1 = W[W.length - 2],
      a2 = W[W.length - 1];
    if (a2.recs < a1.recs && a2.n > a1.n)
      list.push({
        lvl: "warn",
        key: "weeks",
        t:
          "O volume cresceu " +
          fPct(a2.n / a1.n - 1) +
          ", mas os recrutadores ativos caíram de " +
          a1.recs +
          " para " +
          a2.recs,
        d: "O crescimento vem das mesmas pessoas, não da entrada de novas.",
      });
  }
  if (T.pend)
    list.push({
      lvl: "warn",
      key: "pend",
      t: T.pend + " aprovados aguardando decisão do gestor",
      d: "Ficam em vagas ainda ativas. A taxa de confirmação final depende de quando essas listas forem enviadas.",
    });
  return { list: list, T: T };
}

export function buildRecs(al, d, p) {
  const T = al.T,
    keys = al.list.map(function (a) {
      return a.key;
    }),
    recs = [];
  const gapAreas = al.list
    .filter(function (a) {
      return a.key === "gap";
    })
    .map(function (a) {
      return a.area;
    });
  let people = T.vrows
    .filter(function (v) {
      return v.alert === "Vaga criada sem convites" || v.alert === "Encerrada sem aprovados";
    })
    .map(function (v) {
      return v.rec;
    });
  people = people.filter(function (x, i) {
    return people.indexOf(x) === i;
  });
  if (gapAreas.length || people.length)
    recs.push({
      t: "Entender e destravar " + (gapAreas.length ? gapAreas.join(" e ") : "as vagas com problema"),
      d:
        (people.length
          ? "Conversar com " +
            (people.length > 1 ? people.slice(0, -1).join(", ") + " e " + people[people.length - 1] : people[0]) +
            " para entender o que travou. "
          : "") +
        "Revisar a configuração dessas vagas, como roteiro de perguntas e critérios, e rodar pelo menos uma vaga real por área até " +
        fDay(p.end) +
        ".",
    });
  if (keys.indexOf("adopt") >= 0 || keys.indexOf("conc") >= 0)
    recs.push({
      t: "Ativar os " + (T.access - T.active) + " recrutadores parados",
      d:
        "Sessão prática curta, com cada um criando uma vaga real, e os maiores usuários como referência. Meta: " +
        p.goal +
        " de " +
        T.access +
        " ativos até " +
        fDay(p.end) +
        "." +
        (keys.indexOf("pack") >= 0
          ? " Isso acelera o consumo do pacote: combinar antes, internamente, o que fazer se ele acabar."
          : ""),
    });
  recs.push({
    t: "Definir agora os critérios de decisão do plano anual",
    d:
      "Combinar com o cliente os números da tabela abaixo" +
      (keys.indexOf("survey") >= 0
        ? " e refazer a pesquisa com todo o time na última semana, perguntando a quem não usou o que impediu."
        : "."),
  });
  return recs.slice(0, 3);
}
