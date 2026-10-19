// Copia o processo comercial (coach/processo-comercial.md) para dentro da
// função do Coach no Supabase, que não lê arquivos fora da própria pasta.
//
// Rode depois de editar o processo:  node scripts/gera-processo-coach.mjs
// e publique a função de novo.
import { readFileSync, writeFileSync } from "node:fs";

const origem = new URL("../coach/processo-comercial.md", import.meta.url);
const destino = new URL("../supabase/functions/coach/processo.ts", import.meta.url);

const texto = readFileSync(origem, "utf8");
writeFileSync(
  destino,
  "// GERADO por scripts/gera-processo-coach.mjs a partir de coach/processo-comercial.md.\n" +
    "// Não edite aqui: edite o .md e rode o script de novo.\n" +
    `export const PROCESSO = ${JSON.stringify(texto)};\n`,
);
console.log(`processo.ts gerado (${texto.length} caracteres)`);
