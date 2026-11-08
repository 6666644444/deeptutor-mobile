# 客户端更新

**APK 和 iOS 工程的发布不代表已下发 OTA；每个平台仍须有单独通过验收的签名清单。** 下述自动更新需要包含 `LearningUpdates` 的新基础包；旧安装包不能通过 JS 更新补装原生模块。

客户端只读取 `TinyPandaGame/deeptutor-mobile` 的 GitHub Releases。DeepTutor 官方更新先经过我们的适配与测试，再形成客户端发行版本；不会直接消费官方仓库、主分支提交或草稿。

## 使用方式

- 每次冷启动检查更新，返回前台时最多每分钟检查一次。兼容的新包自动下载，学习过程不被重启打断。
- 下载成功后提示“新版本已下载，重新打开应用后生效”；可主动重启，也可稍后关闭并重新打开。
- “我的 → 应用更新”保留手动重试、发行说明和安装包入口。更新失败继续使用当前版本，不清理账号或学习数据。
- 原生依赖、权限、分享扩展等改变会生成不同 runtime fingerprint，需要新的 APK / iOS 构建；不会向旧运行时加载不兼容的 JS。

## GitHub 直接分发

版本、签名清单、JS 和资源均来自我们的 GitHub Releases，无需 VPS 更新接口、EAS 托管账号或在客户端保存 GitHub 令牌。学习服务器仍是用户自行选择的 DeepTutor 服务，与客户端更新完全分开。

`expo-updates` 的原生加载器要求 Expo 协议响应头，普通 GitHub 文件下载不提供这些头。本项目的 `LearningUpdates` 原生模块仅在本机回环地址运行一个只读协议适配器：JS 读取本仓库发行信息，选择平台及 runtime 匹配的签名清单，适配器将原始签名字节交给 Expo。资源仍直接从 GitHub 下载。适配器不接受局域网连接，不拥有学习账号，不安装代码；最终签名、资源哈希和运行时校验由 Expo 原生加载器执行。

保留 Expo 的嵌入版本、启动回退及防损坏保护。没有打开 `disableAntiBrickingMeasures`，也没有运行时更换更新源。回环端口被占用、检查失败、签名不符或下载失败时，本次更新失败，继续使用原版本。

## 发布约定

1. 使用同一份锁定依赖、原生配置及公开证书构建基础包和导出资源。`fingerprint.config.js` 只忽略 JS 可见的 extra 发行元数据，保留原生依赖、插件、签名、权限等变化。
2. 导出对应平台的生产 bundle；`scripts/ota-package.mjs` 的 `prepareCandidate` 生成候选清单与内容哈希资源，不发布。清单资源地址固定为本仓库目标 Release。
3. 在相同 runtime 的独立安装包验证签名拒绝、下载、重启生效和学习流程，保存对应候选 SHA256 / updateId / runtime 的验收记录；不能用 mock 成功冒充真机链路通过。
4. `sealCandidate` 只接受匹配候选摘要且通过单测、原生下载、冷重启和学习回归的验收记录，使用仓库外私钥签名。私钥不能进入源码、Git 历史、安装包或公开附件。公开证书在 `modules/learning-updates/ota-certificate.pem`，更换它需要新基础包。
5. 先上传资源，最后上传 `ota-<platform>-<runtime>.json`，全部齐备后发布 Release。草稿不下发，正式客户端忽略预发布；预览客户端可接收预览版本。每次使用新标签，不覆盖已发布代码。只发源码、不含匹配签名清单的 Release 不会触发 OTA。

公开资源须通过隐私检查及对应候选的端到端验收。Android 和 iOS 分别验证，编译成功不能代替更新下载与重启测试。

### 打包命令

先导出生产资源及公开配置，再准备候选。`RUNTIME` 必须来自目标安装包实际构建的 fingerprint，不能猜测或沿用旧基础包的值；`VERSION` 与目标 Release 标签去掉 `v` 后一致。

```sh
node node_modules/expo/bin/cli export --platform android --output-dir /path/to/export
node node_modules/expo/bin/cli config --type public --json > /path/to/public-config.json
node --experimental-strip-types scripts/ota-release.mjs prepare \
  --export /path/to/export --config /path/to/public-config.json \
  --platform android --runtime RUNTIME --version VERSION --output /path/to/candidate
```

命令返回候选路径、SHA256（base64url）和 updateId。测试工具可用仓库外私钥签名候选进行隔离验证，但测试包与未验收记录不得直接发布。验收记录必须绑定同一候选的 `candidateSha256`、`updateId`、`platform`、`runtimeVersion`，并记录 `unitTests`、`nativeDownload`、`coldRestart`、`learningSmoke`、`result` 的真实结果；只有全部为 `passed` 才能封装发布清单。

```sh
node --experimental-strip-types scripts/ota-release.mjs seal \
  --candidate /path/to/candidate/candidate-android-RUNTIME.json \
  --evidence /path/to/acceptance.json --private-key /private/path/signing-key.pem \
  --certificate modules/learning-updates/ota-certificate.pem --output /path/to/release
```

将候选目录中 `ota-*.hbc` 和其他哈希资源与封装后的 `ota-android-RUNTIME.json` 附到同一个 Release；不要上传验收记录、未签名候选、配置文件或私钥。iOS 按相同过程单独导出、验收，不能沿用 Android 记录。本机替代分发接口的测试证明原生链路可用，但不能当作公开 GitHub 附件下载已验收。

## 当前验证状态

`0.3.0-preview.4` 已发布双端签名清单。Android / iOS 隔离模拟器均通过真实 GitHub 版本查询、清单读取、资源下载、界面重启及完全冷启动；更新后版本和候选 ID 一致。签名前还验证了错误签名拒绝、登录与草稿保留、合成服务的流式问答。

| 平台 | 清单对应的 runtime |
| --- | --- |
| Android | `660f96d42a49181f68a6ce46138eb863a1bcaf7b` |
| iOS | `37432659d1f76459bacdd6410f3c4da64ea5c62d` |

测试基线使用本版原生包及较旧的 JS 版本标记，以验证同 runtime 更新。**公开 preview.3 Android 安装包的 runtime 不同，需安装新版 APK**；自行签名或修改原生配置的 iOS 构建也须匹配 runtime。已安装 preview.4 的用户不会重复接收同版本更新。

本轮未验证 iOS 真机、生产更新源断网或真实模型推理；模型与主要学习流程的独立测试范围见[验证记录](validation.md)。历史本机模拟更新源的 503 测试不代表公开分发断网已验收。

参考：[Expo Updates](https://docs.expo.dev/versions/v57.0.0/sdk/updates/)、[运行时版本](https://docs.expo.dev/eas-update/runtime-versions/)、[GitHub Release 附件](https://docs.github.com/en/rest/releases/assets)。
