# DeepTutor Mobile

**在手机上使用你自己的 DeepTutor。**

拍照提问、阅读资料、整理错题，连接电脑或服务器上的学习服务。非官方 Android / iOS 客户端，界面为简体中文。

[版本与下载](https://github.com/TinyPandaGame/deeptutor-mobile/releases) · [接入电脑](docs/connect-computer.md) · [接入服务器](docs/connect-server.md) · [开发指南](docs/build.md)

适配 DeepTutor 1.7.1。学习服务和模型由你自己的电脑或服务器提供，手机保存连接后即可再次使用。

## 下载与安装

**0.3.0-preview.4**：[发布说明与校验信息](https://github.com/TinyPandaGame/deeptutor-mobile/releases/tag/v0.3.0-preview.4)。

| 平台 | 交付形式 | 使用方式 |
| --- | --- | --- |
| Android | [下载 APK（arm64）](https://github.com/TinyPandaGame/deeptutor-mobile/releases/download/v0.3.0-preview.4/deeptutor-mobile-0.3.0-preview.4-arm64-v8a.apk) | 安装后填写自己的服务地址；无需开发环境 |
| iOS | [下载 Xcode 工程 ZIP](https://github.com/TinyPandaGame/deeptutor-mobile/releases/download/v0.3.0-preview.4/deeptutor-mobile-0.3.0-preview.4-ios-project.zip) | 需要 Mac、Xcode、Node.js、Python 3、CocoaPods 及自己的签名；不是可直接安装的 IPA |

iOS 工程准备和源码开发流程见[安装与构建指南](docs/build.md)。

## 可以做什么

- **提问与讲解**：聊天、拍照提问，识别结果可校对后保存为错题。
- **阅读与整理**：导入资料、阅读 PDF、查看公式图表，导出与分享。
- **复习错题**：搜索、编辑和分页查看错题；收藏内容可另存为可编辑笔记。
- **选择模型**：对话中切换模型、恢复历史选择；普通账号可通过[可选扩展](server/README.md)管理自己的 API Key，管理员管理共享设置。
- **连接自己的服务**：切换服务、账号与工作区，自动恢复登录。

知识库、书籍、精通学习、写作等模块的实现与缺口见[功能对应表](docs/feature-coverage.md)。可用能力取决于服务端配置。

## 开始使用

1. 在自己的电脑或服务器上运行 DeepTutor 1.7.1，并安装客户端。
2. 首次打开选择“我的电脑”或“我的服务器”，填写服务地址。私网 IP 可省略 `http://`，公网域名默认使用 `https://`；完整地址可直接粘贴。
3. 按服务设置登录。连接与登录会保存，下次打开自动恢复；也可从已保存的服务切换。

电脑需保持在线，手机不能填写电脑的 `localhost`。公网服务必须启用账号认证；两套独立部署之间不会自动同步资料。

个人 API Key 提交给你连接的 DeepTutor 服务器保存，手机仅在编辑表单时使用输入值。请使用自己管理或信任的服务器；未安装个人模型扩展时，仍可切换服务器已授权的模型。

## 当前状态

Android 提供独立安装包，iOS 提供自行构建的工程。iOS 工程能够构建不代表已完成真机或 App Store 验收；具体测试范围见[验证记录](docs/validation.md)及对应版本的发布说明。

签名热更新基础代码已提供，公开 OTA 尚未上线。预览版仍有[已知依赖风险](docs/security-review.md)，也未覆盖全部桌面功能。

## 开发与开源

[开发指南](docs/build.md) · [兼容范围](docs/compatibility.md) · [更新说明](docs/updates.md) · [问题反馈](https://github.com/TinyPandaGame/deeptutor-mobile/issues)

采用 [Apache-2.0](LICENSE)，基于 [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) 服务接口开发。上游归属及第三方许可见 [NOTICE](NOTICE) 和 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。
