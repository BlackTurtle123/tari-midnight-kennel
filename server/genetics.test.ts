import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { renderCanine } from "../shared/canine-renderer.ts";
import { VARIANTS, colorForSalt, genotypeFor } from "../shared/game.ts";
import { parseCanine, parseLegacyCanine } from "./nft.ts";
const root = new URL("../src/assets/canines/", import.meta.url);
const parts: Record<string,string> = {}, styles: Record<string,string> = {};
for (const entry of readdirSync(root, {withFileTypes:true})) {
  if (entry.isDirectory()) for (const file of readdirSync(new URL(entry.name+"/", root))) parts[`${entry.name}/${file}`] = readFileSync(new URL(`${entry.name}/${file}`,root),"utf8");
  else styles[entry.name] = readFileSync(new URL(entry.name,root),"utf8");
}
test("original canine layers support all eight gene positions including mixed H", () => {
  const rendered = new Set<string>();
  for (let index=0; index<8; index++) {
    const genes = "AAAAAAAA".slice(0,index)+"H"+"AAAAAAAA".slice(index+1);
    const svg = renderCanine(genes,parts,styles);
    assert.ok(!svg.includes("undefined"));
    assert.ok(svg.includes("CANI-H-"));
    rendered.add(svg);
  }
  assert.equal(rendered.size,8);
  assert.throws(()=>renderCanine("WWWWWWWW",parts,styles));
  for (const v of VARIANTS) assert.ok(renderCanine(v.genes,parts,styles).length>10000);
});
test("inventory enforces genes, canonical name, colour and native genotype together", () => {
  for (let variant=0; variant<VARIANTS.length; variant++) for (let byte=0; byte<4; byte++) {
    const v=VARIANTS[variant], color=colorForSalt(byte.toString(16).padStart(2,"0")+"a".repeat(62));
    const data={variant:String(variant), name:v.name, genes:v.genes, color, genotype:genotypeFor(v.genes,color), generation:"0",art_version:"waves-canines-v1",incubation_id:"a".repeat(32)};
    assert.equal(parseCanine(data,"resource_test")?.genotype,data.genotype);
    assert.equal(parseCanine({...data,genes:"AAAABBBB"},"resource_test"),null);
    assert.equal(parseCanine({...data,color:"U"},"resource_test"),null);
    assert.equal(parseCanine({...data,genotype:genotypeFor(v.genes,"U")},"resource_test"),null);
  }
});

test("original NFTs retain their immutable genes instead of acquiring new traits", () => {
  const data={variant:"5",name:"Bat-Eared Bandit",genes:"FFFFDDDD",generation:"0",incubation_id:"a".repeat(32)};
  const legacy=parseLegacyCanine(data,"resource_original");
  assert.equal(legacy?.genes,"FFFFDDDD");
  assert.equal(legacy?.color,undefined);
  assert.equal(legacy?.legacy,true);
  assert.equal(parseCanine(data,"resource_original"),null);
});
