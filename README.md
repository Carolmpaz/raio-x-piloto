# Raio-x do piloto · Tako Recruiter

Página estática que lê a planilha exportada do painel do Tako Recruiter e mostra, na hora, o antes e o depois da Nara:
tempo até a lista, horas e dias de recrutadora, entrevistas fora do horário, ritmo do pacote, funil, adoção, alertas e
próximos passos.


## O problema

Durante o piloto, o time de AI Deployment precisa responder perguntas que o resumo do painel não responde: o ganho é
real ou vem de poucas pessoas? O pacote contratado vai acabar antes do fim do piloto? Quais vagas foram fechadas sem
lista? A análise era feita à mão, em planilha, a cada exportação. Esta página faz a mesma conta em segundos, sempre do
mesmo jeito, e explica cada número.

## Experimente

```bash
npm install
npm start            # http://localhost:3000 (ou a próxima porta livre)
```

Na página, arraste a planilha exportada do painel. As capturas abaixo usam dados fictícios.

<p>
  <img src="docs/inicio.png" alt="Tela inicial" width="49%">
</p>

## Segurança e privacidade

A planilha contém dados de clientes. As decisões abaixo garantem que ela não saia da máquina de quem usa:

- **Sem backend.** O arquivo é lido com a File API e processado em JavaScript no navegador.
- **Sem IA e sem agente.** As contas são regras fixas em [`src/core/`](src/core), cobertas por testes e descritas no
  rodapé da página. O mesmo arquivo gera sempre o mesmo resultado.
- **O navegador bloqueia qualquer envio.** O [`vercel.json`](vercel.json) aplica uma Content-Security-Policy com
  `connect-src 'none'` e `form-action 'none'`: a página não consegue fazer requisições nem enviar formulários, mesmo que
  alguém altere o código no navegador. O `npm start` aplica os mesmos cabeçalhos, então uma violação aparece já no
  desenvolvimento.
- **Sem CDN para código.** SheetJS e Chart.js estão versionados em [`vendor/`](vendor), com as licenças em
  [`vendor/licenses/`](vendor/licenses). A única chamada externa é a fonte do Google Fonts, que não recebe nenhum dado
  da planilha.
- **Sem `innerHTML`.** Todo texto vindo da planilha entra no DOM por `textContent`.
- **Validação de formato.** Antes de analisar, a página confere se existem as abas Convites, Vagas e Recrutadores e as
  colunas obrigatórias. Se faltar algo, ela diz o quê, em vez de mostrar números errados.
- **Planilhas nunca são versionadas.** O `.gitignore` bloqueia `*.xlsx` e `*.xls`.

## Arquitetura

```
arquivo .xlsx ──► SheetJS ──► parseWorkbook ──► analyze / buildAlerts ──► renderAll ──► DOM + Chart.js
                              (src/core/parse)   (src/core/analysis,      (src/ui/render)
                                                  src/core/alerts)
                              └───────────── funções puras, testadas em Node ─────────────┘
```

```
index.html              estrutura da página
styles.css              identidade visual (tema claro e escuro)
src/
  main.js               ponto de entrada: leitura do arquivo, estado e eventos
  core/                 regras de negócio, sem DOM
    format.js           formatação pt-BR e datas no formato serial do Excel
    parse.js            validação e normalização das abas
    analysis.js         métricas, antes e depois, projeção do pacote
    alerts.js           alertas e próximos passos
  ui/                   tudo o que toca o DOM
    dom.js, premissas.js, render.js
tests/                  testes com node:test, mais a planilha sintética usada como fixture
scripts/
  dev-server.js         servidor local com os cabeçalhos do vercel.json
vendor/                 SheetJS 0.18.5 e Chart.js 4.4.1
vercel.json             cabeçalhos de segurança e cache
```

### Decisões técnicas

| Decisão                                          | Motivo                                                                                                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Página estática, sem backend                     | Os dados nunca saem do navegador e não existe infraestrutura para manter.                                                                                                                        |
| ES modules nativos, sem bundler                  | O código roda no navegador como está, sem etapa de build. A CSP `script-src 'self'` continua estrita.                                                                                            |
| Sem framework de UI                              | A página é um relatório que se redesenha a cada filtro. Um framework somaria dependências e superfície de ataque sem ganho real.                                                                 |
| Núcleo separado da UI                            | `src/core/` não conhece o DOM. Isso permite testar todas as regras em Node e trocar a camada de apresentação sem tocar nas contas.                                                               |
| `parseWorkbook` recebe os utilitários do SheetJS | A dependência entra por parâmetro, então os testes usam a mesma versão vendorizada que o navegador.                                                                                              |
| Colunas encontradas por sinônimo e prefixo       | O painel muda nomes de coluna entre versões. A busca ignora acentos e caixa, e colunas opcionais ausentes têm regra de fallback documentada (por exemplo, horário comercial deduzido pela hora). |
| Fixture sintética determinística                 | Permite testar ponta a ponta (gravar `.xlsx`, ler e analisar) sem usar dados de clientes.                                                                                                        |

## Qualidade

```bash
npm test             # testes unitários e de integração (node:test)
npm run lint         # ESLint
npm run format       # Prettier
npm run check        # lint + formatação + testes, o mesmo que roda no CI
```

O [CI](.github/workflows/ci.yml) roda `npm run check` em cada push e pull request.

## Formato da planilha

| Aba              | Colunas                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Convites**     | ID candidato, ID vaga, Recrutador, Área, Data do convite, Status da entrevista, Data e hora da entrevista, Aprovado para a próxima fase (1/0). Opcionais: Vaga, Duração, Horário comercial, Confirmado pelo gestor. |
| **Vagas**        | ID vaga, Recrutador, Área, Situação (ativa ou encerrada), Número de dias para enviar a lista. Opcional: Vaga.                                                                                                       |
| **Recrutadores** | Recrutador, Área. Opcionais: Data de liberação do acesso, Nota na pesquisa de satisfação (vazio = não respondeu).                                                                                                   |
| Leia-me          | Opcional. Dela vem a data da exportação; sem ela, vale o dia seguinte à última entrevista.                                                                                                                          |

## Premissas padrão

Editáveis na própria página, em **Premissas**: pacote de 800 entrevistas, triagem por telefone de 20 a 30 min, 6 a 8
triagens por recrutadora por dia, 12 dias úteis até a lista no processo anterior, 5 min da recrutadora por candidato com
a Nara e jornada de 8 h. As datas (exportação e início do piloto) são lidas da planilha.

## Autoria

Feito por Caroline Paz.
