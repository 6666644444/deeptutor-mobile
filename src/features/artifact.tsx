import { useMemo, useState } from "react";
import { Modal, View } from "react-native";
import { WebView } from "react-native-webview";
import { Button, Heading, Page } from "../ui";
import { SmallAction } from "./common";

const scriptValue = (v: string) => JSON.stringify(v).replace(/</g, "\\u003c");
function markup(code: string, kind: string) {
  const policy =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'";
  let body = code;
  if (["mermaid", "mindmap", "chartjs"].includes(kind)) {
    // Lazily load only the renderer this artifact actually needs. Strings never
    // execute in the app JS context; artifact code cannot reach credentials.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const runtime: string =
      kind === "chartjs"
        ? require("./chart-runtime").default
        : require("./mermaid-runtime").default;
    /* eslint-enable @typescript-eslint/no-require-imports */
    const render =
      kind === "chartjs"
        ? `const config=JSON.parse(${scriptValue(code)});config.options={...config.options,responsive:true,maintainAspectRatio:false};new Chart(document.getElementById('chart'),config);`
        : `mermaid.initialize({startOnLoad:false,securityLevel:'strict',maxTextSize:100000,suppressErrorRendering:true,theme:'neutral',flowchart:{htmlLabels:false}});const result=await mermaid.render('learning-diagram',${scriptValue(code)});document.getElementById('diagram').innerHTML=result.svg;`;
    body = `<div id="diagram"><div style="height:calc(100vh - 32px);min-height:200px"><canvas id="chart"></canvas></div></div><script>${runtime.replace(/<\/script/gi, "<\\/script")}</script><script>(async()=>{try{${render}${kind !== "chartjs" ? "const svg=document.querySelector('#diagram svg');if(svg)window.ReactNativeWebView.postMessage(String(svg.getBoundingClientRect().height+32));" : ""}}catch(e){document.getElementById('diagram').textContent='这份图表暂时无法显示，请重新生成。';}})();</script>`;
  }
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:8px;background:white;color:#183B39;font:16px system-ui;overflow:auto}svg{max-width:100%;height:auto}canvas{max-width:100%}button,input{font:inherit;min-height:42px}</style></head><body>${body}</body></html>`;
}
export function Artifact({ code, kind }: { code: string; kind: string }) {
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState(380);
  const html = useMemo(() => markup(code, kind), [code, kind]);
  const view = (full = false) => (
    <WebView
      source={{ html, baseUrl: "about:blank" }}
      style={
        full
          ? { flex: 1, backgroundColor: "white" }
          : { height, backgroundColor: "white" }
      }
      originWhitelist={["about:blank"]}
      onShouldStartLoadWithRequest={(r) => r.url === "about:blank"}
      sharedCookiesEnabled={false}
      thirdPartyCookiesEnabled={false}
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      setSupportMultipleWindows={false}
      javaScriptCanOpenWindowsAutomatically={false}
      mixedContentMode="never"
      onMessage={(e) => {
        if (!["mermaid", "mindmap"].includes(kind)) return;
        const n = Number(e.nativeEvent.data);
        if (Number.isFinite(n) && n >= 40 && n <= 20000)
          setHeight(Math.max(100, Math.min(680, Math.ceil(n))));
      }}
    />
  );
  return (
    <View style={{ gap: 8 }}>
      {view()}
      <SmallAction title="展开查看" onPress={() => setExpanded(true)} />
      {expanded ? (
        <Modal animationType="slide" onRequestClose={() => setExpanded(false)}>
          <Page scroll={false}>
            <Heading
              title="学习图示"
              right={<Button title="关闭" onPress={() => setExpanded(false)} />}
            />
            {view(true)}
          </Page>
        </Modal>
      ) : null}
    </View>
  );
}
