# 连接和身份架构

`Connection.origin` 是唯一网络源：协议、主机、端口共同定义服务。首版只接受根路径部署，不支持分开的 API / 网页源或子路径。连接引导只影响说明文案，电脑和服务器共用同一客户端实现。

`TutorClient` 持有不可变连接配置和一个账号会话，所有 API、文件上传、受保护附件下载与 WebSocket 地址由它生成。请求拒绝跳转；路径不得变成其他源。原生 HTTP 通过 Expo SDK 57 `expo/fetch` 使用 `credentials: omit`，从登录响应取得 `dt_token`，后续使用 Bearer 头，避免系统 Cookie 对同主机不同端口不隔离的问题。

WebSocket 在打开前检查 / 恢复登录，使用同源 `ws` / `wss` 与 Authorization 头，令牌从不放 URL。React Native 自身会读取共享 Cookie，因此配置插件在 Android 的 `WebSocketModule.setCustomClientBuilder` 上移除 Cookie 并拒绝跳转；iOS 用 `RCTSetCustomSRWebSocketProvider` 清空 Cookie 和关闭请求自动 Cookie。必须使用本项目生成的原生 App；iOS 的编译与设备实测状态见验证文档。SocketRocket 不将 HTTP 重定向当成有效握手。

`SessionManager` 用递增操作序号丢弃过期连接结果，切换前同步关闭当前客户端、取消 HTTP（包括响应体读取）和 WebSocket。存储写入串行执行，旧续期无法在退出后复活凭据。启动和前台恢复会检查登录；网络失败保留安全存储，前台每 10 秒重试连接；401 / 身份改变要求重新登录。GET 在明确 401 后最多续期重试一次，写入和学习回合不自动重复提交。无网络时不能离线读取服务器内容。

安全存储使用系统 Keychain / Android Keystore，键由完整服务源与账号无损编码，记录里同时保存来源与 user_id 并在读取时校验。每服务最多记住一个当前账号，最多 8 个服务；切换服务保留各自登录，退出当前账号删除该服务凭据。更新账号会移除旧账号记录。这里没有自建刷新令牌端点：上游未提供通用 refresh-token，恢复方式是在安全存储中保留密码，过期后调用官方 login。服务端改密或删除账号时重新输入。

列表缓存包含服务与 user_id；导航根随身份更换而重建。题目/照片草稿只存在当前客户端实例的内存中。相册、相机、文件选择器输出复制到仅当前会话拥有的临时目录，复制完成才清理来源暂存，退出或切换删除临时目录；启动清理上次异常退出的临时目录。资料仍由服务器保存。该设计不提供离线题库。

内嵌模块每次创建无缓存、无共享 Cookie 的临时 WebView。先在不加载外部脚本的空白文档中向当前源登录并验证 user_id，随后仅跳转同源目标。免登录模式只验证 `enabled=false` 和 `local-admin`，不提交虚构账号。页面拿到自己源的 HttpOnly Cookie，密码不注入服务器 HTML。跨源导航仅在用户确认后交给系统浏览器。服务本身是用户选择信任的执行源；客户端不能隔离同一恶意服务器的前端和后端。

## 依赖与替代方案比较

| 需求 | 已有能力 | 决定与维护成本 |
| --- | --- | --- |
| 可配置服务 | TS URL / React Context | 复用，不增加状态库；用纯 TS 会话管理器测试并发 |
| 安全持久化 | expo-secure-store | 复用系统存储；不使用 AsyncStorage 保存密码 |
| 隔离 HTTP / 文件 | expo/fetch、expo-file-system | 复用；明确禁用 Cookie/跳转，文件复制需 await |
| 流式回复 | React Native WebSocket | 复用协议；增加小型原生配置钩子处理共享 Cookie，而非引入整套认证 SDK |
| 复杂学习模块 | react-native-webview | 继续保留；每次临时会话，维护同源登录 bootstrap |
| 外部 App 分享 | 系统 document picker 可主动选文件 | 不新增接收库；直接分享接收不在首版范围 |
| 新 Expo 大版本 | 当前 SDK 57 与已适配依赖 | 暂不跨大版本升级；审计问题单列，发行前解决 |

原生页面：连接、登录、学习首页、我的、聊天/历史、错题列表与详情/编辑、资料列表/添加、拍照与裁剪。内嵌页面：完整互动聊天、复杂公式与图表、阅读、练习生成、研究、知识库、笔记、记忆、学习工作区、其他完整功能入口。
