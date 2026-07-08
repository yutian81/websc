# WebSC — 网站截图直链服务

> Cloudflare Workers + Browser Rendering Quick Actions  
> 输入网站 URL，一键生成截图直链，支持多分辨率，自动转为 WebP 格式

## 功能

- **落地页** `GET /websc` — 输入目标网址，点击生成即可获得截图直链
- **截图直链** `GET /https://target.com` — 直链即截图，浏览器可直接访问
- **多分辨率** — 默认 1080P（1920×1080），`?h=720` 切换 720P，`?h=360` 切换 360P，均为 16:9
- **WebP 格式** — 利用 Cloudflare 边缘 `cf.image` 自动转换存储为 WebP
- **缓存优先** — 已缓存截图直接返回，API 生成时后台预缓存全部分辨率
- **路径可自定义** — 落地页路径通过环境变量 `WEB_PATH` 配置，默认 `/websc`

## 目录结构

```
websc/
├── src/
│   └── index.ts                   # Worker 单文件，全部逻辑
├── wrangler.toml                  # Cloudflare 配置
├── worker-configuration.d.ts      # BROWSER / ScreenshotOptions 类型声明
├── tsconfig.json                  # TypeScript 配置
├── package.json
├── .gitignore
└── README.md
```

## 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/websc` | GET | 落地页（路径可通过环境变量 `WEB_PATH` 自定义） |
| `/api/sc` | POST | 生成截图 API，请求体 `{ "url": "https://..." }` |
| `/<protocol>://<target>` | GET | 截图直链，例如 `/https://example.com?h=720` |
| `/` | — | 返回 404 |

### 直链示例

```
# 默认 1080P
https://websc.your-name.workers.dev/https://github.com

# 指定 720P
https://websc.your-name.workers.dev/https://github.com?h=720

# 指定 360P
https://websc.your-name.workers.dev/https://github.com?h=360
```

## 环境变量

在 Cloudflare Dashboard → Worker `websc` → 设置 → 环境变量 中添加：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WEB_PATH` | `/websc` | 落地页访问路径 |
| `LANDING_PATH` | — | 兼容旧名称（若设置优先于 `WEB_PATH`） |

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
   - **构建命令**（可留空，wrangler 自动处理）：  
     ```
     npm run deploy
     ```
   - **构建输出目录**：留空
   - **根目录**：留空（仓库根目录）

5. **添加环境变量**  
   在 WebSC Worker 页面 → **设置** → **环境变量** → 添加：
   - 变量名：`WEB_PATH`，值：`/websc`（或自定义路径）
   - 变量名：`LANDING_PATH`，值：`/websc`（兼容）

6. **配置 R2 和 KV 绑定**  
   在 Worker 页面 → **设置** → **绑定** → **添加绑定**：
   - **R2 桶**：变量名称 `R2`，桶名称 `websc`（新建）
   - **KV 命名空间**：变量名称 `KV`，新建命名空间（名称自定，如 `websc-kv`）
   - **Browser Rendering**：在 wrangler.toml 中配置，自动生效

7. **触发部署**  
   - 推送代码到 GitHub 仓库即可自动触发部署
   - 也可在 Dashboard 手动点击 **保存并部署**

#### Git 部署的 `wrangler.toml` 注意事项

CF Dashboard 的 Git 集成会自动读取 `wrangler.toml`，无需在界面中重复配置大多数设置。但以下内容需要通过 Dashboard 手动设置：

- **环境变量**（如 `WEB_PATH`）
- **R2 桶**和 **KV 命名空间**的绑定（Dashboard 创建后，ID 会自动同步）
- **机密**（Secrets）

> 如果 Dashboard 提示缺少绑定，请在 Worker 设置页面手动添加 `R2` 和 `KV` 绑定，名称与 `wrangler.toml` 中的 `binding` 保持一致。

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

## wrangler.toml

```toml
name = "websc"
main = "src/index.ts"
compatibility_date = "2026-07-07"
keep_vars = true

[browser]
binding = "BROWSER"

[[r2_buckets]]
binding = "R2"
bucket_name = "websc"

[[kv_namespaces]]
binding = "KV"
```

- `keep_vars = true`：部署时不覆盖 Dashboard 中已设置的环境变量
- `[browser]`：Browser Rendering 绑定，用于截图
- `R2`：截图文件存储（WebP 格式）
- `KV`：截图元数据存储

## 技术架构

```
用户访问 /https://example.com
        │
        ▼
Cloudflare Worker (fetch handler)
        │
        ├─ 已缓存？→ 从 R2 读取 → 返回 WebP
        │
        └─ 未缓存？
              │
              ▼
        Browser Rendering (Quick Actions)
              │  视口 1920×1080 (或 1280×720 / 640×360)
              │  PNG 输出
              ▼
        临时写入 R2 → 自请求 + cf.image → WebP
              │
              ▼
        R2 永久存储 → KV 写入元数据 → 返回 WebP
```

## 依赖

| 包 | 版本 | 用途 |
|----|------|------|
| `wrangler` | ^4.108.0 | CLI 部署与本地开发 |
| `typescript` | ^5.5.2 | 类型检查 |
| `@cloudflare/workers-types` | ^5 | Workers 运行时类型 |