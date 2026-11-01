# 连接 VPS / 服务器

首版面向自己管理的 DeepTutor 1.7.1 部署。保持网页、`/api/*`、`/ws` 同一 HTTPS 源；填写 `https://tutor.example.com`，不要填写 `/api` 或登录页。首版不支持 URL 子路径、独立跨源 API、OAuth-only / 网关交互登录或设备配对替代用户名密码。

先按 [上游 1.7.1](https://github.com/HKUDS/DeepTutor/tree/v1.7.1) 配置服务，再启用 DeepTutor 本身的账号认证、创建账号并配置安全 Cookie。客户端读取 `/api/auth/status` 的 `enabled`，不会替你开启服务端认证。管理员若限制了 private_login_hosts，应提供允许登录的私有入口，不能靠客户端绕过。公网入口必须有可信 HTTPS 证书；客户端不提供忽略证书验证按钮。

下面是同源反向代理的结构示例。端口、证书与认证设置都应按自己的部署配置。它不会安装服务，也不能代替服务端认证：

```nginx
# 放在 http 块
map $http_upgrade $connection_upgrade { default upgrade; '' close; }
server {
    listen 443 ssl;
    server_name tutor.example.com;
    ssl_certificate /etc/letsencrypt/live/tutor.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tutor.example.com/privkey.pem;
    client_max_body_size 26m;
    location / {
        proxy_pass http://127.0.0.1:3782;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 180s;
    }
    location /ws {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 1800s;
    }
}
```

API 继续经过 DeepTutor 前端代理，以保留上游的受信前端登录策略；不要自行伪造 `x-deeptutor-frontend-host` 或暴露后台原始端口。确认前端代理配置的后台地址正确，并仅让预期代理访问后台。使用反向代理基础认证、Cloudflare Access 等额外网关时，首版未适配额外登录挑战，应选择可直接访问的私有服务入口。

App 选择“连接服务器”，首次按实际账号登录，以后自动恢复。服务失联不会清除凭据；密码变更、账号撤销或服务身份不符时重新登录。切换到另一套独立部署不会迁移或同步资料、错题和聊天。
