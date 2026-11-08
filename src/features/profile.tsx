import { useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { useResource } from "../lib/resources";
import { Button, C, Field, Heading, Page, Section, s } from "../ui";
import { Editor, ResourceState, useAction } from "./common";

export type ProfileInfo = { id: string; username: string; role: string; can_change_password?: boolean; must_change_password?: boolean };
type LearnerProfile = { age?: number; grade_level?: string; curriculum?: string; language?: string; reading_level?: string; explanation_style?: string };
export function Profile() {
  const { api, changePassword } = useAuth();
  const profile = useResource<ProfileInfo>(api?.mode === "account" ? "/api/auth/profile" : null);
  const learner = useResource<{ learner_profile: LearnerProfile | null }>(api?.mode === "account" && profile.data?.role === "user" ? "/api/auth/profile/learner-profile" : null);
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState("");
  const action = useAction();
  const p = profile.data;
  return <Page>
    <Heading title="账号与学习资料" back />
    {api?.mode === "anonymous" ? <Text style={s.muted}>此服务是免登录空间，没有账号密码。</Text> : <>
      <ResourceState resource={profile} />
      {p ? <View style={s.card}><Text style={s.h2}>{p.username}</Text><Text style={s.muted}>资料、错题与学习记录保存在这个账号下。</Text></View> : null}
      {learner.data ? <>
        <Section title="我的学习情况" />
        <View style={[s.card, { gap: 10 }]}>
          <Text style={s.text}>{learner.data.learner_profile?.grade_level || "还没有填写年级"}</Text>
          <Text style={s.muted}>{learner.data.learner_profile?.curriculum || "可以补充所用教材和喜欢的讲解方式。"}</Text>
          <Button title="修改学习资料" secondary onPress={() => setEditing(true)} />
        </View>
      </> : learner.error && learner.errorStatus !== 403 ? <ResourceState resource={learner} /> : null}
      {p?.must_change_password && p.can_change_password ? <View style={s.notice}><Text style={s.text}>你正在使用管理员设置的初始密码，可以在下面换成自己的密码。</Text></View> : null}
      {p?.can_change_password ? <>
        <Section title="修改密码" />
        <View style={{ gap: 16 }}>
          <Field label="当前密码" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" />
          <Field label="新密码（至少 8 位）" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" />
          <Field label="再次输入新密码" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" />
          {action.error ? <Text accessibilityRole="alert" style={{ color: C.danger }}>{action.error}</Text> : null}
          {notice ? <Text style={s.link}>{notice}</Text> : null}
          <Button title="保存新密码" busy={action.busy} disabled={!current || !next || !confirm} onPress={() => void action.run(async () => {
            setNotice("");
            if (next !== confirm) throw new Error("两次输入的新密码不一致。");
            await changePassword(current, next);
            setCurrent(""); setNext(""); setConfirm("");
            setNotice("密码已修改，本机自动登录也已更新。");
            await profile.reload();
          })} />
        </View>
      </> : p ? <Text style={[s.muted, { marginTop: 20 }]}>此账号由服务端管理登录方式，未开放密码修改。</Text> : null}
    </>}
    {editing && learner.data ? <Editor title="我的学习情况" onClose={() => setEditing(false)} fields={[
      { key: "age", label: "年龄", number: true, value: String(learner.data.learner_profile?.age || "") },
      { key: "grade_level", label: "年级", value: learner.data.learner_profile?.grade_level },
      { key: "curriculum", label: "所用教材", value: learner.data.learner_profile?.curriculum },
      { key: "reading_level", label: "阅读情况", value: learner.data.learner_profile?.reading_level },
      { key: "explanation_style", label: "希望怎样讲解", multiline: true, value: learner.data.learner_profile?.explanation_style },
    ]} onSave={async values => {
      const age = values.age.trim() ? Number(values.age) : undefined;
      if (age !== undefined && (!Number.isInteger(age) || age < 1 || age > 120)) throw new Error("请填写正确的年龄。");
      await api?.json("/api/auth/profile/learner-profile", { ...learner.data!.learner_profile, ...values, age }, "PUT");
      await learner.reload();
    }} /> : null}
  </Page>;
}
