import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/auth";
import { Session, TurnEvent, streamText } from "../../lib/client";
import { Photo, photoDraft, questionDraft } from "../../lib/drafts";
import {
  Button,
  C,
  Empty,
  Field,
  Heading,
  Icon,
  Page,
  openModule,
  s,
} from "../../ui";

type Message = { id: string; role: string; content: string };
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
  const [sessionId, setSessionId] = useState(id === "new" ? "" : id);
  const sid = useRef(id === "new" ? "" : id);
  const [title, setTitle] = useState("问一问 DeepTutor");
  const [rename, setRename] = useState(false);
  const [menu, setMenu] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [initialPhoto] = useState(() =>
    api ? photoDraft.peek(api) : undefined,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState(
    initialPhoto
      ? "请先识别图片里的题目和作答，列出不确定的地方，等我校对后再讲解。"
      : questionId
        ? "请引导我重新理解这道错题。先让我想一想，不要直接给出答案。"
        : "",
  );
  const [photo, setPhoto] = useState<Photo | undefined>(initialPhoto);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const socket = useRef<WebSocket | null>(null);
  const turn = useRef("");
  const sending = useRef(false);
  const alive = useRef(true);
  const scroll = useRef<ScrollView>(null);
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
  }, [api, id]);
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
  async function send() {
    if (!api || sending.current || !text.trim()) return;
    sending.current = true;
    setBusy(true);
    setError("");
    setStatus("正在连接…");
    const prompt = text.trim();
    const image = photo;
    const submission = `mobile_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const reply = submission + "_reply";
    try {
      // Validate/renew before opening WS; failed connections never silently re-submit a turn.
      await api.ensureSession();
      if (!alive.current) return;
      socket.current?.close();
      const options = api.socketOptions();
      const ws = new NativeSocket(options.url, null, { headers: options.headers });
      const detach = api.onClose(() => ws.close());
      socket.current = ws;
      let terminal = false;
      let opened = false;
      let response = "";
      let lastSeq = 0;
      const finish = (msg = "") => {
        if (socket.current !== ws || !alive.current) return;
        terminal = true;
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
        if (!alive.current || api.isClosed || socket.current !== ws) {
          ws.close();
          return;
        }
        opened = true;
        setText("");
        setPhoto(undefined);
        setStatus("DeepTutor 正在思考…");
        setMessages((v) => [
          ...v,
          {
            id: submission,
            role: "user",
            content: prompt + (image ? "\n[已附题目照片]" : ""),
          },
          { id: reply, role: "assistant", content: "" },
        ]);
        ws.send(
          JSON.stringify({
            protocol_version: "2.0",
            type: "start_turn",
            content: prompt,
            capability: "chat",
            client_submission_id: submission,
            ...(sid.current ? { session_id: sid.current } : {}),
            reply_language_override: "zh",
            question_notebook_references: questionId
              ? [Number(questionId)]
              : [],
            attachments: image
              ? [
                  {
                    type: "image",
                    base64: image.base64,
                    filename: image.filename,
                    mime_type: "image/jpeg",
                  },
                ]
              : [],
          }),
        );
      };
      ws.onmessage = (ev) => {
        if (!alive.current || api.isClosed || socket.current !== ws) return;
        let event: TurnEvent;
        try {
          event = JSON.parse(String(ev.data));
        } catch {
          finish("服务返回了无法识别的内容，请到对话详情查看。");
          return;
        }
        if (event.seq && event.seq <= lastSeq) return;
        if (event.seq) lastSeq = event.seq;
        if (event.session_id) {
          sid.current = event.session_id;
          setSessionId(event.session_id);
        }
        if (event.turn_id) turn.current = event.turn_id;
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
          finish("这一轮包含互动问题，请打开对话详情继续作答。");
        }
        if (event.type === "error")
          finish("这次讲解未完成。请打开对话详情查看原因，或稍后重新提问。");
        if (event.type === "done") {
          finish();
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
        if (terminal) return;
        finish(
          opened
            ? "连接中断，请打开对话详情确认已保存的结果，避免重复提交。"
            : "连接未建立，内容尚未提交，请重试。",
        );
      };
      ws.onclose = () => {
        detach();
        clearTimeout(timeout);
        if (!terminal)
          finish("连接已断开，请查看对话详情中的进度或已保存结果。");
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={{ paddingHorizontal: 18 }}>
          <Heading
            title={title.length > 12 ? title.slice(0, 12) + "…" : title}
            sub="不急着给答案，一起想明白"
            back
            right={
              <Pressable
                accessibilityLabel="对话菜单"
                style={s.iconButton}
                onPress={() => setMenu(true)}
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
                  minWidth: 100,
                },
              ]}
            >
              <Text style={[s.muted, { marginBottom: 7 }]}>
                {m.role === "user" ? "我" : "DeepTutor"}
              </Text>
              <Text selectable style={s.text}>
                {typeof m.content === "string"
                  ? m.content || "正在思考…"
                  : "此内容包含互动卡片，可在对话详情继续查看。"}
              </Text>
            </View>
          ))}
          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: C.danger, lineHeight: 22 }}
            >
              {error}
            </Text>
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
              editable={!busy}
              multiline
              style={[
                s.input,
                { flex: 1, maxHeight: 125, backgroundColor: C.bg },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="发送问题"
              disabled={busy || !text.trim()}
              onPress={() => void send()}
              style={{
                backgroundColor: C.teal,
                borderRadius: 16,
                width: 50,
                height: 52,
                alignItems: "center",
                justifyContent: "center",
                opacity: busy || !text.trim() ? 0.4 : 1,
              }}
            >
              <Icon name="arrow-up" color={C.white} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <View style={{ flex: 1, backgroundColor: "#14332D66", justifyContent: "center", padding: 28 }}>
          <View style={[s.card, { gap: 14 }]}>
            <Text style={s.h2}>对话操作</Text>
            <Button title="对话详情" onPress={() => { setMenu(false); openModule(sessionId ? `/chat/${sessionId}` : "/", "完整对话"); }} />
            {sessionId ? <Button title="修改标题" secondary onPress={() => { setMenu(false); setRenameText(title); setRename(true); }} /> : null}
            <Button title="加入错题本" secondary onPress={() => { setMenu(false); saveQuestion(); }} />
            <Button title="取消" secondary onPress={() => setMenu(false)} />
          </View>
        </View>
      </Modal>
      <Modal
        visible={rename}
        transparent
        animationType="fade"
        onRequestClose={() => setRename(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#14332D66",
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
        </View>
      </Modal>
    </Page>
  );
}
