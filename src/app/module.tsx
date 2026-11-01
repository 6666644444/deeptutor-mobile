import { useEffect, useState } from "react";
import { Alert, Linking, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { savedCredentials, useAuth } from "../lib/auth";
import { sameOrigin } from "../lib/connection";
import { moduleBootstrap } from "../lib/module-bootstrap";
import { Failure, Heading, Loading, Page } from "../ui";
export default function Module() {
  const { path = "/", title = "学习空间" } = useLocalSearchParams<{
    path: string;
    title: string;
  }>();
  const { api, user, config } = useAuth();
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void savedCredentials()
      .then((saved) => {
        if (!active) return;
        if (!config || !api || api.isClosed || (api.mode === "account" && (!saved || saved.user.user_id !== user?.user_id)))
          throw new Error("请重新登录后再打开。");
        setHtml(
          moduleBootstrap(
            config, saved,
            path,
          ),
        );
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, user?.user_id, retry, api, config]);
  if (!api || !config) return <Loading />;
  return (
    <Page scroll={false}>
      <View style={{ paddingHorizontal: 18 }}>
        <Heading title={title} back />
      </View>
      {error ? (
        <View style={{ padding: 20 }}>
          <Failure
            message={error}
            retry={() => {
              setHtml("");
              setError("");
              setRetry((v) => v + 1);
            }}
          />
        </View>
      ) : !html ? (
        <Loading />
      ) : (
        <WebView
          key={`${api.scope}-${retry}-${path}`}
          source={{ html, baseUrl: config.origin + "/" }}
          originWhitelist={[config.origin, "about:blank"]}
          incognito
          cacheEnabled={false}
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="never"
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          setSupportMultipleWindows={false}
          onMessage={(event) => {
            if (event.nativeEvent.data === "login_failed")
              setError("这个学习页面暂时未能登录，请重试。");
          }}
          onError={() => setError("这个学习页面暂时未能打开。")}
          onShouldStartLoadWithRequest={(request) => {
            if (sameOrigin(config, request.url) && /^\/(login|register)(\/|$)/.test(new URL(request.url).pathname)) {
              setError("这个页面的登录已变化，请返回后重新打开，以保持当前账号一致。");
              return false;
            }
            if (
              request.url === "about:blank" ||
              sameOrigin(config, request.url)
            )
              return true;
            if (/^https:\/\//.test(request.url))
              Alert.alert(
                "打开外部参考资料",
                "将在系统浏览器中打开，不携带学习账号凭据。",
                [
                  { text: "取消", style: "cancel" },
                  {
                    text: "打开",
                    onPress: () => {
                      void Linking.openURL(request.url);
                    },
                  },
                ],
              );
            return false;
          }}
        />
      )}
    </Page>
  );
}
