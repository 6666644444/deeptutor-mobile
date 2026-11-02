import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../lib/auth";
import { useResource } from "../lib/resources";
import { Button, C, Field, Heading, Page, Row, s } from "../ui";
import {
  Actions,
  Editor,
  Prose,
  Refresh,
  ResourceState,
  SmallAction,
  confirmDelete,
  enc,
  feature,
  useAction,
} from "./common";
type Partner = {
  partner_id: string;
  name: string;
  description: string;
  running: boolean;
  can_manage?: boolean;
  emoji?: string;
};
type History = { role: string; content: string };
export function Partners({ id = "" }: { id?: string }) {
  const { api } = useAuth();
  const list = useResource<Partner[]>("/api/partners");
  const detail = useResource<Partner>(id ? `/api/partners/${enc(id)}` : null);
  const [session, setSession] = useState("");
  const history = useResource<History[] | { messages: History[] }>(
    id
      ? `/api/partners/${enc(id)}/history?limit=100${session ? `&session_key=${enc(session)}` : ""}`
      : null,
  );
  const sessions = useResource<
    { key?: string; session_key?: string; title?: string }[]
  >(id ? `/api/partners/${enc(id)}/sessions` : null);
  const [editor, setEditor] = useState(false);
  const [text, setText] = useState("");
  const [choose, setChoose] = useState(false);
  const action = useAction();
  const p = detail.data;
  const rows = Array.isArray(history.data)
    ? history.data
    : history.data?.messages || [];
  return (
    <Page>
      <Heading
        title={p?.name || "学习伙伴"}
        back
        right={
          <Refresh
            onPress={() => {
              void (id ? history.reload() : list.reload());
            }}
          />
        }
      />
      {!id ? (
        <>
          <Button title="创建学习伙伴" onPress={() => setEditor(true)} />
          <ResourceState resource={list} empty={!list.data?.length} />
          {list.data?.map((p) => (
            <Row
              key={p.partner_id}
              title={`${p.emoji || ""} ${p.name}`}
              detail={p.description}
              onPress={() => feature("partners", p.partner_id)}
            />
          ))}
        </>
      ) : (
        <>
          <ResourceState resource={detail} />
          <Text style={s.muted}>{p?.description}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <SmallAction
              title="历史会话"
              onPress={() => setChoose((v) => !v)}
            />
            {p?.can_manage ? (
              <SmallAction title="编辑伙伴" onPress={() => setEditor(true)} />
            ) : null}
          </View>
          {choose ? (
            <View style={s.card}>
              <ResourceState resource={sessions} />
              {sessions.data?.map((x, i) => (
                <Row
                  key={x.session_key || x.key || i}
                  title={x.title || `会话 ${i + 1}`}
                  onPress={() => {
                    setSession(x.session_key || x.key || "");
                    setChoose(false);
                  }}
                />
              ))}
            </View>
          ) : null}
          <ResourceState resource={history} />
          {rows.map((m, i) => (
            <View
              key={i}
              style={[
                s.card,
                {
                  backgroundColor: m.role === "user" ? C.pale : C.white,
                  marginVertical: 6,
                },
              ]}
            >
              <Text style={s.muted}>{m.role === "user" ? "我" : p?.name}</Text>
              <Prose text={m.content} />
            </View>
          ))}
          <Field
            label="和学习伙伴说"
            value={text}
            onChangeText={setText}
            multiline
          />
          <Actions>
            <Button
              title="发送"
              busy={action.busy}
              disabled={!text.trim()}
              onPress={() =>
                void action.run(async () => {
                  if (!api) return;
                  await api.request(
                    `/api/partners/${enc(id)}/chat`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        content: text,
                        ...(session ? { session_key: session } : {}),
                      }),
                    },
                    true,
                    180000,
                  );
                  setText("");
                  await history.reload();
                  await sessions.reload();
                })
              }
            />
            {p?.can_manage ? (
              <>
                <Button
                  title={p.running ? "暂停伙伴" : "启动伙伴"}
                  secondary
                  onPress={() =>
                    void action.run(async () => {
                      await api?.json(
                        `/api/partners/${enc(id)}/${p.running ? "stop" : "start"}`,
                        {},
                      );
                      await detail.reload();
                    })
                  }
                />
                <SmallAction
                  title="删除伙伴"
                  onPress={() =>
                    confirmDelete("学习伙伴", async () => {
                      await api?.request(`/api/partners/${enc(id)}`, {
                        method: "DELETE",
                      });
                      router.back();
                    })
                  }
                />
              </>
            ) : null}
          </Actions>
        </>
      )}
      {action.error ? (
        <Text style={{ color: C.danger }}>{action.error}</Text>
      ) : null}
      {editor ? (
        <Editor
          title={id ? "编辑学习伙伴" : "创建学习伙伴"}
          fields={[
            { key: "name", label: "名字", value: p?.name, required: true },
            {
              key: "description",
              label: "擅长什么",
              value: p?.description,
              multiline: true,
            },
            {
              key: "soul",
              label: id
                ? "新的相处方式（留空保留原设置）"
                : "相处方式与教学要求",
              multiline: true,
            },
          ]}
          onClose={() => setEditor(false)}
          onSave={async (v) => {
            if (!api) return;
            const body = {
              name: v.name,
              description: v.description,
              ...(v.soul.trim()
                ? { soul: { source: "custom", content: v.soul } }
                : {}),
            };
            if (id) {
              await api.json(`/api/partners/${enc(id)}`, body, "PATCH");
              await detail.reload();
            } else {
              await api.json("/api/partners", {
                ...body,
                language: "zh",
                start: true,
              });
              await list.reload();
            }
          }}
        />
      ) : null}
    </Page>
  );
}
