import test from "node:test";
import assert from "node:assert/strict";
import { readingBlocks, readingInline } from "../src/lib/reading-content.ts";
import { hasMath, mathMarkup } from "../src/lib/math-markup.ts";

test("child reading removes markup but keeps lists, quotations and mathematical meaning", () => {
  const blocks = readingBlocks(String.raw`### **一起算一算**
> 先看这里。
- **苹果**有 $3 \\times 4$ 个。
* 再看 [这道题](https://example.com) 和 \`答案\`。
---
价格是 \$3。#数学是标签，3*4 是算式。`);
  assert.equal(blocks[0].text, "一起算一算");
  assert.equal(blocks[0].kind, "heading");
  assert.equal(blocks[1].text, "先看这里。");
  assert.match(blocks[2].text, /^• 苹果有 \$3/);
  assert.doesNotMatch(blocks.map(b => b.text).join("\n"), /###|\*\*|https:\/\//);
  assert.match(blocks.at(-1)!.text, /\$3。#数学是标签，3\*4/);
});

test("small-screen tables become labeled rows without separator bars", () => {
  assert.deepEqual(readingBlocks("| 水果 | 数量 |\n| --- | ---: |\n| 苹果 | **3** |\n| 梨 | 4 |"), [
    { kind: "text", text: "水果：苹果\n数量：3" },
    { kind: "text", text: "水果：梨\n数量：4" },
  ]);
});

test("formula and code syntax are preserved rather than stripped as prose", () => {
  assert.equal(readingInline("分数 $x_i * y_j$ 和 `a**b`"), "分数 $x_i * y_j$ 和 a**b");
  assert.deepEqual(readingBlocks("```python\n# 注释\nx = 2**3\n```"), [{ kind: "code", text: "# 注释\nx = 2**3" }]);
  assert.equal(readingBlocks("先看\n$$\n\\frac{1}{2}\n$$")[1].text, "$$\n\\frac{1}{2}\n$$");
});

test("streaming and malformed formulas do not expose dollar delimiters or TeX errors", () => {
  assert.equal(hasMath("价格 $3 至 $4"), false);
  assert.equal(hasMath(String.raw`计算 \$3 + 4 = 7\$`), true);
  assert.match(mathMarkup("先算 $3 +", true), /公式正在生成/);
  assert.doesNotMatch(mathMarkup("先算 $3 +", true), /\$/);
  assert.match(mathMarkup("$3+4=7"), /class="katex"/);
  assert.doesNotMatch(mathMarkup(String.raw`$\notarealcommand{a}$`), /katex-error|notarealcommand|\$/);
  assert.deepEqual(readingBlocks("###", true), []);
  const pending = readingBlocks("先看分数：\n$$\n\\frac{1}{2}\n+", true);
  assert.equal(pending.length, 2);
  assert.match(mathMarkup(pending[1].text, true), /公式正在生成/);
  assert.doesNotMatch(mathMarkup(pending[1].text, true), /frac|\$|\\/);
});
