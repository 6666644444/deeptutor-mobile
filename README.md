# DeepTutor Mobile

第三方 DeepTutor Android / iOS 客户端，简体中文界面。首版适配目标为 **DeepTutor 1.7.1**；请先阅读 [兼容范围](docs/compatibility.md) 与 [实测记录](docs/validation.md)。这是可审阅的源码预览，不是 HKUDS 官方移动端发行版。

源码仓库：[TinyPandaGame/deeptutor-mobile](https://github.com/TinyPandaGame/deeptutor-mobile)。

同一个客户端可以连接你自己的电脑或 VPS。首次选择“连接我的电脑”或“连接服务器”，填写手机可访问的服务首页地址，按服务实际设置登录。下次打开自动连接并恢复会话。电脑必须在线且网络可达；“本地”指电脑，不是手机运行模型。独立部署之间不自动同步数据。

当前已实现连接管理、单用户免登录 / 账号认证识别、安全保存登录、失效会话自动恢复、按服务与账号隔离、聊天与流式回复、错题、资料添加、拍照入口，以及内嵌模块。学习页右上不重复显示“我”；资料添加保留返回、取消和上传前确认。外部 App 直接分享接收尚未实现：请先下载或导出文件，再用系统文件选择器添加。

## 快速运行

需要 Node.js 24（验证使用 24.16.0）、npm、JDK 17、Android SDK。使用自有隔离模拟器或测试设备；命令不会自动选中已有设备。

```sh
git clone https://github.com/TinyPandaGame/deeptutor-mobile.git
cd deeptutor-mobile
npm ci
npm run typecheck
npx tsc -p tsconfig.tests.json --noEmit
npm test
npm run lint
npx expo-doctor
node scripts/source-check.mjs
```

首次生成并构建独立安卓调试应用（默认包名 `org.deeptutormobile.client`，不会覆盖其他包名）：

```sh
# 按本机安装位置设置 JAVA_HOME 和 ANDROID_HOME
python3 scripts/build-android.py
# 在 Android Studio Device Manager 新建一个独立 API 36.1 arm64 模拟器
adb devices
adb -s <测试设备序列号> install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s <测试设备序列号> reverse tcp:8086 tcp:8086
# 在另一个终端保持运行；不使用已有项目的端口
npx expo start --lan --port 8086
adb -s <测试设备序列号> shell am start -n org.deeptutormobile.client/.MainActivity
```

调试包依赖 Metro，仅用于本机验证。生产独立包需按 [构建说明](docs/build.md) 生成与签名。普通源码变更热更新；修改 `plugins/` 或原生依赖后必须重新构建。此项目包含 WebSocket 隔离插件，**不能使用 Expo Go 代替自有构建来验收隔离**。

仅用虚拟服务试用，不需要 DeepTutor 或模型账号：

```sh
node scripts/mock-service.mjs
```

Android 模拟器内填写 `http://10.0.2.2:8786`，账号 `demo` / 密码 `demo-pass`；第二个服务为端口 `8788`，免登录服务为 `8787`。可用第二个虚拟账号 `other`，密码相同。服务只绑定开发机回环地址，数据仅在内存；这是接口测试替身，不是模型。`fixtures/fixture.txt` 可用于文件上传，不含教材或个人资料。

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

客户端采用 [Apache-2.0](LICENSE)。上游为 [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor)，保留 [NOTICE](NOTICE) 与 [第三方归属](THIRD_PARTY_NOTICES.md)。内嵌页面由用户部署的 DeepTutor 提供，不等于所有功能已用 React Native 重写。
