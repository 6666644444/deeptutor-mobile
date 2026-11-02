import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../lib/auth";
import { useResource, useJobPolling } from "../lib/resources";
import { uploadBody } from "../lib/upload";
import { ExportFile } from "./export";
import { Button, C, Heading, Page, Row, Section, s } from "../ui";
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
type KB = {
  id: string;
  name: string;
  description?: string;
  read_only?: boolean;
  rag_provider?: string;
};
export function Knowledge({ id = "" }: { id?: string }) {
  const { api } = useAuth();
  const path = `/api/knowledge-bases/${enc(id)}`;
  const list = useResource<KB[]>("/api/knowledge-bases");
  const r = useResource<KB>(id ? path : null);
  const files = useResource<{
    files: { name: string; type: string; size?: number; mime_type?: string }[];
  }>(id ? path + "/files" : null);
  const progress = useResource<{
    status: string;
    message?: string;
    progress?: number;
  }>(id ? path + "/progress" : null);
  const providers = useResource<{
    providers: {
      id: string;
      name: string;
      configured: boolean;
      setup_required?: boolean;
    }[];
  }>("/api/knowledge-bases/rag-providers");

  const [editor, setEditor] = useState("");
  useJobPolling(
    progress.reload,
    !!id &&
      ["queued", "processing", "running", "indexing"].includes(
        progress.data?.status || "",
      ),
  );
  const [preview, setPreview] = useState("");
  const [folder, setFolder] = useState("");
  const [moving, setMoving] = useState("");
  const action = useAction();
  async function upload() {
    if (!api) return;
    const selected = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (selected.canceled) return;
    await action.run(async () => {
      const body = await uploadBody(
        { dest_subdir: folder },
        selected.assets.map((f) => ({
          uri: f.uri,
          name: f.name,
          mime: f.mimeType,
        })),
      );
      await api.request(
        path + "/upload",
        { method: "POST", ...body },
        true,
        120000,
      );
      await files.reload();
      await progress.reload();
    });
  }
  return (
    <Page>
      <Heading
        title={r.data?.name || "知识库"}
        sub="让讲解和出题有教材依据"
        back
        right={
          <Refresh
            onPress={() => {
              void (id ? files.reload() : list.reload());
              if (id) void progress.reload();
            }}
          />
        }
      />
      <ResourceState
        resource={id ? r : list}
        empty={!id && !list.data?.length}
      />
      {!id ? (
        <>
          <Button title="新建知识库" onPress={() => setEditor("create")} />
          {list.data?.map((k) => (
            <Row
              key={k.id || k.name}
              title={k.name}
              detail={k.description || "基于这些资料提问与学习"}
              onPress={() => feature("knowledge", k.id || k.name)}
            />
          ))}
        </>
      ) : (
        <>
          <Actions>
            <Button
              title="基于这个知识库提问"
              onPress={() =>
                api &&
                ask(api, "请根据知识库中的教材引导我学习。", {
                  knowledge_bases: [id],
                })
              }
            />
            {!r.data?.read_only ? (
              <>
                <Button
                  title="上传资料"
                  secondary
                  busy={action.busy}
                  onPress={() => void upload()}
                />
                <SmallAction
                  title="新建文件夹"
                  onPress={() => setEditor("folder")}
                />
              </>
            ) : null}
          </Actions>
          <View style={s.card}>
            <Text style={s.h2}>资料整理状态</Text>
            <Text style={s.text}>
              {(
                {
                  not_started: "尚未建立索引",
                  queued: "等待处理",
                  processing: "正在整理资料",
                  completed: "资料已就绪",
                  ready: "资料已就绪",
                  failed: "处理失败",
                  error: "处理失败",
                } as Record<string, string>
              )[progress.data?.status || ""] || "正在读取"}
            </Text>
            <ResourceState resource={progress} />
            <SmallAction title="刷新进度" onPress={progress.reload} />
            {!r.data?.read_only ? (
              <SmallAction
                title="重试整理"
                onPress={() =>
                  void action.run(async () => {
                    await api?.json(path + "/retry", {});
                    await progress.reload();
                  })
                }
              />
            ) : null}
          </View>
          <Section title="教材文件" />
          {folder ? (
            <SmallAction
              title={`返回上一级 · ${folder}`}
              onPress={() =>
                setFolder(folder.split("/").slice(0, -1).join("/"))
              }
            />
          ) : null}
          <ResourceState resource={files} empty={!files.data?.files.length} />
          {files.data?.files
            .filter((f) => f.name.split("/").slice(0, -1).join("/") === folder)
            .map((f) => (
              <View key={f.name}>
                <Row
                  title={f.name.split("/").pop() || f.name}
                  icon={
                    f.type === "folder"
                      ? "folder-outline"
                      : "document-text-outline"
                  }
                  detail={f.size ? `${Math.ceil(f.size / 1024)} KB` : "文件夹"}
                  onPress={() => {
                    if (f.type === "folder") {
                      setFolder(f.name);
                      return;
                    }
                    void action.run(async () => {
                      if (!api) return;
                      const text = await api.text(
                        path +
                          "/file-preview-text/" +
                          f.name.split("/").map(enc).join("/"),
                        60000,
                      );
                      setPreview(text);
                    });
                  }}
                />
                {f.type !== "folder" ? (
                  <ExportFile
                    path={
                      path + "/files/" + f.name.split("/").map(enc).join("/")
                    }
                    filename={f.name.split("/").pop() || f.name}
                    mime={f.mime_type || "application/octet-stream"}
                    title="保存原文件"
                  />
                ) : null}
                {!r.data?.read_only ? (
                  <SmallAction
                    title="移动到文件夹"
                    onPress={() => setMoving(f.name)}
                  />
                ) : null}
                {!r.data?.read_only && f.type !== "folder" ? (
                  <SmallAction
                    title="删除文件"
                    onPress={() =>
                      confirmDelete("这份文件", async () => {
                        await api?.request(
                          path +
                            "/files/" +
                            f.name.split("/").map(enc).join("/"),
                          { method: "DELETE" },
                        );
                        await files.reload();
                      })
                    }
                  />
                ) : null}
              </View>
            ))}
          {preview ? (
            <View style={s.card}>
              <SmallAction title="收起预览" onPress={() => setPreview("")} />
              <Prose text={preview} />
            </View>
          ) : null}
          {!r.data?.read_only ? (
            <SmallAction
              title="删除知识库"
              onPress={() =>
                confirmDelete("知识库", async () => {
                  await api?.request(path, { method: "DELETE" });
                  router.back();
                })
              }
            />
          ) : null}
        </>
      )}
      {action.error ? (
        <Text style={{ color: C.danger }}>{action.error}</Text>
      ) : null}
      {editor ? (
        <Editor
          title={editor === "create" ? "新建知识库" : "新建文件夹"}
          fields={[
            ...(editor === "create"
              ? [
                  {
                    key: "provider",
                    label: "检索方式",
                    value: "llamaindex",
                    options:
                      providers.data?.providers
                        .filter(
                          (p) =>
                            p.configured &&
                            !p.setup_required &&
                            [
                              "llamaindex",
                              "pageindex-oss",
                              "graphrag",
                              "lightrag",
                            ].includes(p.id),
                        )
                        .map((p) => ({
                          value: p.id,
                          label:
                            p.id === "llamaindex"
                              ? "教材内容检索"
                              : p.id === "pageindex-oss"
                                ? "整篇 PDF 阅读"
                                : p.name,
                        })) || [],
                  },
                ]
              : []),
            {
              key: "name",
              label: editor === "create" ? "知识库名称" : "文件夹名称",
              required: true,
            },
          ]}
          onClose={() => setEditor("")}
          onSave={async (v) => {
            if (!api) return;
            if (editor === "create") {
              const body = await uploadBody({
                name: v.name,
                rag_provider: v.provider,
              });
              const created = await api.request<{
                id?: string;
                name?: string;
                kb_name?: string;
              }>(
                "/api/knowledge-bases",
                { method: "POST", ...body },
                true,
                120000,
              );
              feature(
                "knowledge",
                created.id || created.name || created.kb_name || v.name,
              );
            } else {
              await api.json(path + "/folders", {
                path: [folder, v.name].filter(Boolean).join("/"),
              });
              await files.reload();
            }
          }}
        />
      ) : null}
      {moving ? (
        <Editor
          title="移动资料"
          fields={[
            {
              key: "folder",
              label: "目标文件夹",
              value: folder,
              options: [
                { value: "", label: "知识库根目录" },
                ...(files.data?.files
                  .filter(
                    (f) =>
                      f.type === "folder" &&
                      f.name !== moving &&
                      !f.name.startsWith(moving + "/"),
                  )
                  .map((f) => ({ value: f.name, label: f.name })) || []),
              ],
            },
          ]}
          onClose={() => setMoving("")}
          onSave={async (v) => {
            await api?.json(path + "/files/move", {
              source: moving,
              dest_folder: v.folder,
            });
            await files.reload();
          }}
        />
      ) : null}
    </Page>
  );
}
