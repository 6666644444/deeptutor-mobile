import { normalizeMathDelimiters } from "./math-markup.ts";

export type ReadingBlock = { kind: "text" | "heading" | "list" | "code"; text: string };

// Keep formula syntax intact while removing presentation syntax. In particular,
// multiplication, subscripts, currency and literal hashtags are not Markdown.
export function readingInline(value: string) {
  const protectedParts: string[] = [];
  const token = (part: string) => `\uE000${protectedParts.push(part) - 1}\uE001`;
  return value
    .replace(/(?<!\\)\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|(?<!\\)\$[^\n$]+?\$|\\\([^\n]*?\\\)/g, token)
    .replace(/`+([^`]+)`+/g, (_, body: string) => token(body))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, label: string) => label || "图片")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~/g, (_, a, b, c) => a || b || c)
    .replace(/(^|[\s，。：；（(])\*([^*\n]+)\*(?=$|[\s，。！？：；）)])/g, "$1$2")
    .replace(/(^|\s)_([^_\n]+)_(?=$|[\s，。！？])/g, "$1$2")
    .replace(/\\([#$*_`~>])/g, "$1")
    .replace(/\uE000(\d+)\uE001/g, (_, index: string) => protectedParts[Number(index)]);
}

/** Small, readable native paragraphs; no document-sized headings or raw tables. */
export function readingBlocks(source: string, streaming = false): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];
  const text = normalizeMathDelimiters(source).replace(/\r\n?/g, "\n");
  // Display formulas can span several lines; treat them as one reading block.
  const display: string[] = [];
  const keepFormula = (formula: string) => `\uE002${display.push(formula) - 1}\uE003`;
  const complete = text.replace(/(?<!\\)\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/g, keepFormula);
  // A stream can end inside a multi-line display formula. Keep the entire
  // unfinished block together so the following TeX lines never become prose.
  const lines = complete.replace(/(?<!\\)(?:\$\$|\\\[)[\s\S]*$/, keepFormula).split("\n");
  const restore = (s: string) => s.replace(/\uE002(\d+)\uE003/g, (_, index: string) => display[Number(index)]);
  let fence = "", code: string[] = [], headers: string[] | null = null;
  const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(s => readingInline(restore(s.trim())));
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const marker = /^(\x60{3,}|~{3,})/.exec(line);
    if (marker) {
      if (!fence) { fence = marker[1][0]; code = []; }
      else if (marker[1][0] === fence) { blocks.push({ kind: "code", text: code.join("\n") }); fence = ""; }
      continue;
    }
    if (fence) { code.push(restore(lines[i])); continue; }
    if (!line || /^([-*_])(?:\s*\1){2,}$/.test(line) || (streaming && /^[#*`]+$/.test(line))) { headers = null; continue; }
    if (line.includes("|") && i + 1 < lines.length && /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[i + 1].trim())) {
      headers = cells(line); i++; continue;
    }
    if (headers && line.includes("|")) {
      blocks.push({ kind: "text", text: cells(line).map((cell, n) => `${headers![n] || "内容"}：${cell}`).join("\n") });
      continue;
    }
    headers = null;
    const plain = line.replace(/^(?:>\s*)+/, "");
    const heading = /^#{1,6}\s+(.+?)(?:\s+#+)?$/.exec(plain);
    const list = /^[-*+]\s+(?:\[([ xX])\]\s+)?(.+)$/.exec(plain);
    blocks.push({
      kind: heading ? "heading" : list ? "list" : "text",
      text: readingInline(restore(heading ? heading[1] : list ? `${list[1] ? (list[1].trim() ? "✓" : "○") : "•"} ${list[2]}` : plain)),
    });
  }
  if (fence && code.length) blocks.push({ kind: "code", text: code.join("\n") });
  return blocks;
}
