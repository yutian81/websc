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
   - 变量名：`WEB_PATH`，值：`/websc`（或自定义路径）

6. **触发部署**  
   - 推送代码到 GitHub 仓库即可自动触发部署
   - 也可在 Dashboard 手动点击 **保存并部署**

#### Git 部署说明

`wrangler.toml` 中声明的 `[[r2_buckets]]`、`[[kv_namespaces]]`、`[browser]` 绑定会在首次部署时自动创建并关联，无需在 Dashboard 手动配置。仅环境变量（`WEB_PATH`）需要在 Dashboard 手动添加。

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