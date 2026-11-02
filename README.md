# DeepTutor Mobile

DeepTutor 的非官方 Android / iOS 客户端，提供中文聊天、资料阅读与错题整理，连接你在电脑或服务器上自行部署的 DeepTutor。

当前为 **[0.3.0-preview.1 源码预览](https://github.com/TinyPandaGame/deeptutor-mobile/releases/tag/v0.3.0-preview.1)**，适配目标为 DeepTutor 1.7.1。项目不包含后端、模型或现成安装包。

## 功能

- 聊天与拍照提问，识别结果可校对后保存为错题。
- 导入资料、阅读 PDF、显示公式和图表、导出与分享。
- 错题搜索、编辑与分页；收藏内容可另存为可编辑笔记。
- 切换服务、账号与工作区，自动恢复登录。
- 在“我的 → 应用更新”检查 GitHub 新版本，查看发布说明。

知识库、书籍、精通学习、写作等模块的范围与限制见[功能说明](docs/native-migration.md)，实际可用能力取决于服务端配置。

## 运行

需要 Node.js 24、npm、Python 3；Android 另需完整 JDK 17/21 和 Android SDK，iOS 另需 macOS、Xcode、CocoaPods 及模拟器。

```sh
git clone https://github.com/TinyPandaGame/deeptutor-mobile.git
cd deeptutor-mobile
npm ci
npm start
```

保持开发服务器运行，在另一终端选择设备并构建：

```sh
# Android 模拟器或测试手机
npm run android -- --list-devices
npm run android -- --device <adb序列号>

# iOS 模拟器
npm run ios -- --list-devices
npm run ios -- --device <模拟器UDID>
```

首次打开时填写手机可访问的 DeepTutor 地址，按服务设置登录。连接电脑需使用局域网 IP，不能填手机自己的 `localhost`；公网服务需 HTTPS 和账号认证。详见[电脑接入](docs/connect-computer.md)或[服务器接入](docs/connect-server.md)。

项目使用自定义原生模块，需自行构建，不能直接用 Expo Go。构建参数、虚拟服务试用及检查命令见[开发指南](docs/build.md)。

## 当前状态

Android 已完成构建和关键流程实测；iOS 仅完成模拟器构建，尚未完成交互和真机验收。完整记录见[验证说明](docs/validation.md)。

本版加入签名热更新的基础代码，但尚未发布公开 OTA 更新。已有安装包需先换用包含更新模块的基础包，详见[更新说明](docs/updates.md)。

预览版尚未覆盖全部桌面功能，仍有[已知依赖风险](docs/security-review.md)。兼容范围见[接口说明](docs/compatibility.md)。

## 许可证

[Apache-2.0](LICENSE)。基于 [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) 服务接口开发；归属与第三方许可见 [NOTICE](NOTICE) 和 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。
