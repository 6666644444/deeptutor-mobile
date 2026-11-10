import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../lib/auth";
import { useResource } from "../lib/resources";
import { Button, C, Heading, Page, Row, Section } from "../ui";
import { explanationPresets } from "../lib/study-presets";
import {
  Editor,
  Refresh,
  ResourceState,
  SmallAction,
  enc,
  useAction,
} from "./common";
type Workspace = {
  workspace_id: string;
  display_name: string;
  kind: string;
  archived: boolean;
  instructions: string;
};
export function Workspaces() {
  const { api, setWorkspace } = useAuth();
  const r = useResource<{ workspaces: Workspace[] }>(
    "/api/settings/workspace/registrations",
  );
  const current = useResource<{ workspace_id: string; display_name: string }>(
    "/api/settings/workspace",
  );
  const [edit, setEdit] = useState<Workspace | "new" | null>(null);
  const action = useAction();
  function name(w: Workspace) {
    return w.display_name === "System workspace"
      ? "系统空间"
      : w.display_name === "General workspace"
        ? "通用学习空间"
        : w.display_name;
  }
  return (
    <Page>
      <Heading
        title="学习工作区"
        sub="可以按学科或学习目标整理；内容仍归当前账号所有"
        back
        right={<Refresh onPress={r.reload} />}
      />
      <Button title="新建学习工作区" onPress={() => setEdit("new")} />
      <ResourceState resource={r} />
      <Section title="我的工作区" />
      <Row
        title="默认学习空间"
        suffix={!api?.workspaceId ? "当前" : ""}
        onPress={() =>
          void action.run(async () => {
            await setWorkspace("");
            router.replace("/(tabs)");
          })
        }
      />
      {r.data?.workspaces
        .filter((w) => w.kind !== "system")
        .map((w) => (
          <View key={w.workspace_id}>
            <Row
              title={name(w)}
              detail={
                w.archived
                  ? "已归档"
                  : w.instructions || "独立整理这个主题的学习内容"
              }
              suffix={
                current.data?.workspace_id === w.workspace_id ? "当前" : ""
              }
              onPress={() =>
                void action.run(async () => {
                  if (w.archived) throw new Error("请先恢复这个工作区。");
                  await setWorkspace(w.workspace_id);
                  router.replace("/(tabs)");
                })
              }
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <SmallAction title="编辑" onPress={() => setEdit(w)} />
              <SmallAction
                title={w.archived ? "恢复" : "归档"}
                onPress={() =>
                  void action.run(async () => {
                    if (w.workspace_id === api?.workspaceId)
                      throw new Error("请先切换到其他工作区。");
                    await api?.json(
                      `/api/settings/workspace/registrations/${enc(w.workspace_id)}`,
                      { archived: !w.archived },
                      "PATCH",
                    );
                    await r.reload();
                  })
                }
              />
            </View>
          </View>
        ))}
      {action.error ? (
        <Text style={{ color: C.danger }}>{action.error}</Text>
      ) : null}
      {edit ? (
        <Editor
          title={edit === "new" ? "新建学习工作区" : "编辑工作区"}
          fields={[
            {
              key: "name",
              label: "名称",
              value: edit === "new" ? "" : name(edit),
              required: true,
            },
            {
              key: "instructions",
              label: "学习要求与偏好",
              presets: explanationPresets,
              value: edit === "new" ? "" : edit.instructions,
              multiline: true,
            },
          ]}
          onClose={() => setEdit(null)}
          onSave={async (v) => {
            await api?.json(
              `/api/settings/workspace/registrations${edit === "new" ? "" : "/" + enc(edit.workspace_id)}`,
              v,
              edit === "new" ? "POST" : "PATCH",
            );
            await r.reload();
          }}
        />
      ) : null}
    </Page>
  );
}
