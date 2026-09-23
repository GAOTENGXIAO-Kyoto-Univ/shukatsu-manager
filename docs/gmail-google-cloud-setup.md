# Gmail 邮件导入：Google Cloud 与 Convex 配置

本功能只接入 Gmail，不包含 Google Calendar。应用登录仍由 Clerk 负责；Google OAuth 只用于连接当前用户选择的一个 Google 账号。

## Google Cloud

1. 在目标 Google Cloud Project 中启用 Gmail API。
2. 配置 OAuth consent screen，并准备应用名称、支持邮箱、授权域名、隐私政策和服务条款等发布资料。
3. 创建类型为 Web application 的 OAuth 2.0 Client。
4. 添加实际使用的回调地址：`https://<应用域名>/integrations/google/callback`。开发与生产地址不同的话，两者都要登记。
5. 测试模式下，把用于联调的 Google 账号加入 Test users。
6. 本阶段请求 `openid`、`email` 和 `https://www.googleapis.com/auth/gmail.readonly`。不要额外添加 Gmail 写权限或 Calendar scope。

`gmail.readonly` 属于 Google 的 restricted scope。公开发布前，需要由项目负责人根据 Google 当前政策完成 OAuth 验证；如果服务器保存 restricted-scope 数据或凭据，还可能需要安全评估。代码实现完成不等于上述外部审核已完成。

## Convex 环境变量

以下值必须配置在对应的 Convex deployment，而不是前端公开环境变量中：

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI
GOOGLE_TOKEN_ENCRYPTION_KEY
GOOGLE_TOKEN_KEY_VERSION（可选）
```

`GOOGLE_OAUTH_REDIRECT_URI` 必须与 Google Cloud 中登记的回调地址完全一致。

`GOOGLE_TOKEN_ENCRYPTION_KEY` 是 32 字节随机值的 Base64 编码。请为开发与生产分别生成并安全保管；不要提交到 Git。PowerShell 可用下列命令生成一次性值：

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

可通过 Convex Dashboard 设置，或使用 CLI：

```text
npx convex env set GOOGLE_OAUTH_CLIENT_ID <value>
npx convex env set GOOGLE_OAUTH_CLIENT_SECRET <value>
npx convex env set GOOGLE_OAUTH_REDIRECT_URI <value>
npx convex env set GOOGLE_TOKEN_ENCRYPTION_KEY <value>
```

生产 deployment 需要单独设置生产值。

## 发布前人工验证

- 连接、重新授权、停用 Gmail、彻底断开 Google。
- 加载近期邮件；测试关键词与一条高级 Gmail `q` 查询。
- 分别预览纯文本邮件和 HTML-only 邮件。
- 确认只读取选中的单封 Message，不把 Thread 中其他邮件一起解析。
- 撤销 Google 授权后，确认界面进入“需要重新授权”状态。
- 在移动端宽度和桌面宽度检查搜索、邮件列表、预览、确认表单、冲突选择和最终导入。
- 使用不含真实敏感信息的测试邮件；确认 Convex、PostHog 和浏览器控制台中没有邮件正文或 OAuth token。
