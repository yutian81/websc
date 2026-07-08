# WebSC — 网站截图直链服务

> Cloudflare Workers + Browser Rendering Quick Actions  
> 输入网站 URL，一键生成截图直链，支持多分辨率，自动转为 WebP 格式

## 功能

- **落地页** `GET /websc` — 输入目标网址，点击生成即可获得截图直链
- **截图直链** `GET /https://target.com` — 直链即截图，浏览器可直接访问
- **多分辨率输出** — GET 默认输出 1080P（1920×1080）；`?h=720` / `?h=360` 切换输出图片尺寸，均为 16:9
- **浏览器统一 1080P** — 截图浏览器视口固定 1920×1080，保证渲染一致性，输出时缩放到目标分辨率
- **WebP 格式** — 利用 Cloudflare 边缘 `cf.image` 自动转换并缩放存储为 WebP
- **缓存策略** — 浏览器缓存 1 天，CDN 边缘缓存 30 天
- **路径可自定义** — 落地页路径通过环境变量 `WEB_PATH` 配置，默认 `/websc`

## 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/websc` | GET | 落地页（路径可通过环境变量 `WEB_PATH` 自定义） |
| `/api/sc` | POST | 生成截图 API，请求体 `{ "url": "https://..." }` |
| `/<domain>` | GET | 截图直链（简写），例如 `/github.com?h=720` |
| `/<protocol>://<domain>` | GET | 截图直链（完整），例如 `/https://github.com?h=720` |
| `/` | — | 返回 404 |

### 直链示例

两种写法等价：

```
# 简写（推荐）
https://websc.your-name.workers.dev/github.com
https://websc.your-name.workers.dev/github.com?h=720
https://websc.your-name.workers.dev/github.com?h=360

# 完整
https://websc.your-name.workers.dev/https://github.com
https://websc.your-name.workers.dev/https://github.com?h=720
```

## 环境变量

在 Cloudflare Dashboard → Worker `websc` → 设置 → 环境变量 中添加：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WEB_PATH` | `/websc` | 落地页访问路径 |

> 无需鉴权密码。生成截图 API 为公开接口。

## 部署方法

### 方法一：CLI 部署（推荐首次）

```bash
# 1. 登录 Cloudflare
npx wrangler login

# 2. 部署（自动创建 R2 桶和 KV 命名空间）
npm run deploy

# 3. 设置环境变量
# 在 CF Dashboard → websc → 设置 → 环境变量 → 添加 WEB_PATH
```

### 方法二：CF Dashboard 连接 Git 仓库（推荐持续集成）

这是在 Cloudflare 面板上关联 GitHub/GitLab 仓库、自动部署的方式，适合团队协作或 CI/CD 场景。

#### 前置准备

- 代码已推送至 GitHub（或 GitLab）仓库
- Cloudflare 账号已登录

#### 操作步骤

1. **登录 Cloudflare Dashboard**  
   打开 [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages

2. **创建 Worker**  
   点击 **创建** → **Workers** → 输入名称 `websc` → **部署**

3. **连接 Git 仓库**  
   - 进入 Worker `websc` 页面
   - 点击 **设置** → **连接到 Git**（或页面上的 **Git 集成**）
   - 按提示授权 GitHub/GitLab 账号
   - 选择你的仓库和分支（如 `main`）

4. **配置构建设置**  
   - **构建命令**：`npm run deploy`  
   - **构建输出目录**：留空  
   - **根目录**：留空（仓库根目录）

5. **添加环境变量**  
   在 WebSC Worker 页面 → **设置** → **环境变量** → 添加：
   - 变量名：`WEB_PATH`，默认值：`/websc`（前面必须带 `/`）

6. **触发部署**  
   - 推送代码到 GitHub 仓库即可自动触发部署
   - 也可在 Dashboard 手动点击 **保存并部署**


> [!Tip]
> `wrangler.toml` 中声明的 `[[r2_buckets]]`、`[[kv_namespaces]]`、`[browser]` 绑定会在首次部署时自动创建并关联，无需在 Dashboard 手动配置。仅环境变量（`WEB_PATH`）需要在 Dashboard 手动添加，未设置则默认为 `websc`。

### 方法三：本地开发调试

```bash
# 安装依赖
npm install

# 本地启动（热重载）
npm run dev
# 访问 http://localhost:8787

# 部署
npm run deploy
```

## 技术架构

```
用户访问 /github.com 或 /https://github.com
        │
        ▼
Cloudflare Worker (fetch handler)
        │
        ├─ 已缓存？→ 从 R2 读取 → 返回 WebP（CDN 缓存 30 天）
        │
        └─ 未缓存？
              │
              ▼
        Browser Rendering (Quick Actions)
              │  视口固定 1920×1080
              │  PNG 输出
              ▼
        临时写入 R2 → 自请求 + cf.image
              │  format=webp + width=输出分辨率 + height=输出分辨率
              ▼
        R2 永久存储（WebP）→ KV 写入元数据 → 返回

## 依赖

| 包 | 版本 | 用途 |
|----|------|------|
| `wrangler` | ^4.108.0 | CLI 部署与本地开发 |
| `typescript` | ^5.5.2 | 类型检查 |
| `@cloudflare/workers-types` | ^5 | Workers 运行时类型 |