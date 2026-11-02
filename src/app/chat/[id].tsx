import { ownTemporaryFile } from "../../lib/temporary-files";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useAuth } from "../../lib/auth";
import { Session, TurnEvent, streamText } from "../../lib/client";
import { Photo, photoDraft, questionDraft, chatDraft } from "../../lib/drafts";
import { Button, C, Empty, Field, Heading, Icon, Page, s } from "../../ui";

import {
  CapabilityOptions,
  ChatOptions,
  defaultOptions,
  capabilityLabels,
  personaLabels,
} from "../../features/capabilities";
import { Content, Data, object, array, string } from "../../features/content";
import { dialogueParts, conversationTitle } from "../../lib/conversation";
import { Chips, Prose, SmallAction } from "../../features/common";
type Message = {
  id: string;
  role: string;
  content: string;
  events?: TurnEvent[];
};

function displayBody(message: Message) {
  const result = [...(message.events || [])]
    .reverse()
    .find((e) => e.type === "result");
  const meta = object(result?.metadata);
  const code = string(object(meta.code).content);
  // A visualization result streams its source as a code fence. Its artifact
  // below is the actual result; avoid displaying that source a second time.
  return code &&
    message.content.trim().startsWith("```") &&
    message.content.includes(code)
    ? ""
    : message.content;
}

