import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "../dist/client/index.html");

let html = fs.readFileSync(htmlPath, "utf8");

const headEnd = html.indexOf("</head>");
const moduleRe = /<script type="module"[^>]*>[\s\S]*?<\/script>/;
const match = html.match(moduleRe);

if (match && html.indexOf(match[0]) < headEnd) {
  const script = match[0].replace(/ crossorigin/g, "");
  html = html.replace(match[0], "");
  html = html.replace("</body>", `    ${script}\n  </body>`);
}

html = html.replace(/ crossorigin/g, "");
fs.writeFileSync(htmlPath, html);
console.log("fix-html: moved app script to body end");
