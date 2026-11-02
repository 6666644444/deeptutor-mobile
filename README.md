# DeepTutor Mobile

**在手机上使用你自己的 DeepTutor。**

拍照提问、阅读资料、整理错题，连接电脑或服务器上的学习服务。非官方 Android / iOS 客户端，界面为简体中文。

[获取源码](https://github.com/TinyPandaGame/deeptutor-mobile/releases) · [构建指南](docs/build.md) · [接入电脑](docs/connect-computer.md) · [接入服务器](docs/connect-server.md)

当前为 **0.3.0-preview.2 源码预览**，适配 DeepTutor 1.7.1。仓库包含客户端和可选个人模型扩展，不包含完整服务端、模型或现成安装包。

## 可以做什么

- **提问与讲解**：聊天、拍照提问，识别结果可校对后保存为错题。
- **阅读与整理**：导入资料、阅读 PDF、查看公式图表，导出与分享。
- **复习错题**：搜索、编辑和分页查看错题；收藏内容可另存为可编辑笔记。
- **选择模型**：对话中切换模型、恢复历史选择；普通账号可通过[可选扩展](server/README.md)管理自己的 API Key，管理员管理共享设置。
- **连接自己的服务**：切换服务、账号与工作区，自动恢复登录。

知识库、书籍、精通学习、写作等模块的实现与缺口见[功能对应表](docs/feature-coverage.md)。可用能力取决于服务端配置。

## 开始使用

1. 准备你自己的 DeepTutor 1.7.1 服务，保持电脑或服务器在线。
2. 按[构建指南](docs/build.md)安装客户端。项目包含自定义原生模块，不能直接用 Expo Go。
3. 填写手机可访问的服务地址，按服务设置登录。连接电脑使用局域网 IP；公网服务使用 HTTPS 和账号认证。

个人 API Key 提交给你连接的 DeepTutor 服务器保存，手机仅在编辑表单时使用输入值。请使用自己管理或信任的服务器；未安装个人模型扩展时，仍可切换服务器已授权的模型。

## 当前状态

Android 已完成构建及关键流程实测。iOS 此前通过模拟器构建，本轮模型管理尚未完成 iOS 验收。详细结果见[验证记录](docs/validation.md)。

签名热更新基础代码已提供，公开 OTA 尚未上线。预览版仍有[已知依赖风险](docs/security-review.md)，也未覆盖全部桌面功能。

## 开发与开源

[开发指南](docs/build.md) · [兼容范围](docs/compatibility.md) · [更新说明](docs/updates.md) · [问题反馈](https://github.com/TinyPandaGame/deeptutor-mobile/issues)

采用 [Apache-2.0](LICENSE)，基于 [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) 服务接口开发。上游归属及第三方许可见 [NOTICE](NOTICE) 和 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。
