/*
 * Servidor local sem dependências. Aplica os mesmos cabeçalhos do vercel.json (inclusive a CSP),
 * para que problemas de segurança apareçam no desenvolvimento, e não só em produção.
 * Uso: npm start  (porta configurável com PORT=8080 npm start)
 * Sem PORT, usa a 3000 ou a próxima livre.
 */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixedPort = Number(process.env.PORT) || null;
const MAX_TRIES = 10;
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

/* converte o "source" do vercel.json (ex.: "/vendor/(.*)") em expressão regular */
function headersFor(urlPath) {
  const out = {};
  for (const rule of vercel.headers || []) {
    if (new RegExp("^" + rule.source + "$").test(urlPath)) for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
}

const server = createServer(function (req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (urlPath === "/") urlPath = "/index.html";
  const file = normalize(join(root, urlPath));
  const blocked = !file.startsWith(root + sep) || /[\\/](node_modules|\.git)([\\/]|$)/.test(file);
  if (blocked || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Não encontrado");
    return;
  }
  res.writeHead(200, { ...headersFor(urlPath), "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});

/* sem PORT definida, uma porta ocupada não derruba o servidor: tenta a seguinte */
function listen(port, triesLeft) {
  server.once("error", function (err) {
    if (err.code === "EADDRINUSE" && !fixedPort && triesLeft > 0) {
      console.log("Porta " + port + " ocupada, tentando " + (port + 1) + "...");
      listen(port + 1, triesLeft - 1);
      return;
    }
    console.error(
      err.code === "EADDRINUSE" ? "Porta " + port + " ocupada. Escolha outra com PORT=8080 npm start." : err.message,
    );
    process.exit(1);
  });
  server.listen(port);
}

server.once("listening", function () {
  console.log("Raio-x do piloto em http://localhost:" + server.address().port);
});

listen(fixedPort || 3000, MAX_TRIES);