const NativeSocket = WebSocket as unknown as {
  new (
    url: string,
    protocols: null,
    options: { headers: Record<string, string> },
  ): WebSocket;
};
export default function Chat() {
  const { id, questionId } = useLocalSearchParams<{
    id: string;
    questionId?: string;
  }>();
  const { api } = useAuth();
  const [initialDraft] = useState(() =>
    api ? chatDraft.take(api) : undefined,
  );
  const [context, setContext] = useState<Record<string, unknown>>(
    initialDraft?.context || {},
  );
  const [options, setOptions] = useState<ChatOptions>(
    () =>
      ({
        ...defaultOptions(String(initialDraft?.context.capability || "chat")),
        ...initialDraft?.context,
      }) as ChatOptions,
  );
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const replyPending = useRef(false);
  const [waitingCard, setWaitingCard] = useState<Data | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [traceOpen, setTraceOpen] = useState(false);
  const [sessionId, setSessionId] = useState(id === "new" ? "" : id);
  const sid = useRef(id === "new" ? "" : id);
  const [rawTitle, setTitle] = useState("问一问 DeepTutor");
  const title = conversationTitle(rawTitle);
  const [rename, setRename] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [initialPhoto] = useState(() =>
    api ? photoDraft.peek(api) : undefined,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState(
    initialPhoto
      ? "请先识别图片里的题目和作答，列出不确定的地方，等我校对后再讲解。"
      : initialDraft?.content
        ? initialDraft.content
        : questionId
          ? "请引导我重新理解这道错题。先让我想一想，不要直接给出答案。"
          : "",
  );
  const [photo, setPhoto] = useState<Photo | undefined>(initialPhoto);
  const [document, setDocument] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const socket = useRef<WebSocket | null>(null);
  const turn = useRef("");
  const sending = useRef(false);
  const waitingRef = useRef(false);
  const alive = useRef(true);
  const scroll = useRef<ScrollView>(null);
  async function saveTitle() {
    if (!api || !sid.current || !renameText.trim()) return;
    try {
      await api.json(
        `/api/sessions/${encodeURIComponent(sid.current)}`,
        { title: renameText.trim() },
        "PATCH",
      );
      setTitle(renameText.trim());
      setRename(false);
    } catch (e) {
      Alert.alert("未能改名", (e as Error).message);
    }
  }
  async function chooseDocument() {
    if (picking || sending.current) return;
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "text/plain",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if ((file.size || new File(file.uri).size) > 10 * 1024 * 1024)
        throw new Error(
          "对话附件不能超过 10 MB，较大的教材请在资料页分章节添加。",
        );
      if (!/\.(pdf|docx|txt)$/i.test(file.name))
        throw new Error("请选择 PDF、DOCX 或 TXT 文件。");
      if (!api) return;
      file.uri = await ownTemporaryFile(api, file.uri, file.name);
      setDocument(file);
    } catch (e) {
      Alert.alert("未能添加附件", (e as Error).message);
    } finally {
      setPicking(false);
    }
  }
  async function send(override?: string, extra: Data = {}, resumeId = "") {
    if (!api) return;
    if (waitingRef.current && !resumeId) {
      if (replyPending.current) return;
      if (socket.current?.readyState !== WebSocket.OPEN) {
        setError("连接已断开，请点恢复进度后继续作答。");
        return;
      }
      const content = override || text.trim();
      const entries = Object.entries(answers)
        .filter(([, v]) => v.trim())
        .map(([questionId, text]) => ({ questionId, text }));
      if (!content && !entries.length) return;
      replyPending.current = true;
      setReplyBusy(true);
      socket.current.send(
        JSON.stringify({
          protocol_version: "2.0",
          type: "submit_user_reply",
          turn_id: turn.current,
          command_id: `reply_${Date.now()}`,
          ...(content ? { text: content } : {}),
          ...(entries.length ? { answers: entries } : {}),
        }),
      );
      setStatus("正在提交回答…");
      return;
    }
    if (sending.current || (!resumeId && !(override || text).trim())) return;
    sending.current = true;
    setBusy(true);
    setError("");
    setStatus("正在连接…");
    const prompt = (override || text).trim();
    const image = resumeId ? undefined : photo;
    const attached = resumeId ? null : document;
    const submission = `mobile_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const reply = submission + "_reply";
    try {
      // Validate/renew before opening WS; failed connections never silently re-submit a turn.
      await api.ensureSession();
      const filePayload = attached
        ? {
            type: attached.name.toLowerCase().endsWith(".pdf") ? "pdf" : "file",
            filename: attached.name,
            mime_type: attached.mimeType || "application/octet-stream",
            base64: await new File(attached.uri).base64(),
          }
        : undefined;
      if (!alive.current) return;
      socket.current?.close();
      api.assertOpen();
      const transport = api.socketOptions();
      const ws = new NativeSocket(transport.url, null, { headers: transport.headers });
      api.onClose(() => ws.close());
      socket.current = ws;
      let terminal = false;
      let opened = false;
      let response = "";
      let lastSeq = 0;
      let eventTrace: TurnEvent[] = [];
      const finish = (msg = "") => {
        if (socket.current !== ws || !alive.current) return;
        terminal = true;
        replyPending.current = false;
        setReplyBusy(false);
        sending.current = false;
        setBusy(false);
        setStatus("");
        if (msg) setError(msg);
      };
      const timeout = setTimeout(() => {
        if (!opened) {
          finish("连接超时，内容尚未提交，可以重试。");
          ws.close();
        }
      }, 20000);
      ws.onopen = () => {
        clearTimeout(timeout);
        if (!alive.current || socket.current !== ws) {
          ws.close();
          return;
        }
        opened = true;
        if (resumeId) {
          turn.current = resumeId;
          setStatus("正在恢复进度…");
          ws.send(
            JSON.stringify({
              type: "subscribe_turn",
              protocol_version: "2.0",
              turn_id: resumeId,
              after_seq: 0,
            }),
          );
          setMessages((v) => [
            ...v,
            { id: reply, role: "assistant", content: "" },
          ]);
          return;
        }
        setText("");
        setPhoto(undefined);
        setDocument(null);
        setStatus("DeepTutor 正在思考…");
        setMessages((v) => [
          ...v,
          {
            id: submission,
            role: "user",
            content:
              prompt +
              (image ? "\n[已附题目照片]" : "") +
              (attached ? `\n[附件：${attached.name}]` : ""),
          },
          { id: reply, role: "assistant", content: "" },
        ]);
        ws.send(
          JSON.stringify({
            protocol_version: "2.0",
            type: "start_turn",
            content: prompt,
            ...context,
            ...options,
            ...extra,
            ...(api.workspaceId ? { workspace_id: api.workspaceId } : {}),
            client_submission_id: submission,
            ...(sid.current ? { session_id: sid.current } : {}),
            reply_language_override: "zh",
            question_notebook_references: questionId
              ? [Number(questionId)]
              : [],
            attachments: [
              ...(image
                ? [
                    {
                      type: "image",
                      base64: image.base64,
                      filename: image.filename,
                      mime_type: "image/jpeg",
                    },
                  ]
                : []),
              ...(filePayload ? [filePayload] : []),
            ],
          }),
        );
      };
      ws.onmessage = (ev) => {
        if (!alive.current || socket.current !== ws) return;
        let event: TurnEvent;
        try {
          event = JSON.parse(String(ev.data));
        } catch {
          finish("服务返回了无法识别的内容，请恢复进度后重试。");
          return;
        }
        if (event.type === "command_ack") {
          replyPending.current = false;
          setReplyBusy(false);
          const ack = event as TurnEvent & {
            accepted: boolean;
            command_type: string;
            message?: string;
          };
          if (!ack.accepted) {
            setError(ack.message || "这次操作未被接受，请刷新进度。");
            return;
          }
          if (ack.command_type === "submit_user_reply") {
            waitingRef.current = false;
            setWaiting(false);
            setWaitingCard(null);
            setAnswers({});
            setText("");
            setStatus("正在继续讲解…");
          }
          return;
        }
        if (event.type === "protocol_error") {
          finish(
            string((event as unknown as Data).message) ||
              "请求未被服务接受，请检查学习设置。",
          );
          ws.close();
          return;
        }
        if (event.seq && event.seq <= lastSeq) return;
        if (event.seq) lastSeq = event.seq;
        if (event.session_id) {
          sid.current = event.session_id;
          setSessionId(event.session_id);
        }
        if (event.turn_id) turn.current = event.turn_id;
        if (!["content", "thinking"].includes(event.type)) {
          eventTrace = [...eventTrace, event];
          setMessages((v) =>
            v.map((m) => (m.id === reply ? { ...m, events: eventTrace } : m)),
          );
        }
        const meta = object(event.metadata);
        const tool = object(meta.tool_metadata);
        const asked = object(tool.ask_user || meta.ask_user);
        if (Object.keys(asked).length && asked.kind !== "mastery_question") {
          setWaitingCard(asked);
          setWaiting(true);
          waitingRef.current = true;
          setStatus("等你回答后继续");
        }
        if (meta.ask_user_resolved) {
          setWaitingCard(null);
          setWaiting(false);
          waitingRef.current = false;
        }

        if (
          event.type === "session_meta" &&
          typeof event.metadata?.title === "string"
        )
          setTitle(event.metadata.title);
        if (event.type === "content" || event.type === "result") {
          response = streamText(event, response);
          setStatus("正在讲解…");
          setMessages((v) =>
            v.map((m) => (m.id === reply ? { ...m, content: response } : m)),
          );
        }
        if (event.type === "tool_call") setStatus("正在查找资料和整理思路…");
        if (event.type === "wait_for_input") {
          setWaiting(true);
          waitingRef.current = true;
          setStatus("等你回答后继续");
          if (event.content)
            setWaitingCard((v) => v || { question: event.content });
        }
        if (event.type === "error")
          finish(event.content || "这次讲解未完成，请查看学习进度后重试。");
        if (event.type === "done") {
          finish();
          setWaiting(false);
          waitingRef.current = false;
          setWaitingCard(null);
          ws.close();
          if (sid.current)
            void api
              .request<Session>(
                `/api/sessions/${encodeURIComponent(sid.current)}`,
              )
              .then((r) => {
                if (alive.current) {
                  setMessages(r.messages || []);
                  setTitle(r.title || title);
                }
              })
              .catch(() => {});
        }
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        if (terminal || api.isClosed) return;
        finish(
          opened
            ? "连接中断，请恢复进度确认已保存的结果，避免重复提交。"
            : "连接未建立，内容尚未提交，请重试。",
        );
      };
      ws.onclose = () => {
        clearTimeout(timeout);
        if (!terminal) finish("连接已断开，请恢复进度查看已保存的结果。");
      };
    } catch (e) {
      if (alive.current) {
        setError((e as Error).message);
        sending.current = false;
        setBusy(false);
        setStatus("");
      }
    }
  }
  useEffect(() => {
    alive.current = true;
    if (api) photoDraft.take(api);
    if (api && id !== "new")
      void api
        .request<Session>(`/api/sessions/${encodeURIComponent(id)}`)
        .then((r) => {
          if (alive.current) {
            setMessages(r.messages || []);
            setTitle(r.title || "学习对话");
            const prefs = r.preferences || {};
            setOptions((o) => ({
              ...o,
              ...(typeof prefs.capability === "string"
                ? { capability: prefs.capability }
                : {}),
              ...(typeof prefs.persona === "string"
                ? { persona: prefs.persona }
                : {}),
              ...(prefs.config ? { config: object(prefs.config) } : {}),
              ...(Array.isArray(prefs.knowledge_bases)
                ? { knowledge_bases: prefs.knowledge_bases as string[] }
                : {}),
            }));
            const allowed = [
              "reading_material_id",
              "reading_material_revision",
              "reading_workspace_id",
              "reading_viewport",
              "workspace_mode",
              "mastery_path_id",
              "mastery_session_mode",
              "note_document_id",
              "knowledge_bases",
              "book_references",
              "notebook_references",
            ];
            setContext(
              Object.fromEntries(
                allowed
                  .filter((k) => prefs[k] !== undefined)
                  .map((k) => [k, prefs[k]]),
              ),
            );
            if (
              r.active_turn &&
              ["queued", "running", "waiting_input", "recovering"].includes(
                r.active_turn.status,
              )
            ) {
              void send(undefined, {}, r.active_turn.id);
            }
          }
        })
        .catch((e) => {
          if (alive.current) setError(e.message);
        });
    return () => {
      alive.current = false;
      socket.current?.close();
      socket.current = null;
    };
    // The transport is initialized once per authenticated client and route. Its
    // mutable socket/turn refs own recovery; composer edits must not reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, id]);
  async function restoreProgress() {
    if (!api || !sid.current) return;
    try {
      const r = await api.request<Session>(
        `/api/sessions/${encodeURIComponent(sid.current)}`,
      );
      setMessages(r.messages || []);
      setError("");
      setTitle(r.title || "学习对话");
      sending.current = false;
      setBusy(false);
      socket.current?.close();
      if (
        r.active_turn &&
        ["queued", "running", "waiting_input", "recovering"].includes(
          r.active_turn.status,
        )
      )
        await send(undefined, {}, r.active_turn.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function saveQuestion() {
    const lastUser = [...messages].reverse().find((v) => v.role === "user");
    const lastReply = [...messages]
      .reverse()
      .find((v) => v.role === "assistant");
    if (api) {
      questionDraft.set(api, {
        question: lastUser?.content || "",
        explanation: lastReply?.content || "",
        session_id: sid.current || undefined,
      });
      router.push("/question/new");
    }
  }
  return (
    <Page scroll={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        automaticOffset
        enabled={!rename}
      >
        <View style={{ paddingHorizontal: 18 }}>
          <Heading
            title={title.length > 12 ? title.slice(0, 12) + "…" : title}
            sub={`${personaLabels[options.persona] || options.persona} · ${capabilityLabels[options.capability] || options.capability}`}
            back
            right={
              <Pressable
                accessibilityLabel="对话菜单"
                style={s.iconButton}
                onPress={() =>
                  Alert.alert("对话操作", "", [
                    { text: "取消", style: "cancel" },
                    ...(sessionId
                      ? [
                          {
                            text: "修改标题",
                            onPress: () => {
                              setRenameText(title);
                              setRename(true);
                            },
                          },
                        ]
                      : []),
                    { text: "加入错题本", onPress: saveQuestion },
                    { text: "学习方式", onPress: () => setOptionsOpen(true) },
                    {
                      text: "查看学习过程",
                      onPress: () => setTraceOpen((v) => !v),
                    },
                    { text: "恢复进度", onPress: () => void restoreProgress() },
                  ])
                }
              >
                <Icon name="ellipsis-horizontal" />
              </Pressable>
            }
          />
        </View>
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 18,
            paddingTop: 0,
            gap: 16,
            paddingBottom: 30,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() =>
            scroll.current?.scrollToEnd({ animated: true })
          }
        >
          {!messages.length && (
            <Empty
              title="今天有什么不懂的？"
              detail="可以问一道题，也可以让我帮你梳理一个知识点。"
              icon="chatbubbles-outline"
            />
          )}
          {messages.map((m, i) => (
            <View
              key={m.id || String(i)}
              style={[
                s.card,
                {
                  padding: 17,
                  backgroundColor: m.role === "user" ? C.pale : C.white,
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "95%",
                  width: m.role === "assistant" ? "95%" : undefined,
                  minWidth: 100,
                },
              ]}
            >
              <Text style={[s.muted, { marginBottom: 7 }]}>
                {m.role === "user" ? "我" : "DeepTutor"}
              </Text>
              {m.role === "user" ? (
                <Prose text={m.content} />
              ) : (
                dialogueParts(
                  displayBody(m) || (busy ? "正在思考…" : ""),
                  m.events,
                ).map((part, index) => (
                  <View
                    key={index}
                    style={
                      part.role === "user"
                        ? {
                            backgroundColor: C.pale,
                            padding: 12,
                            borderRadius: 12,
                            marginVertical: 10,
                          }
                        : undefined
                    }
                  >
                    {part.role === "user" ? (
                      <Text style={s.label}>我的回答</Text>
                    ) : null}
                    <Prose text={part.text} />
                  </View>
                ))
              )}
              {(m.events || [])
                .filter((e) => e.type === "tool_result" || e.type === "result")
                .map((e, index) => {
                  const meta = object(e.metadata);
                  const tool = object(meta.tool_metadata);
                  const mastery =
                    tool.mastery_question || meta.mastery_question;
                  const grade = object(
                    tool.mastery_grade || meta.mastery_grade,
                  );
                  const payload =
                    mastery ||
                    tool.visualization ||
                    meta.visualization ||
                    tool.result ||
                    meta.result ||
                    meta.data ||
                    (e.type === "result"
                      ? { ...meta, response: undefined }
                      : undefined);
                  return (
                    <View key={index}>
                      {payload ? (
                        <Content
                          value={payload}
                          onAnswer={
                            mastery
                              ? async (q, answer) => {
                                  if (sending.current)
                                    throw new Error("请等待当前讲解完成。");
                                  await send(answer, {
                                    mastery_answer: {
                                      question_id: string(q.question_id),
                                      text: answer,
                                    },
                                  });
                                }
                              : async (q, answer) => {
                                  if (sending.current)
                                    throw new Error("请等待当前讲解完成。");
                                  await send(
                                    `我的答案是：${answer}。请帮我检查思路并讲解。`,
                                    {
                                      capability: "deep_question",
                                      config: {},
                                      followup_question_context: q,
                                    },
                                  );
                                }
                          }
                        />
                      ) : null}
                      {Object.keys(grade).length ? (
                        <View style={s.notice}>
                          <Text style={s.h2}>
                            {grade.is_correct === true
                              ? "理解正确"
                              : grade.is_correct === false
                                ? "再想一想"
                                : "需要进一步说明"}
                          </Text>
                          <Prose text={grade.feedback || grade.explanation} />
                        </View>
                      ) : null}
                      {traceOpen ? (
                        <>
                          <Text style={s.muted}>
                            {e.type === "tool_result" ? "处理结果" : "学习成果"}
                          </Text>
                          <Prose text={e.content} />
                        </>
                      ) : null}
                    </View>
                  );
                })}
            </View>
          ))}
          {waitingCard ? (
            <View style={[s.card, { gap: 12 }]}>
              <Text style={s.h2}>轮到你想一想</Text>
              <Prose text={waitingCard.question} />
              {array(waitingCard.questions).map((q, i) => {
                const item = object(q);
                const key = string(item.id) || String(i);
                const choices = array(item.options);
                return (
                  <View key={key} style={{ gap: 8 }}>
                    <Prose text={item.prompt} />
                    {choices.length ? (
                      <Chips
                        value={answers[key] || ""}
                        onChange={(v) =>
                          setAnswers((a) => ({ ...a, [key]: v }))
                        }
                        items={choices.map((c, j) =>
                          typeof c === "string"
                            ? { value: c, label: c }
                            : {
                                value: string(object(c).label) || String(j),
                                label:
                                  string(object(c).label) ||
                                  string(object(c).text) ||
                                  string(object(c).body),
                              },
                        )}
                      />
                    ) : null}
                    <Field
                      label="你的想法"
                      value={answers[key] || ""}
                      onChangeText={(v) =>
                        setAnswers((a) => ({ ...a, [key]: v }))
                      }
                      multiline
                    />
                  </View>
                );
              })}
              <Button
                title="提交回答并继续"
                busy={replyBusy}
                onPress={() => void send()}
              />
            </View>
          ) : null}
          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: C.danger, lineHeight: 22 }}
            >
              {error}
            </Text>
          ) : null}
          {error && sessionId ? (
            <Button
              title="恢复学习进度"
              secondary
              onPress={() => void restoreProgress()}
            />
          ) : null}
        </ScrollView>
        <View
          style={{
            padding: 14,
            paddingBottom: 22,
            borderTopWidth: 1,
            borderTopColor: C.line,
            backgroundColor: C.white,
          }}
        >
          {!busy ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
              <SmallAction
                title="切换学习方式"
                onPress={() => setOptionsOpen(true)}
              />
              <SmallAction
                title={picking ? "正在选择…" : "添加附件"}
                onPress={() => void chooseDocument()}
              />
            </View>
          ) : null}
          {document ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 8,
              }}
            >
              <Text numberOfLines={2} style={[s.muted, { flex: 1 }]}>
                {document.name} · 发送后提交
              </Text>
              <SmallAction title="移除" onPress={() => setDocument(null)} />
            </View>
          ) : null}
          {photo && (
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                alignItems: "center",
                paddingBottom: 10,
              }}
            >
              <Image
                source={{ uri: photo.uri }}
                style={{ width: 52, height: 52, borderRadius: 9 }}
              />
              <Text style={s.muted}>照片已就绪，点击发送后开始识别</Text>
              <Pressable
                accessibilityLabel="移除照片"
                onPress={() => setPhoto(undefined)}
              >
                <Icon name="close-circle-outline" />
              </Pressable>
            </View>
          )}
          {busy && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <Text style={s.muted}>{status}</Text>
              <Pressable
                onPress={() => {
                  if (
                    turn.current &&
                    socket.current?.readyState === WebSocket.OPEN
                  )
                    socket.current.send(
                      JSON.stringify({
                        type: "cancel_turn",
                        protocol_version: "2.0",
                        turn_id: turn.current,
                        command_id: `cancel_${Date.now()}`,
                      }),
                    );
                }}
              >
                <Text style={s.link}>停止</Text>
              </Pressable>
            </View>
          )}
          <View
            style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}
          >
            <TextInput
              accessibilityLabel="输入问题"
              placeholder="把问题告诉我…"
              value={text}
              onChangeText={setText}
              editable={!busy || waiting}
              multiline
              style={[
                s.input,
                { flex: 1, maxHeight: 125, backgroundColor: C.bg },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="发送问题"
              disabled={(busy && !waiting) || !text.trim()}
              onPress={() => void send()}
              style={{
                backgroundColor: C.teal,
                borderRadius: 16,
                width: 50,
                height: 52,
                alignItems: "center",
                justifyContent: "center",
                opacity: (busy && !waiting) || !text.trim() ? 0.4 : 1,
              }}
            >
              <Icon name="arrow-up" color={C.white} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      {optionsOpen ? (
        <CapabilityOptions
          value={options}
          onChange={setOptions}
          onClose={() => setOptionsOpen(false)}
        />
      ) : null}
      <Modal
        visible={rename}
        transparent
        animationType="fade"
        onRequestClose={() => setRename(false)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          automaticOffset
          style={{ flex: 1, backgroundColor: "#14332D66" }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              padding: 28,
            }}
          >
            <View style={[s.card, { gap: 18 }]}>
              <Field
                label="对话标题"
                value={renameText}
                onChangeText={setRenameText}
                maxLength={100}
              />
              <Button title="保存标题" onPress={() => void saveTitle()} />
              <Button title="取消" secondary onPress={() => setRename(false)} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Page>
  );
}
