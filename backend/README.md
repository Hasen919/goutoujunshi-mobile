# 狗头军师 AI 接口

`api/reply.mjs` 是无依赖的 Vercel Node.js Function。部署时把 Vercel 项目的 Root Directory 设为 `backend`，然后配置环境变量：

- `APP_ACCESS_CODE`：至少 20 位的随机访问码；只交给自己使用，首次在手机页面输入后会保存在该浏览器。
- `OPENAI_API_KEY`：OpenAI 开放平台 API 密钥。
- `DEEPSEEK_API_KEY`：DeepSeek 开放平台 API 密钥。
- `APP_ALLOWED_ORIGIN`：`https://hasen919.github.io`。
- 可选 `OPENAI_MODEL`（默认 `gpt-6-sol`）、`DEEPSEEK_MODEL`（默认 `deepseek-v4-pro`；若更重视成本，可改为 `deepseek-flash`）。

至少配置一个提供商密钥才可使用对应选项。不要把密钥、访问码、`.env` 文件提交到 GitHub。部署后把接口完整地址（形如 `https://your-project.vercel.app/api/reply`）填到 `../dist/config.js` 的 `apiUrl`，并把 `availableProviders` 设为实际已配置的提供商，例如 `["deepseek"]`，再更新 GitHub Pages。未配置的模型会在手机界面明确显示“待接通”。网页本身无需账号登录，但访问码用于保护付费接口；公开网页和单靠 CORS 都不能防止他人消耗额度。建议在提供商控制台另设支出限制。

本地运行 `npm test` 验证输入校验、访问保护和双模型请求格式。测试只模拟 API，不消耗真实额度。
