# DeepTutor Mobile

第三方 DeepTutor Android / iOS 客户端，简体中文界面。首版适配目标为 **DeepTutor 1.7.1**；请先阅读 [兼容范围](docs/compatibility.md) 与 [实测记录](docs/validation.md)。这是可审阅的源码预览，不是 HKUDS 官方移动端发行版。

源码仓库：[TinyPandaGame/deeptutor-mobile](https://github.com/TinyPandaGame/deeptutor-mobile)。

同一个客户端可以连接你自己的电脑或 VPS。首次选择“连接我的电脑”或“连接服务器”，填写手机可访问的服务首页地址，按服务实际设置登录。下次打开自动连接并恢复会话。电脑必须在线且网络可达；“本地”指电脑，不是手机运行模型。独立部署之间不自动同步数据。

当前版本 **0.2.0-preview.1** 是原生重构源码预览。客户端拥有阅读、知识库、学习书籍、精通学习、笔记、写作、伙伴、记忆、日历、工作区及聊天页面，通过当前服务的 API / WebSocket 访问能力。旧模块地址只跳转到客户端自己的页面，不再打开上游应用网页或注入登录凭据。

保留多服务配置、免登录/账号模式、自动恢复、服务＋账号＋工作区隔离、照片/文档导入。外部 App 分享文件先进入本机收件箱，确认服务和账号后才上传。PDF 使用本地原生模块；数学与图表仍使用禁止网络访问的内联 WebView 内容画布，因此不能称为“完全没有 WebView”。

这不是桌面功能完全等价版本，也不包含后端或模型。模块范围、依赖取舍和未完成的高级工作流见 [迁移说明](docs/native-migration.md)。本次发布只提供源码包，不提供已签名的公开 APK / IPA。

## 快速运行

需要 Node.js 24（验证使用 24.16.0）、npm、Python 3。Android 另需完整 JDK 17 或 21、Android SDK；iOS 另需 macOS、Xcode、已安装的 iOS Simulator runtime 和 CocoaPods。使用独立测试目标，脚本必须通过 `--device` 明确指定设备，不会自动选择或操作其他设备。

```sh
git clone https://github.com/TinyPandaGame/deeptutor-mobile.git
cd deeptutor-mobile
npm ci  # 同时从锁定依赖生成离线公式/图表资源
npm run typecheck
npx tsc -p tsconfig.tests.json --noEmit
npm test
npm run lint
npx expo-doctor
node scripts/source-check.mjs
node scripts/source-check.mjs --history
```

先在本项目的独立终端保持 Metro 运行（默认 8086）：

```sh
npm start
```

Android：在 Android Studio Device Manager 新建并启动独立模拟器，或连接自己的测试手机；按安装位置设置 `JAVA_HOME`。SDK 位于系统常见目录时会自动识别，也可用 `ANDROID_HOME` 指定。

```sh
npm run android -- --list-devices
npm run android -- --device <adb设备序列号>
```

iOS：在 Xcode 创建独立模拟器后，用完整 UDID 选择它。脚本自动完成 prebuild、Pods、模拟器 ad-hoc 签名构建、安装和 Metro 启动地址设置，不需要 Apple 开发者账号或个人签名证书。

```sh
npm run ios -- --list-devices
npm run ios -- --device <模拟器UDID>
```

两端调试包依赖 Metro；第二次只需重装/启动已有包时，在对应命令追加 `--launch-only`。构建脚本不启动或占用已有后端，不发布安装包。iOS 不要关闭代码签名或手工添加设备 entitlement，否则模拟器 Keychain 会失败。完整参数、工具链和正式构建说明见 [构建说明](docs/build.md)。修改 `plugins/` 或原生依赖后必须重建。此项目包含 PDF、分享接收原生模块及 WebSocket 隔离插件，**不能使用 Expo Go 代替自有构建来验收隔离**。

仅用虚拟服务试用，不需要 DeepTutor 或模型账号：

```sh
node scripts/mock-service.mjs
```

Android 模拟器内填写 `http://10.0.2.2:8786`，账号 `demo` / 密码 `demo-pass`；第二个服务为端口 `8788`，免登录服务为 `8787`。可用第二个虚拟账号 `other`，密码相同。默认只监听回环地址。

iOS 模拟器或真实手机的业务服务不能填手机自己的回环地址。只在可信局域网中，可以显式把虚拟服务绑定到开发机实际拥有的私有 IP：

```sh
# 把示例地址替换成电脑当前局域网 IP；不会自动使用所有网卡
npm run mock -- --host 192.168.1.20 --base-port 8792
```

两端均填写 `http://192.168.1.20:8792`，免登录为 8793、第二个认证服务为 8794。仅使用虚拟账号与资料；不向公网转发这些测试端口。数据只在内存，这是接口测试替身，不是模型。`fixtures/fixture.txt` 可用于上传。阅读资料库包含内存生成的虚拟 PDF；聊天输入 `render` 可查看公式和图表示例。未实现的测试接口返回 404，不能把虚拟服务当成完整后端。测试结束按 Ctrl+C 关闭虚拟服务。

## 连接与安全

- [电脑局域网接入](docs/connect-computer.md)
- [VPS 与 HTTPS 接入](docs/connect-server.md)
- [架构、身份与临时文件边界](docs/architecture.md)
- [平台构建与发行](docs/build.md)
- [兼容性及接口依据](docs/compatibility.md)
- [验证状态](docs/validation.md)
- [依赖安全审计](docs/security-review.md)

公开源码和默认构建不包含任何预置服务。私有构建可使用 `.env.local` 中的 `EXPO_PUBLIC_DEFAULT_SERVER` 预填地址；该值会进入应用，不能放密码、令牌或任何密钥。公共发行构建必须保持为空。

## 开源范围

本仓库只包含客户端源码、配置插件、测试、虚拟数据和文档，没有服务端、模型、私人 Git 历史、账号文件、教材或学习记录。Android/iOS 生成目录、测试截图、安装包、签名材料与 `.env.local` 不进入仓库。

客户端采用 [Apache-2.0](LICENSE)。上游为 [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor)，保留 [NOTICE](NOTICE) 与 [第三方归属](THIRD_PARTY_NOTICES.md)。服务端能力由用户部署的 DeepTutor 提供；客户端页面与隔离内容画布的边界见架构文档。
