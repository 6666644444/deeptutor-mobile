# 客户端版本检查

在“我的 → 应用更新”查看 [GitHub Releases](https://github.com/TinyPandaGame/deeptutor-mobile/releases)。进入页面自动检查，也可手动重查；按 SemVer 比较版本，支持包含或排除预览版。预览构建默认包含预览版，正式构建默认排除。

- Android：发布中有已上传的 APK 时，可前往发布页选择下载并确认安装；只有源码时明确提示没有安装包。APK 是否适合设备及能否覆盖安装，仍取决于架构和签名。
- iOS：显示版本说明；安装更新需发行者提供 TestFlight 或 App Store 渠道。目前没有公开 iOS 安装渠道。
- 版本请求与学习服务独立，不发送账号、令牌或学习资料。只在进入更新页或手动检查时联网；网络错误、限流和超时会提示重试。

## 发布与热更新

源码发布前更新 `package.json` 与锁文件的发行版本。`app.config.js` 将该版本写入 `extra.releaseVersion`，用于检查；发行安装包时还需递增原生构建号。已发布标签不覆盖。

本版只有版本检查和发布页入口，**没有 OTA 热更新**。项目未安装 `expo-updates`，也未配置更新服务或 `runtimeVersion`。已有旧安装包需先重新构建、安装含此功能的版本。

后续可选 Expo Updates 配合 EAS Update 或兼容协议的自建服务，但需另行配置与验证。原生依赖、权限或分享扩展变化仍需新安装包。参考：[Expo Updates](https://docs.expo.dev/versions/v57.0.0/sdk/updates/)、[运行时版本](https://docs.expo.dev/eas-update/runtime-versions/)。

## 验证范围 · 2026-11-02

- 52 项自动测试、应用/测试 TypeScript、ESLint 和源码检查通过。
- Android arm64 Release 候选包验证了冷启动、当前版本、新版发现、正式/预览切换、重新检查、无 APK 提示、说明阅读与返回；不依赖 Metro。
- 外链成功调起系统浏览器并可返回，未验证浏览器正文或安装远端包。
- 网络错误、限流、超时与取消经过自动测试；断网错误提示未完成设备验收。本轮未验证 iOS 运行。

上述 Android 候选包在源码升版前构建，不作为公开安装包发布。其功能回归与最终源码检查分别记录，不将候选包视为已发布资产。
