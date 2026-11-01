import { router } from "expo-router";
import { useResource } from "../lib/resources";
import { Session } from "../lib/client";
import { Empty, Failure, Heading, Loading, Page, Row } from "../ui";
export default function History() {
  const r = useResource<{ sessions: Session[] }>("/api/sessions?limit=200");
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
            title={v.title || "新的对话"}
            detail={`${v.message_count || 0} 条消息`}
            icon="chatbubble-ellipses-outline"
            onPress={() =>
              router.push({ pathname: "/chat/[id]", params: { id: v.id } })
            }
          />
        ))
      )}
    </Page>
  );
}
