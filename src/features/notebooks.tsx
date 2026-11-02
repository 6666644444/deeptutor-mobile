import { ExportFile } from "./export";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../lib/auth";
import { useResource } from "../lib/resources";
import { favoriteMetadata } from "../lib/learning-records";
import { Button, Heading, Page, Row, Section, s } from "../ui";
import {
  Actions,
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
type RecordItem = {
  id: string;
  title: string;
  summary: string;
  user_query: string;
  output: string;
  type: string;
  metadata: Record<string, unknown>;
};
type Notebook = {
  id: string;
  name: string;
  description: string;
  record_count: number;
  records: RecordItem[];
};
export function Notebooks({ id = "" }: { id?: string }) {
  const { api } = useAuth();
  const list = useResource<{ notebooks: Notebook[] }>("/api/notebooks");
  const detail = useResource<Notebook>(id ? `/api/notebooks/${enc(id)}` : null);
  const [editor, setEditor] = useState<
    "create" | "edit" | "record" | RecordItem | null
  >(null);
  const [transfer, setTransfer] = useState<{
    record: RecordItem;
    move: boolean;
  } | null>(null);
  const n = detail.data;
  const copyAction = useAction();
  return (
    <Page>
      <Heading
        title={n?.name || "笔记与收藏"}
        back
        right={<Refresh onPress={id ? detail.reload : list.reload} />}
      />
      <Button
        title={id ? "添加笔记" : "新建笔记本"}
        onPress={() => setEditor(id ? "record" : "create")}
      />
      <ResourceState
        resource={id ? detail : list}
        empty={!id && !list.data?.notebooks.length}
      />
      {!id ? (
        list.data?.notebooks.map((n) => (
          <Row
            key={n.id}
            title={n.name}
            detail={`${n.record_count || 0} 条记录 · ${n.description || "我的学习收藏"}`}
            onPress={() => feature("notebooks", n.id)}
          />
        ))
      ) : n ? (
        <>
          <Text style={s.muted}>{n.description}</Text>
          <Actions>
            <Button
              title="基于这个笔记本提问"
              secondary
              onPress={() =>
                api &&
                ask(api, "请根据我的笔记帮我回顾重点。", {
                  notebook_references: [{ notebook_id: id, record_ids: [] }],
                })
              }
            />
            <ExportFile
              path={`/api/notebooks/${enc(id)}/export`}
              filename={`${n.name}.md`}
              mime="text/markdown"
            />
            <SmallAction title="修改笔记本" onPress={() => setEditor("edit")} />
          </Actions>
          <Section title="已保存的内容" />
          {n.records?.map((record) => (
            <View
              key={record.id}
              style={[s.card, { gap: 10, marginBottom: 14 }]}
            >
              <Text style={s.h2}>{record.title}</Text>
              <Prose text={record.summary} />
              <Prose text={record.user_query} />
              <Prose text={record.output} />
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                <SmallAction
                  title="修改标题与摘要"
                  onPress={() => setEditor(record)}
                />
                <SmallAction
                  title="另存为可编辑笔记"
                  onPress={() => {
                    if (!api) return;
                    void copyAction.run(async () => {
                      const document = await api.json<{ id: string }>(
                        "/api/documents",
                        {
                          title: record.title || "收藏笔记",
                          content: [record.user_query, record.output]
                            .filter(Boolean)
                            .join("\n\n"),
                        },
                      );
                      feature("writing", document.id);
                    });
                  }}
                />
                <SmallAction
                  title="复制到…"
                  onPress={() => setTransfer({ record, move: false })}
                />
                <SmallAction
                  title="移动到…"
                  onPress={() => setTransfer({ record, move: true })}
                />
                <SmallAction
                  title="删除"
                  onPress={() =>
                    confirmDelete("这条笔记", async () => {
                      await api?.request(
                        `/api/notebooks/${enc(id)}/records/${enc(record.id)}`,
                        { method: "DELETE" },
                      );
                      await detail.reload();
                    })
                  }
                />
              </View>
            </View>
          ))}
          <SmallAction
            title="删除笔记本"
            onPress={() =>
              confirmDelete("笔记本及其中的记录", async () => {
                await api?.request(`/api/notebooks/${enc(id)}`, {
                  method: "DELETE",
                });
                router.back();
              })
            }
          />
        </>
      ) : null}
      {transfer ? (
        <View style={s.card}>
          <Text style={s.h2}>选择目标笔记本</Text>
          {list.data?.notebooks
            .filter((v) => v.id !== id)
            .map((v) => (
              <Row
                key={v.id}
                title={v.name}
                onPress={() =>
                  void (async () => {
                    try {
                      await api?.json(
                        `/api/notebooks/${enc(id)}/records/${enc(transfer.record.id)}/actions/${transfer.move ? "move" : "copy"}`,
                        { target_notebook_id: v.id },
                      );
                      setTransfer(null);
                      await detail.reload();
                    } catch (e) {
                      /* surfaced by the editor below */ setTransfer(null);
                      Alert.alert("未能移动笔记", (e as Error).message);
                    }
                  })()
                }
              />
            ))}
          <SmallAction title="取消" onPress={() => setTransfer(null)} />
        </View>
      ) : null}
      {copyAction.busy ? (
        <Text style={s.muted}>正在创建可编辑笔记…</Text>
      ) : null}
      {copyAction.error ? (
        <Text style={s.muted}>{copyAction.error}</Text>
      ) : null}
      {editor ? (
        <Editor
          title={
            typeof editor === "object"
              ? "修改标题与摘要"
              : editor === "record"
                ? "添加笔记"
                : editor === "edit"
                  ? "修改笔记本"
                  : "新建笔记本"
          }
          fields={
            editor === "create" || editor === "edit"
              ? [
                  {
                    key: "name",
                    label: "名称",
                    value: editor === "edit" ? n?.name : "",
                    required: true,
                  },
                  {
                    key: "description",
                    label: "说明",
                    value: editor === "edit" ? n?.description : "",
                    multiline: true,
                  },
                ]
              : [
                  {
                    key: "title",
                    label: "标题",
                    value: typeof editor === "object" ? editor.title : "",
                    required: true,
                  },
                  ...(typeof editor === "object"
                    ? []
                    : [
                        {
                          key: "output",
                          label: "笔记内容",
                          value: "",
                          multiline: true,
                          required: true,
                        },
                      ]),
                  {
                    key: "summary",
                    label: "摘要",
                    value: typeof editor === "object" ? editor.summary : "",
                    multiline: true,
                  },
                ]
          }
          onClose={() => setEditor(null)}
          onSave={async (values) => {
            if (!api) return;
            if (editor === "create") {
              const r = await api.json<{ notebook: Notebook }>(
                "/api/notebooks",
                values,
              );
              feature("notebooks", r.notebook.id);
            } else if (editor === "edit") {
              await api.json(`/api/notebooks/${enc(id)}`, values, "PUT");
              await detail.reload();
            } else if (editor === "record") {
              await api.json("/api/notebooks/actions/add-record", {
                ...values,
                summary: values.summary || values.output.slice(0, 180),
                notebook_ids: [id],
                record_type: "chat",
                user_query: values.title,
                metadata: { source: "mobile" },
              });
              await detail.reload();
            } else {
              await api.json(
                `/api/notebooks/${enc(id)}/records/${enc(editor.id)}`,
                favoriteMetadata(values),
                "PUT",
              );
              await detail.reload();
            }
          }}
        />
      ) : null}
    </Page>
  );
}
