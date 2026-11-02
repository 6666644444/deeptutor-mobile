# 安装、构建和启动

源码预览锁定 Expo 57.0.31 / React Native 0.86.3 / React 19.2.3。需要 Node.js 24、npm ci、Python 3。Android 另需完整 JDK 17 或 21、Android SDK；iOS 需要 macOS、Xcode、可用的 Simulator runtime 和 CocoaPods。不要使用只有 java、没有 javac 的 JRE。

## 公共准备

```sh
npm ci
npm run typecheck
npx tsc -p tsconfig.tests.json --noEmit
npm run lint
npm test
node scripts/source-check.mjs
# Git 克隆可检查完整历史；源码压缩包不含 Git，跳过这一条
node scripts/source-check.mjs --history
```

在本项目的独立终端运行 `npm start`，保持 Metro 8086 在线。构建脚本先检查选定端口是否为 Metro；没有启动时会明确报错，不会悄悄使用其他项目的端口。需要更换端口时，Metro 与平台脚本均传入同一个 `--port`，例如先 `npx expo start --lan --port 8096`，再给平台命令加 `--port 8096`。请确认该端口属于本项目。

生成目录 android/、ios/ 由 Expo prebuild 管理，不能手工维护。网络权限和 WebSocket 隔离在 plugins/with-network.cjs；修改原生插件或依赖后重新构建。不能用 Expo Go 验收这些策略。

## Android

设置 JAVA_HOME 指向完整 JDK；macOS 已登记的 JDK 17/21 可自动发现。ANDROID_HOME / ANDROID_SDK_ROOT 优先，其次检查系统常见 SDK 目录。本轮构建验证使用 Temurin JDK 21、SDK 36、NDK 27.1.12297006、Gradle 9.3.1、arm64 模拟器。

先在 Android Studio 新建并启动自己的模拟器，或连接、授权测试手机：

```sh
npm run android -- --list-devices
npm run android -- --device <明确的adb序列号>
```

脚本只操作指定目标，按设备选择 arm64-v8a / x86_64 ABI，执行 prebuild、Debug 构建、安装、指定设备的 adb reverse 和应用启动。未授权、离线或不支持的设备会在构建前报错。没有 --device 时只构建 arm64 APK；可用 --arch x86_64 选择另一种构建目标，不安装到任何设备。

```sh
# 仅重新安装并启动已有 APK；修改原生代码后不可跳过构建
npm run android -- --device <序列号> --launch-only
# 只构建，不选设备
npm run android
```

默认产物为 android/app/build/outputs/apk/debug/app-debug.apk，默认包名 org.deeptutormobile.client。调试包依赖 Metro，并非独立发行包。--launch-only 必须沿用原构建使用的端口与兼容 ABI。

## iOS Simulator

在 Xcode 创建独立模拟器，使用其完整 UDID。DEVELOPER_DIR 优先；未设置时脚本检查当前 Xcode 选择，再尝试标准 Xcode 安装位置，只修改子进程环境，不更改系统 xcode-select 设置。

```sh
npm run ios -- --list-devices
npm run ios -- --device <模拟器UDID>
# 后续只安装启动已有包
npm run ios -- --device <模拟器UDID> --launch-only
# 只构建，不启动模拟器，不需要 Metro 在线
npm run ios -- --device <模拟器UDID> --build-only
```

脚本完成 prebuild、pod install、Xcode Debug simulator 构建、只启动指定模拟器、安装及启动应用。默认 DerivedData 为 artifacts/ios-simulator，可通过 --derived-data 指定独立目录；后续 --launch-only 必须使用同一目录。

模拟器构建明确使用 CODE_SIGN_IDENTITY=-、CODE_SIGNING_ALLOWED=YES、空 DEVELOPMENT_TEAM 和 provisioning profile，不申请个人证书或 provisioning。Xcode 会产生正确的模拟器专用 entitlement。不要改成 CODE_SIGNING_ALLOWED=NO：那只能证明编译，实际 Keychain 会报“没有所需的授权”。也不要手工把设备 entitlement 签入模拟器包。应用启动会自动设置 -RCT_jsLocation 127.0.0.1:<端口>，避免 No script URL provided。这是 JS 开发服务器地址，和应用内填写的 DeepTutor 业务服务地址不同。

脚本只接收模拟器 UDID，不接收真机。iOS 真机/Release 仍需使用者自己的签名配置；此源码预览不使用或发布个人签名资料。Keychain 可能跨卸载保留凭据，请先在 App 退出/移除服务，不能把卸载当成可靠的删除操作。

## 虚拟服务的双端接入

Android 模拟器可使用默认回环虚拟服务：`npm run mock`，应用填 http://10.0.2.2:8786。另两端口 8787 为免登录、8788 为第二认证服务。

iOS 模拟器或真实手机使用电脑实际局域网地址。仅在可信网络中，显式监听电脑持有的私有 IP：

```sh
# 替换示例 IP，端口组可以自行选择
npm run mock -- --host 192.168.1.20 --base-port 8792
```

应用填写 http://192.168.1.20:8792，账号 demo、密码 demo-pass。8793 是免登录，8794 是独立认证服务；other 是另一个虚拟账号，密码相同。仅写入虚拟数据，可用 fixtures/fixture.txt 上传；服务退出后内存数据消失。不要转发到公网，测试完成 Ctrl+C。脚本拒绝通配监听和未分配给本机的地址。客户端继续拒绝业务地址 localhost/127.0.0.1，没有为模拟器关闭真实手机的地址检查。

测试替身可在 /__fixture/expire 使虚拟令牌失效，用于检验恢复。它不是 DeepTutor，也不调用模型；真实模型、OCR 与学习闭环须另用隔离测试部署验收。

## 生产构建和公开交付

生产独立包使用 Expo 官方本地生产构建或自行配置的 EAS，先设定自己的包名与签名；生产 JS 随包内嵌，不依赖 Metro。签名资料放在仓库外。本次没有发行签名 APK/AAB/IPA 或上传 TestFlight。发行前还需处理 docs/security-review.md 中的适用依赖风险、真实服务与真机验证。

公开构建的 EXPO_PUBLIC_DEFAULT_SERVER 必须为空；该变量会进入客户端，绝不能放令牌。源码隐私检查可接收 SOURCE_PRIVATE_TERMS_JSON 环境变量中的私有禁用词数组；这些词不能写进公开扫描脚本或文档。--history 同时核查全部可达提交及作者/提交者邮箱，要求完整克隆；第三方许可证归属保留。检查通过不代替人工审阅。

```sh
npm run export:source -- --output-dir <交付目录>
```

导出仅包含受检文本源码，附文件清单与 SHA-256，不含 Git 历史、生成工程、截图、安装包、环境文件或签名材料。

## Native preview 0.2

Run `npm ci` before all builds: its postinstall generates offline renderer modules from the lockfile. They are intentionally absent from Git and the source archive. To regenerate after dependency changes, run `npm run bundle:content`. Native PDF/share modules live under `modules/`; their platform subdirectories are source and must remain in version control. Only root-level generated `android/` and `ios/` projects and module build outputs are excluded.

The iOS share extension uses an App Group derived from the configured bundle identifier. Simulator ad-hoc builds do not establish physical-device provisioning readiness. A device release needs the publisher's own App Group/provisioning configuration; no team identifier, certificate or private deployment is supplied here.

This preview release contains source only. Local Debug APKs are validation artifacts, not a public signed release, and require Metro. The independent public app is version 0.2.0 (Android versionCode 2); the repository pre-release tag is v0.2.0-preview.1.
