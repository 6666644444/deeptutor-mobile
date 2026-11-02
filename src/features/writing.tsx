import { NativeBlocks, inlineText, replaceBlock } from "./blocks";
import { ExportFile } from "./export";
import * as DocumentPicker from "expo-document-picker";
import { uploadBody } from "../lib/upload";
import { Data, object, string, array } from "./content";
import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../lib/auth";
import { useResource } from "../lib/resources";
import { Button, C, Field, Heading, Page, Row, Section, s } from "../ui";
import {
  Actions,
  Chips,
  Editor,
  Prose,
  Refresh,
  ResourceState,
  SmallAction,
  ask,
  confirmDelete,
  enc,
  feature,
  useAction,
} from "./common";
type Document = {
  id: string;
  title: string;
  content: string;
  revision: number;
  blocks?: Record<string, unknown>[];
  preview?: string;
  parent_id?: string;
  icon?: string;
  cover?: string;
  pinned?: boolean;
};
type Suggestion = {
  id: string;
  status?: string;
  summary?: string;
  title?: string;
  instruction?: string;
  blocks?: Record<string, unknown>[];
};
export function Writing({ id = "" }: { id?: string }) {
  const { api } = useAuth();
  const list = useResource<{ documents: Document[] }>("/api/documents");
  const r = useResource<Document>(id ? `/api/documents/${enc(id)}` : null);
  const suggestions = useResource<{ suggestions: Suggestion[] }>(
    id ? `/api/documents/${enc(id)}/suggestions` : null,
  );
  const [edit, setEdit] = useState(false);
  const [blockEdit, setBlockEdit] = useState<Data | null>(null);
  const [blockRevision, setBlockRevision] = useState(0);
  function editBlock(block: Data) {
    setBlockRevision(d?.revision || 0);
    setBlockEdit(block);
  }
  async function saveBlocks(blocks: Data[], revision: number) {
    await api?.json(
      `/api/documents/${enc(id)}`,
      { blocks, expected_revision: revision },
      "PUT",
    );
    await r.reload();
  }

  const [instruction, setInstruction] = useState("");
  const [mode, setMode] = useState("rewrite");
  const [candidate, setCandidate] = useState("");
  const [baseRevision, setBaseRevision] = useState(0);
  const action = useAction();
  const d = r.data;
  return (
    <Page>
      <Heading
        title={d?.title || "协作写作"}
        back
        right={<Refresh onPress={id ? r.reload : list.reload} />}
      />
      <ResourceState
        resource={id ? r : list}
        empty={!id && !list.data?.documents.length}
      />
      {!id ? (
        <>
          <Button title="新建文章" onPress={() => setEdit(true)} />
          <Button
            title="导入 Word 文档"
            secondary
            busy={action.busy}
            onPress={() =>
              void action.run(async () => {
                if (!api) return;
                const result = await DocumentPicker.getDocumentAsync({
                  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  copyToCacheDirectory: true,
                });
                if (result.canceled) return;
                const file = result.assets[0];
                const body = await uploadBody({}, [
                  {
                    uri: file.uri,
                    name: file.name,
                    mime: file.mimeType,
                    field: "file",
                  },
                ]);
                const doc = await api.request<Document>(
                  "/api/documents/import/docx",
                  { method: "POST", ...body },
                  true,
                  120000,
                );
                feature("writing", doc.id);
              })
            }
          />
          {list.data?.documents.map((d) => (
            <Row
              key={d.id}
              title={d.title || "未命名文章"}
              detail={d.preview}
              onPress={() => feature("writing", d.id)}
            />
          ))}
        </>
      ) : d ? (
        <>
          <View style={s.card}>
            {d.blocks?.length ? (
              <NativeBlocks
                blocks={d.blocks}
                onEdit={editBlock}
                onDelete={(block) =>
                  confirmDelete("这一段内容", () =>
                    saveBlocks(
                      replaceBlock(d.blocks || [], string(block.id), null),
                      d.revision,
                    ),
                  )
                }
              />
            ) : (
              <Prose text={d.content} />
            )}
          </View>
          <Actions>
            <ExportFile
              path="/api/documents/export/docx"
              filename={`${d.title}.docx`}
              mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              body={{ title: d.title, content: d.content }}
            />
            <Button
              title={d.blocks?.length ? "修改文章标题" : "编辑文章"}
              onPress={() => setEdit(true)}
            />
            <Button
              title="添加内容块"
              secondary
              onPress={() =>
                editBlock({
                  id: `mobile_${Date.now()}`,
                  type: "paragraph",
                  props: {},
                  content: [],
                  children: [],
                })
              }
            />
            <Button
              title="围绕这篇文章讨论"
              secondary
              onPress={() =>
                api &&
                ask(api, "请和我讨论这篇文章，先给出修改建议。", {
                  note_document_id: id,
                })
              }
            />
          </Actions>
          <Section title="一起改一改" />
          <Chips
            value={mode}
            onChange={setMode}
            items={[
              { value: "rewrite", label: "润色" },
              { value: "shorten", label: "精简" },
              { value: "expand", label: "扩写" },
            ]}
          />
          <Field
            label="修改要求"
            value={instruction}
            onChangeText={setInstruction}
            multiline
            placeholder="保留我的原意，帮我把这一段写得更清楚。"
          />
          <Actions>
            <Button
              title="生成修改建议"
              busy={action.busy}
              disabled={!d.content.trim() || !instruction.trim()}
              onPress={() =>
                void action.run(async () => {
                  if (!api) return;
                  setBaseRevision(d.revision);
                  const result = await api.request<Record<string, unknown>>(
                    "/api/documents/actions/edit",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        text: d.content,
                        instruction,
                        action: mode,
                      }),
                    },
                    true,
                    180000,
                  );
                  const text =
                    result.edited_text ||
                    result.text ||
                    result.content ||
                    result.result;
                  if (typeof text !== "string")
                    throw new Error("修改结果格式尚未识别，原文保持不变。");
                  setCandidate(text);
                })
              }
            />
          </Actions>
          {candidate ? (
            <View style={[s.card, { gap: 12 }]}>
              <Text style={s.h2}>确认修改结果</Text>
              <Prose text={candidate} />
              <Button
                title={d.blocks?.length ? "作为新草稿加入文末" : "采用这份修改"}
                busy={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    if (d.blocks?.length) {
                      const blocks = [
                        ...d.blocks,
                        {
                          id: `mobile_${Date.now()}`,
                          type: "heading",
                          props: { level: 2 },
                          content: [
                            { type: "text", text: "修改草稿", styles: {} },
                          ],
                          children: [],
                        },
                        {
                          id: `mobile_${Date.now()}_body`,
                          type: "paragraph",
                          props: {},
                          content: [
                            { type: "text", text: candidate, styles: {} },
                          ],
                          children: [],
                        },
                      ];
                      await saveBlocks(blocks, baseRevision);
                    } else
                      await api?.json(
                        `/api/documents/${enc(id)}`,
                        { content: candidate, expected_revision: baseRevision },
                        "PUT",
                      );
                    setCandidate("");
                    await r.reload();
                  })
                }
              />
              <Button
                title="保留原文"
                secondary
                onPress={() => setCandidate("")}
              />
            </View>
          ) : null}
          <Section title="待审核建议" />
          <ResourceState resource={suggestions} />
          {suggestions.data?.suggestions
            .filter((x) => !x.status || x.status === "pending")
            .map((x) => (
              <View key={x.id} style={[s.card, { gap: 12 }]}>
                <Text style={s.h2}>{x.title || "修改建议"}</Text>
                <Prose text={x.summary || x.instruction} />
                <Actions>
                  <Button
                    title="接受建议"
                    busy={action.busy}
                    onPress={() =>
                      void action.run(async () => {
                        await api?.json(
                          `/api/documents/${enc(id)}/suggestions/${enc(x.id)}`,
                          { accept: true },
                        );
                        await r.reload();
                        await suggestions.reload();
                      })
                    }
                  />
                  <Button
                    title="不采用"
                    secondary
                    onPress={() =>
                      void action.run(async () => {
                        await api?.json(
                          `/api/documents/${enc(id)}/suggestions/${enc(x.id)}`,
                          { accept: false },
                        );
                        await suggestions.reload();
                      })
                    }
                  />
                </Actions>
              </View>
            ))}
          <SmallAction
            title="删除文章"
            onPress={() =>
              confirmDelete("文章", async () => {
                await api?.request(`/api/documents/${enc(id)}`, {
                  method: "DELETE",
                });
                router.back();
              })
            }
          />
        </>
      ) : null}
      {action.error ? (
        <Text style={{ color: C.danger }}>{action.error}</Text>
      ) : null}
      {blockEdit ? (
        <Editor
          title="编辑内容块"
          fields={[
            ...(blockEdit.type !== "table" &&
            !["learning", "noteColumns", "noteColumn"].includes(
              string(blockEdit.type),
            )
              ? [
                  {
                    key: "type",
                    label: "呈现方式",
                    value: string(blockEdit.type),
                    options: [
                      { value: "paragraph", label: "正文" },
                      { value: "heading", label: "标题" },
                      { value: "bulletListItem", label: "列表" },
                      { value: "checkListItem", label: "待办" },
                      { value: "quote", label: "引用" },
                      { value: "codeBlock", label: "代码" },
                      { value: string(blockEdit.type), label: "保留当前类型" },
                    ].filter(
                      (x, i, a) =>
                        a.findIndex((y) => y.value === x.value) === i,
                    ),
                  },
                  {
                    key: "content",
                    label: "内容",
                    value: inlineText(blockEdit.content),
                    multiline: true,
                  },
                ]
              : []),
            ...(blockEdit.type === "table"
              ? array(object(blockEdit.content).rows).flatMap((row, ri) =>
                  array(object(row).cells).map((cell, ci) => ({
                    key: `cell_${ri}_${ci}`,
                    label: `第 ${ri + 1} 行，第 ${ci + 1} 列`,
                    value: inlineText(
                      Array.isArray(cell) ? cell : object(cell).content,
                    ),
                    multiline: true,
                  })),
                )
              : []),
            ...Object.entries(object(blockEdit.props))
              .filter(
                ([k, v]) =>
                  [
                    "formula",
                    "caption",
                    "title",
                    "url",
                    "name",
                    "quote",
                    "language",
                    "html",
                    "code",
                  ].includes(k) && typeof v === "string",
              )
              .map(([k, v]) => ({
                key: `prop_${k}`,
                label: (
                  {
                    formula: "公式",
                    caption: "说明",
                    title: "标题",
                    url: "资料地址",
                    name: "名称",
                    quote: "摘录",
                    language: "代码语言",
                    html: "互动内容",
                    code: "内容",
                  } as Record<string, string>
                )[k],
                value: string(v),
                multiline: ["quote", "html", "code"].includes(k),
              })),
          ]}
          onClose={() => setBlockEdit(null)}
          onSave={async (values) => {
            if (!d) return;
            let next: Data = {
              ...blockEdit,
              props: { ...object(blockEdit.props) },
            };
            if (values.type) next.type = values.type;
            if (
              values.content !== undefined &&
              values.content !== inlineText(blockEdit.content)
            )
              next.content = [
                { type: "text", text: values.content, styles: {} },
              ];
            for (const [k, v] of Object.entries(values))
              if (k.startsWith("prop_")) (next.props as Data)[k.slice(5)] = v;
            if (blockEdit.type === "table")
              next.content = {
                ...object(blockEdit.content),
                rows: array(object(blockEdit.content).rows).map((row, ri) => ({
                  ...object(row),
                  cells: array(object(row).cells).map((cell, ci) => {
                    const old = Array.isArray(cell)
                      ? cell
                      : object(cell).content;
                    const val = values[`cell_${ri}_${ci}`];
                    if (val === inlineText(old)) return cell;
                    const content = [{ type: "text", text: val, styles: {} }];
                    return Array.isArray(cell)
                      ? content
                      : { ...object(cell), content };
                  }),
                })),
              };
            const old = d.blocks?.length
              ? d.blocks
              : [
                  {
                    id: `original_${Date.now()}`,
                    type: "paragraph",
                    props: {},
                    content: [{ type: "text", text: d.content, styles: {} }],
                    children: [],
                  },
                ];
            const exists = JSON.stringify(old).includes(
              `"id":"${string(blockEdit.id)}"`,
            );
            await saveBlocks(
              exists
                ? replaceBlock(old, string(blockEdit.id), next)
                : [...old, next],
              blockRevision,
            );
          }}
        />
      ) : null}
      {edit ? (
        <Editor
          title={id ? "编辑文章" : "新建文章"}
          fields={[
            { key: "title", label: "标题", value: d?.title, required: true },
            ...(!d?.blocks?.length
              ? [
                  {
                    key: "content",
                    label: "正文",
                    value: d?.content,
                    multiline: true,
                  },
                ]
              : []),
          ]}
          onClose={() => setEdit(false)}
          onSave={async (v) => {
            if (!api) return;
            if (id) {
              await api.json(
                `/api/documents/${enc(id)}`,
                {
                  ...v,
                  expected_revision: d?.revision,
                  parent_id: d?.parent_id,
                  icon: d?.icon || "",
                  cover: d?.cover || "",
                  pinned: d?.pinned || false,
                },
                "PUT",
              );
              await r.reload();
            } else {
              const created = await api.json<Document>("/api/documents", v);
              feature("writing", created.id);
            }
          }}
        />
      ) : null}
    </Page>
  );
}
