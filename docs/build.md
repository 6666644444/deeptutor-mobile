# 安装、构建和发行

当前依赖锁定 Expo 57.0.31 / React Native 0.86.3 / React 19.2.3。使用 Node 24、npm ci。Android 生成工程使用 JDK 17、compile/target SDK 36、NDK 27.1.12297006、Gradle 9.3.1（由模板解析）。首次构建需要下载 Maven/Gradle 依赖；没有绑定某台开发机的工具链路径。

## Android 本机

设置 JAVA_HOME / ANDROID_HOME 后运行 `python3 scripts/build-android.py`。脚本只构建 arm64 调试 APK，不启动/抢占模拟器，不绑定现有模拟器，不重启任何后端。使用 `adb -s <serial>` 明确选择独立测试目标。Metro 默认 8086；调试 APK依赖 Metro，不是离线独立发行包。

生成目录 `android/` 和 `ios/` 都由 Expo prebuild 管理，不能手工维护。网络权限和 WebSocket 安全策略在 `plugins/with-network.cjs`。调试入口报连不上 Metro 时检查 8086 是否监听 IPv4，使用 `npx expo start --lan --port 8086`，并只为目标设备设置 `adb reverse tcp:8086 tcp:8086`。

正式独立构建可用 Expo 官方 [本地生产构建](https://docs.expo.dev/guides/local-app-production/) 或自行配置的 EAS。先确认自己的包名与签名，再生成 release。生产版 JS 随包内嵌，不依赖 Metro；本次没有发布或分发签名 APK/AAB。签名文件与凭据必须存放在仓库之外。源码预览包不能拿默认 debug 签名作为公开发行版本。

## iOS

代码共用，已有相机/相册、本地网络、SecureStore 权限，ATS 使用 NSAllowsLocalNetworking，不关闭全局 HTTPS 校验。`with-network.cjs` 生成 SocketRocket Cookie 隔离源码并添加到 Xcode Sources。原生构建后才有这些策略。

```sh
npx expo prebuild --platform ios --no-install
# 如果系统没有选择 Xcode，可仅为此命令指定，避免改全局开发环境
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer pod install --project-directory=ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npx expo run:ios --port 8086 --device <独立测试模拟器名称>
```

本轮 Xcode 27.0 arm64 模拟器目标不签名构建通过，尚未运行 iOS 交互或真机。完整状态以 `validation.md` 为准。此任务不上传 TestFlight、不使用私人签名身份、不修改既有 App Store 应用。iOS Keychain 可能跨卸载保留数据；要移除账号请先在 App 退出/移除服务，不能把卸载当成可靠的凭据删除操作。

## 可复现的虚拟验证

1. `node scripts/mock-service.mjs` 启动三个仅本机监听的服务。
2. Android 模拟器连接 `http://10.0.2.2:8786`，demo / demo-pass；测试上传 fixtures/fixture.txt、聊天和内嵌页。
3. 切换 8788 并用同名 demo 登录，资料应为空；切回 8786 自动恢复。
4. 8786 退出，再登录 other，资料应为空。`curl -X POST http://127.0.0.1:8786/__fixture/expire` 仅让虚拟令牌失效，重启 App 应恢复，无需输入密码。
5. 8787 免登录，不能继续携带原账号数据。关闭后重开应恢复此服务；切换应关闭旧网络操作。
6. 文件/照片草稿只作测试，避免在公开证据里放真实学习内容。

## 公开交付

`node scripts/source-check.mjs` 对明确列出的源码路径扫描，拒绝私人路径、部署标记、二进制资料和常见私钥。它不是保证无秘密的唯一证据，发布前还需审阅暂存列表和差异。公开构建必须没有 EXPO_PUBLIC_DEFAULT_SERVER；`.env.local` 永不提交。

源码仓库为 [TinyPandaGame/deeptutor-mobile](https://github.com/TinyPandaGame/deeptutor-mobile)，只发布经过隐私检查的独立客户端文件。源码公开与安装包发行分别处理，安装包还需完成依赖安全问题处理、真实服务全流程和目标设备验证；本轮交付为源码预览。

不启动模拟器的 iOS 编译复现命令：

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -workspace ios/DeepTutor.xcworkspace -scheme DeepTutor -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath artifacts/ios-derived CODE_SIGNING_ALLOWED=NO ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build
```
