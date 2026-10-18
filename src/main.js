/* Ponto de entrada: leitura do arquivo, estado da página e eventos. SheetJS é carregado como global por <script>. */
import { defaultPrem, listAreas } from "./core/analysis.js";
import { parseWorkbook } from "./core/parse.js";
import { $, clear, el } from "./ui/dom.js";
import { PREM_IDS, readPrem, writePrem } from "./ui/premissas.js";
import { renderAll } from "./ui/render.js";

const state = { data: null, area: "Todas" };

function rerender() {
  if (state.data) renderAll(state.data, state.area, readPrem(state.data));
}

function buildAreas() {
  const seg = clear($("#areas"));
  ["Todas"].concat(listAreas(state.data)).forEach(function (a) {
    const b = el("button", { type: "button", "aria-pressed": String(a === state.area) }, a);
    b.addEventListener("click", function () {
      state.area = a;
      Array.prototype.forEach.call(seg.children, function (x) {
        x.setAttribute("aria-pressed", String(x.textContent === a));
      });
      rerender();
    });
    seg.appendChild(b);
  });
}

function showErrors(list) {
  const e = clear($("#errors"));
  e.appendChild(el("b", null, "Não deu para analisar esta planilha"));
  const ul = el("ul");
  list.forEach(function (t) {
    ul.appendChild(el("li", null, t));
  });
  e.appendChild(ul);
  e.classList.add("show");
}

function load(wb, name) {
  $("#errors").classList.remove("show");
  let d;
  try {
    d = parseWorkbook(wb, globalThis.XLSX.utils);
  } catch (err) {
    showErrors(["O arquivo não pôde ser lido como planilha do Excel (" + err.message + ")."]);
    return;
  }
  if (d.errors) {
    showErrors(d.errors);
    return;
  }
  state.data = d;
  state.area = "Todas";
  writePrem(defaultPrem(d));
  $("#fileName").textContent = name + (d.warnings.length ? " – " + d.warnings.join(" ") : "");
  $("#intro").hidden = true;
  $("#bar").classList.add("show");
  $("#main").classList.add("show");
  buildAreas();
  rerender();
  window.scrollTo(0, 0);
}

function readFile(f) {
  if (!f) return;
  const r = new FileReader();
  r.onload = function (e) {
    try {
      load(globalThis.XLSX.read(new Uint8Array(e.target.result), { type: "array" }), f.name);
    } catch {
      showErrors(["O arquivo não pôde ser lido como planilha do Excel. Confira se é um .xlsx exportado do painel."]);
    }
  };
  r.onerror = function () {
    showErrors(["Não foi possível ler o arquivo selecionado."]);
  };
  r.readAsArrayBuffer(f);
}

$("#btnPick").addEventListener("click", function () {
  $("#file").click();
});
$("#file").addEventListener("change", function (e) {
  readFile(e.target.files[0]);
  e.target.value = "";
});
const drop = $("#drop");
["dragenter", "dragover"].forEach(function (ev) {
  drop.addEventListener(ev, function (e) {
    e.preventDefault();
    drop.classList.add("over");
  });
});
["dragleave", "drop"].forEach(function (ev) {
  drop.addEventListener(ev, function (e) {
    e.preventDefault();
    drop.classList.remove("over");
  });
});
drop.addEventListener("drop", function (e) {
  readFile(e.dataTransfer.files[0]);
});
$("#btnReset").addEventListener("click", function () {
  $("#main").classList.remove("show");
  $("#bar").classList.remove("show");
  $("#prem").classList.remove("show");
  $("#btnPrem").setAttribute("aria-expanded", "false");
  $("#intro").hidden = false;
  state.data = null;
});
$("#btnPrem").addEventListener("click", function () {
  const p = $("#prem"),
    open = !p.classList.contains("show");
  p.classList.toggle("show", open);
  this.setAttribute("aria-expanded", String(open));
  if (open) p.scrollIntoView({ block: "nearest" });
});

/* premissas recalculam com debounce; tema claro/escuro redesenha os gráficos com as novas cores */
let tmr;
Object.keys(PREM_IDS).forEach(function (id) {
  document.getElementById(id).addEventListener("input", function () {
    clearTimeout(tmr);
    tmr = setTimeout(rerender, 200);
  });
});
const mq = window.matchMedia("(prefers-color-scheme: dark)");
if (mq.addEventListener) mq.addEventListener("change", rerender);
new MutationObserver(rerender).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
