import test from 'node:test';
import assert from 'node:assert/strict';
import { TutorClient, type Question } from '../src/lib/client.ts';
import { connection } from '../src/lib/connection.ts';
import { favoriteMetadata, questionUpdate, questionListPath, materialText, calendarName, documentPreview } from '../src/lib/learning-records.ts';
import { photoQuestionDraft, PHOTO_QUESTION_PROMPT } from '../src/lib/photo-question.ts';
import { hasMath, mathMarkup, normalizeMathDelimiters } from '../src/lib/math-markup.ts';
import { visibleMessage, cancelledTurn } from '../src/lib/conversation.ts';

test('favorite metadata edit never sends immutable source fields', () => {
  assert.deepEqual(favoriteMetadata({ title: '整理', summary: '摘要', output: 'original', user_query: 'question' }), { title: '整理', summary: '摘要' });
});
test('question correction preserves provenance, scoring metadata and existing images', () => {
  const original = { id: 123, origin_type: 'external_import', origin_ref: 'import-1', question_id: 'q1', turn_id: '', source: 'import', material_id: 'm1', question: 'old', attempt_count: 4, resolved: true, user_answer_images: [{ id: 'photo', url: '/files/1' }], categories: [{ id: 5, name: '数学' }] } as unknown as Question;
  const update = questionUpdate(original, { question: ' corrected ', correct_answer: '12', user_answer: '10', explanation: 'check' });
  assert.equal(update.question, 'corrected');
  assert.equal(update.origin_ref, 'import-1'); assert.equal(update.question_id, 'q1'); assert.equal(update.attempt_count, 4);
  for (const key of ['id', 'resolved', 'categories', 'user_answer_images']) assert.equal(key in update, false);
  assert.throws(() => questionUpdate({ ...original, origin_ref: undefined }, {}), /来源/);
});
test('server search and pagination can reach records beyond 200 without changing filters', () => {
  const url = new URL(questionListPath('分数 & 计算', 'todo', 8), 'https://test.example');
  assert.equal(url.searchParams.get('offset'), '400'); assert.equal(url.searchParams.get('limit'), '50');
  assert.equal(url.searchParams.get('search'), '分数 & 计算'); assert.equal(url.searchParams.get('resolved'), 'false');
});
test('photo draft keeps original attachments, parses recognition and never saves the instruction as the question', () => {
  const photo = { type: 'image', url: '/files/attachments/sample.jpg', filename: 'sample.jpg' };
  const messages = [{ id: 'u1', role: 'user', content: PHOTO_QUESTION_PROMPT, attachments: [photo] },
    { id: 'a1', role: 'assistant', content: '【题目】3×4=?\n【我的作答】10\n【不确定之处】无' },
    { id: 'u2', role: 'user', content: '另一个问题' }, { id: 'a2', role: 'assistant', content: '另一个答案' }];
  const draft = photoQuestionDraft(messages, 's1', 'u1');
  assert.equal(draft.question, '3×4=?'); assert.equal(draft.user_answer, '10');
  assert.deepEqual(draft.images, [photo]); assert.equal(draft.explanation.includes('另一个答案'), false);
  const fallback = photoQuestionDraft([messages[0], { ...messages[1], content: '图片看不清，请校对。' }], 's1');
  assert.equal(fallback.question, ''); assert.equal(fallback.explanation, '图片看不清，请校对。'); assert.deepEqual(fallback.images, [photo]);
});
test('text export reads every unit and refuses partial, changed or retired content', async () => {
  const config = connection('https://study.example', 'server');
  const calls: string[] = [];
  let revision = 1, fail = false;
  const api = new TutorClient(config, null, (async input => {
    const path = new URL(String(input)).pathname; calls.push(path);
    if (path.endsWith('/units/2') && fail) return new Response('{}', { status: 500 });
    return new Response(JSON.stringify(path.includes('/units/') ? { text: path.endsWith('/1') ? '第一页中文' : '第二页中文' } : { revision, unit_count: 2 }));
  }) as typeof fetch);
  assert.equal(new TextDecoder().decode(await materialText(api, '/api/reading/materials/m1', 2, 1)), '第一页中文\n\n第二页中文');
  assert.deepEqual(calls.map(p => p.split('/').at(-1)), ['1', '2', 'm1']);
  revision = 2; await assert.rejects(materialText(api, '/api/reading/materials/m1', 2, 1), /发生变化/);
  revision = 1; fail = true; await assert.rejects(materialText(api, '/api/reading/materials/m1', 2, 1));
  api.close(); await assert.rejects(materialText(api, '/api/reading/materials/m1', 2, 1), /切换/);
});
test('default calendar and math-heavy list previews remain readable', () => {
  assert.equal(calendarName({ id: 'default', name: '' }), '默认日历');
  assert.equal(calendarName({ id: 'mine', name: '数学' }), '数学');
  assert.equal(documentPreview('分数 $\\frac{1}{2}$ **练习**'), '分数 (1)/(2) 练习');
  assert.equal(documentPreview('$$3 \\times 4 = ?$$'), '3 × 4 = ?');
  assert.equal(documentPreview('$\\unknown{a}$'), '〔数学公式〕');
  assert.equal(documentPreview('3*4; $x_i$'), '3*4; x_i');
});
test('escaped model math renders without stray slashes while escaped currency stays literal', () => {
  const reply = String.raw`也可以这样想：\$3 \times 4\$ 是 3 行、每行 4 个。`;
  assert.equal(hasMath(reply), true);
  const rendered = mathMarkup(reply);
  assert.match(rendered, /class="katex"/); assert.doesNotMatch(rendered, /katex-error/);
  assert.equal(normalizeMathDelimiters(String.raw`价格 \$3 至 \$4`), String.raw`价格 \$3 至 \$4`);
  assert.equal(hasMath(String.raw`价格 \$3 至 \$4`), false);
});
test('cancelled empty turns do not leave an empty bubble or become network failures', () => {
  const cancel = { type: 'error', content: 'Turn cancelled' };
  const empty = { role: 'assistant', content: '', events: [cancel] };
  assert.equal(cancelledTurn(cancel), true);
  assert.equal(cancelledTurn({ type: 'error', content: 'Upstream unavailable' }), false);
  assert.equal(visibleMessage(empty), false); assert.equal(visibleMessage(empty, true), true);
  assert.equal(visibleMessage({ ...empty, content: '已经生成的部分' }), true);
  assert.equal(visibleMessage({ ...empty, events: [{ type: 'result', metadata: { visualization: 'artifact' } }] }), true);
});
