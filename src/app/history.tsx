import { conversationTitle } from "../lib/conversation";
import { useState } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { useResource } from "../lib/resources";
import { Session } from "../lib/client";
import { Button, Empty, Failure, Heading, Loading, Page, Row, s } from "../ui";
export default function History() {
  const [page, setPage] = useState(0);
  const r = useResource<{ sessions: Session[] }>(
    `/api/sessions?limit=50&offset=${page * 50}`,
  );
  return (
    <Page>
      <Heading title="历史对话" sub="继续之前的思考，也可以修改标题" back />
      {r.loading && !r.data ? (
        <Loading />
      ) : r.error ? (
        <Failure message={r.error} retry={r.reload} />
      ) : !r.data?.sessions.length ? (
        <Empty title="还没有对话" detail="向 DeepTutor 提出第一个问题吧。" />
      ) : (
        r.data.sessions.map((v) => (
          <Row
            key={v.id}
            title={conversationTitle(v.title)}
            detail={`${v.message_count || 0} 条消息`}
            icon="chatbubble-ellipses-outline"
            onPress={() =>
              router.push({ pathname: "/chat/[id]", params: { id: v.id } })
            }
          />
        ))
      )}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Button
          title="上一页"
          secondary
          disabled={page === 0 || r.loading}
          onPress={() => setPage((p) => p - 1)}
        />
        <Text style={s.muted}>第 {page + 1} 页</Text>
        <Button
          title="下一页"
          secondary
          disabled={r.loading || (r.data?.sessions.length || 0) < 50}
          onPress={() => setPage((p) => p + 1)}
        />
      </View>
    </Page>
  );
}
