#!/usr/bin/env node
/**
 * Auto bump patch version + atualiza tabela do README.
 *
 * Uso:
 *   npm run bump                          # incrementa patch, descrição genérica
 *   npm run bump "fix gallery filters"    # incrementa patch + descrição específica
 *   npm run bump minor "novo header"      # incrementa minor (zera patch)
 *   npm run bump major "redesign"         # incrementa major (zera minor + patch)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const pkgPath = resolve(root, "package.json");
const readmePath = resolve(root, "README.md");

const args = process.argv.slice(2);
const levels = ["major", "minor", "patch"];
const level = levels.includes(args[0]) ? args[0] : "patch";
const description = (levels.includes(args[0]) ? args.slice(1) : args).join(" ").trim() || "Ajustes diversos";

// 1. Bump package.json
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [maj, min, pat] = pkg.version.split(".").map(Number);
let next;
if (level === "major") next = `${maj + 1}.0.0`;
else if (level === "minor") next = `${maj}.${min + 1}.0`;
else next = `${maj}.${min}.${pat + 1}`;

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// 2. Atualiza tabela do README
const readme = readFileSync(readmePath, "utf8");
const tableHeader = "| Versão | Mudanças |";
const idx = readme.indexOf(tableHeader);
if (idx === -1) {
  console.warn("⚠️  Tabela de versões não encontrada no README — apenas package.json foi atualizado.");
} else {
  // localiza fim da tabela (primeira linha em branco depois do cabeçalho)
  const after = readme.slice(idx);
  const lines = after.split("\n");
  // header (0), separator (1), rows (2..n)
  let endRow = 2;
  while (endRow < lines.length && lines[endRow].startsWith("|")) endRow++;
  const newRow = `| ${next.padEnd(6)} | ${description} |`;
  lines.splice(endRow, 0, newRow);
  const updated = readme.slice(0, idx) + lines.join("\n");
  writeFileSync(readmePath, updated);
}

console.log(`✓ Versão: ${pkg.version === next ? next : "??"}  (${level})`);
console.log(`✓ README atualizado: "${description}"`);
