import { useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { useResource, useJobPolling } from "../lib/resources";
import { Button, C, Heading, Page, Row, Section, s } from "../ui";
import {
  Actions,
  Editor,
  Prose,
  Refresh,
  ResourceState,
  SmallAction,
  enc,
  feature,
  useAction,
} from "./common";
const labels: Record<string, string> = {
  chat: "对话回顾",
  notebook: "笔记回顾",
  quiz: "练习与错题",
  kb: "教材与知识",
  book: "学习书籍",
  partner: "学习伙伴",
  cowriter: "写作回顾",
  recent: "近期学习",
  profile: "我的学习情况",
  scope: "学习范围",
  preferences: "学习偏好",
};
type Doc = { layer: string; key: string; exists: boolean; entry_count: number };
type Run = {
  run_id: string;
  status: string;
  result?: { summary?: string };
  error?: string;
};
export function Memory({
  id = "",
  layer = "L3",
}: {
  id?: string;
  layer?: string;
}) {
  const { api } = useAuth();
  const overview = useResource<{ docs: Doc[] }>("/api/memory/overview");
  const path = `/api/memory/doc/${enc(layer)}/${enc(id)}`;
  const doc = useResource<{ content: string }>(id ? path : null);
  const [edit, setEdit] = useState(false);
  const [runId, setRunId] = useState("");
  const runs = useResource<{ runs: Run[] }>(
    id ? `/api/memory/runs?layer=${enc(layer)}&key=${enc(id)}` : null,
  );
  const run = useResource<Run>(runId ? `/api/memory/runs/${enc(runId)}` : null);
  const action = useAction();
  useJobPolling(
    run.reload,
    !!runId && ["queued", "running"].includes(run.data?.status || ""),
  );
  return (
    <Page>
      <Heading
        title={id ? labels[id] || "学习记忆" : "学习记忆"}
        sub="查看、修正学习记录，帮助后续讲解更适合我"
        back
        right={<Refresh onPress={id ? doc.reload : overview.reload} />}
      />
      <ResourceState resource={id ? doc : overview} />
      {!id ? (
        overview.data?.docs.map((d) => (
          <Row
            key={d.layer + d.key}
            title={labels[d.key] || d.key}
            detail={d.exists ? `${d.entry_count || 0} 条记录` : "还没有记录"}
            onPress={() => feature("memory", d.key, { layer: d.layer })}
          />
        ))
      ) : (
        <>
          <View style={s.card}>
            <Prose text={doc.data?.content || "这里还没有学习记录。"} />
          </View>
          <Actions>
            <Button title="编辑这份记忆" onPress={() => setEdit(true)} />
            {[
              { id: "update", title: "整理最新学习记录" },
              { id: "audit", title: "检查记忆内容" },
              { id: "dedup", title: "整理重复记录" },
            ]
              .filter(
                (x) =>
                  !(layer === "L3" && id === "preferences") || x.id === "dedup",
              )
              .map((x) => (
                <Button
                  key={x.id}
                  title={x.title}
                  secondary
                  busy={action.busy}
                  onPress={() =>
                    void action.run(async () => {
                      const r = await api?.json<{ run_id: string }>(
                        "/api/memory/runs/start",
                        { layer, key: id, mode: x.id, language: "zh" },
                      );
                      if (r?.run_id) {
                        setRunId(r.run_id);
                        await runs.reload();
                      }
                    })
                  }
                />
              ))}
          </Actions>
        </>
      )}
      {id && runs.data?.runs.length ? (
        <>
          <Section title="最近整理任务" action="刷新" onPress={runs.reload} />
          {runs.data.runs.map((r) => (
            <Row
              key={r.run_id}
              title="查看整理进度"
              detail={
                {
                  queued: "排队中",
                  running: "进行中",
                  completed: "已完成",
                  failed: "未完成",
                  cancelled: "已停止",
                }[r.status] || "查看记录"
              }
              onPress={() => setRunId(r.run_id)}
            />
          ))}
        </>
      ) : null}
      {runId ? (
        <View style={s.card}>
          <Section title="整理进度" action="刷新" onPress={run.reload} />
          <ResourceState resource={run} />
          <Text style={s.text}>
            {(
              {
                queued: "排队中",
                running: "正在整理",
                completed: "整理完成",
                failed: "整理失败",
                cancelled: "已停止",
              } as Record<string, string>
            )[run.data?.status || ""] || "正在读取进度"}
          </Text>
          <Prose text={run.data?.result?.summary} />
          {run.data?.error ? (
            <Text style={{ color: C.danger }}>{run.data.error}</Text>
          ) : null}
          <SmallAction
            title="停止整理"
            onPress={() =>
              void action.run(async () => {
                await api?.json(`/api/memory/runs/${enc(runId)}/cancel`, {});
                await run.reload();
              })
            }
          />
          <SmallAction
            title="撤销本次修改"
            onPress={() =>
              void action.run(async () => {
                await api?.json(`/api/memory/runs/${enc(runId)}/undo`, {});
                await doc.reload();
              })
            }
          />
        </View>
      ) : null}
      {action.error ? (
        <Text style={{ color: C.danger }}>{action.error}</Text>
      ) : null}
      {edit ? (
        <Editor
          title="编辑学习记忆"
          fields={[
            {
              key: "content",
              label: "内容",
              value: doc.data?.content,
              multiline: true,
            },
          ]}
          onClose={() => setEdit(false)}
          onSave={async (v) => {
            await api?.json(path, v, "PUT");
            await doc.reload();
          }}
        />
      ) : null}
    </Page>
  );
}
