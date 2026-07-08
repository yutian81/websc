// websc — Browser Rendering 截图 → WebP → R2 → KV 直链
// 路由: /websc 落地页 | /api/sc 生成截图 | /example.com 或 /https://example.com 直链

export interface Env {
  BROWSER: BROWSER;
  R2: R2Bucket;
  KV: KVNamespace;
  WEB_PATH?: string; // 落地页路径，默认 /websc
}

// ---------- 分辨率 16:9 ----------
const RES: Record<string, { w: number; h: number }> = {
  "1080": { w: 1920, h: 1080 },
  "720": { w: 1280, h: 720 },
  "360": { w: 640, h: 360 },
};
const DEF_RES = "1080";

async function hashUrl(u: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(u));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// ---------- 截图 ----------
async function shot(env: Env, url: string, w: number, h: number): Promise<ArrayBuffer> {
  return await (await env.BROWSER.quickAction("screenshot", {
    url,
    viewport: { width: w, height: h },
    screenshotOptions: { type: "png" },
    gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
  })).arrayBuffer();
}

// PNG → WebP（自请求 + cf.image）
async function toWebP(env: Env, buf: ArrayBuffer, self: URL, w: number, h: number): Promise<ArrayBuffer> {
  const tk = `_t/${crypto.randomUUID()}`;
  await env.R2.put(tk, buf, { httpMetadata: { contentType: "image/png" } });
  const u = new URL(self);
  u.pathname = `/__raw/${encodeURIComponent(tk)}`;
  try {
    return await (await fetch(u.toString(), { cf: { image: { format: "webp", width: w, height: h, fit: "contain" } } })).arrayBuffer();
  } finally {
    env.R2.delete(tk).catch(() => {});
  }
}

// 存储 R2 + KV
async function store(env: Env, url: string, res: string, data: ArrayBuffer): Promise<string> {
  const h = await hashUrl(url);
  await env.R2.put(`ss/${h}/${res}`, data, { httpMetadata: { contentType: "image/webp" } });
  const mk = `m:${h}`;
  const m: any = (await env.KV.get(mk, "json")) || { url, createdAt: new Date().toISOString(), resolutions: [] };
  if (!m.resolutions.includes(res)) m.resolutions.push(res);
  m.updatedAt = new Date().toISOString();
  await env.KV.put(mk, JSON.stringify(m));
  return h;
}

async function getCached(env: Env, h: string, res: string): Promise<Response | null> {
  const o = await env.R2.get(`ss/${h}/${res}`);
  if (!o) return null;
  const hs = new Headers();
  hs.set("content-type", "image/webp");
  hs.set("cache-control", "public, max-age=86400, s-maxage=604800");
  o.writeHttpMetadata(hs);
  return new Response(o.body, { headers: hs });
}

// 截图全流程
async function cap(env: Env, url: string, res: string, self: URL): Promise<Response> {
  const r = RES[res];
  const wb = await toWebP(env, await shot(env, url, r.w, r.h), self, r.w, r.h);
  await store(env, url, res, wb);
  return (await getCached(env, await hashUrl(url), res)) || new Response("ERR", { status: 500 });
}

// ---------- 落地页 ----------
function html(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>WebSC - 网站截图生成器</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      }
    body {
      font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #1e293b;
      border-radius: 16px;
      padding: 36px;
      width: 480px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,.5);
    }
    h1 {
      font-size: 22px;
      margin-bottom: 24px;
    }
    .sub {
      color: #94a3b8;
      font-size: 14px;
      font-weight: 400;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #cbd5e1;
    }
    input {
      width: 100%;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #334155;
      background: #0f172a;
      color: #e2e8f0;
      font-size: 14px;
      outline: none;
      transition: border-color .2s;
    }
    input:focus { border-color:#3b82f6; }
    .f { margin-bottom: 24px; }
    button {
      width: 100%;
      padding: 11px;
      border-radius: 10px;
      border: none;
      background: #3b82f6;
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #2563eb; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    #r {
      margin-top:18px;
      padding:14px;
      border-radius:10px;
      background:#0f172a;
      border:1px solid #334155;
      display:none;
      word-break:break-all;
      font-size:13px;
    }
    #r a { color: #60a5fa; }
    #e {
      color: #ef4444; 
      font-size:13px; 
      margin-top: 8px; 
      display:none; 
    }
    #l {
      text-align: center; 
      margin-top: 14px; 
      display: none; 
    }
    #pv { 
      margin-top: 14px; 
      display: none;
    }
    #pv img {
      width:100%; 
      border-radius: 8px; 
      border: 1px solid #334155;
    }
    .spin { 
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid #334155;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation:s .6s linear infinite;
    }
    @keyframes s { to {transform: rotate(360deg); } }
    </style>
</head>
<body>
  <div class="card">
    <h1>📸 WebSC <span class="sub"> | 网站截图 · 一键生成直链</span></h1>
    <div
      class="f"><label>目标网址</label>
      <input id="u" placeholder="https://example.com" autofocus>
    </div>
    <button id="b" onclick="g()">生成截图</button>
    <div id="l"><div class="spin"></div></div><div id="e"></div><div id="r"></div><div id="pv"></div>
  </div>
  <script>
    async function g(){
      const u=document.getElementById('u').value.trim(),
      b=document.getElementById('b'),
      l=document.getElementById('l'),
      e=document.getElementById('e'),
      r=document.getElementById('r'),
      v=document.getElementById('pv');
      e.style.display='none';
      r.style.display='none';
      v.style.display='none';
      if(!u){ e.textContent='请输入网址'; e.style.display='block'; return }
      b.disabled=true;
      l.style.display='block';
      try{
        const x=await fetch('/api/sc',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({url:u})
        });
        const d=await x.json();
        if(!x.ok){ e.textContent=d.error||'失败'; e.style.display='block'; return }
        r.innerHTML='<strong>直链：</strong><a href="'+d.url+'" target="_blank">'+d.url+'</a>';
        r.style.display='block';
        v.innerHTML='<img src="'+d.url+'" alt="预览" onerror="this.style.display=\'none\'">';
        v.style.display='block'
      } catch(err) {
        e.textContent='网络错误: '+err.message;
        e.style.display='block'
      } finally {
        b.disabled=false;
        l.style.display='none'
      }
    }
  </script>
</body>
</html>`;
}

// ---------- 入口 ----------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 落地页路径（可自定义）
      const landingPath = env.WEB_PATH || "/websc";

      // 内部：临时数据中转
      if (path.startsWith("/__raw/")) {
        const o = await env.R2.get(decodeURIComponent(path.slice(7)));
        if (!o) return new Response("NF", { status: 404 });
        const h = new Headers();
        h.set("content-type", "image/png");
        h.set("cache-control", "no-store");
        return new Response(o.body, { headers: h });
      }

      // 落地页
      if (path === landingPath) return new Response(html(), {
        headers: { "content-type": "text/html;charset=utf-8" }
      });

      // 生成截图 API
      if (path === "/api/sc" && request.method === "POST") {
        const { url: tu } = await request.json<any>();
        let fu = (tu || "").trim();
        if (!fu) return new Response(JSON.stringify({ error: "缺少url" }), { status: 400, headers: { "content-type": "application/json" } });
        if (!/^https?:\/\//i.test(fu)) fu = "https://" + fu;
        try { new URL(fu); } catch { return new Response(JSON.stringify({ error: "URL无效" }), { status: 400, headers: { "content-type": "application/json" } }); }

        // POST — 强制重新截图，覆盖所有分辨率
        await cap(env, fu, DEF_RES, url);
        ctx.waitUntil((async () => {
          for (const r of ["720", "360"]) {
            const rr = RES[r];
            const png = await shot(env, fu, rr.w, rr.h);
            await store(env, fu, r, await toWebP(env, png, url, rr.w, rr.h));
          }
        })());

        return new Response(JSON.stringify({ url: `${url.origin}/${fu}` }), {
          headers: { "content-type": "application/json" }
        });
      }

      // 截图直链 — 同时支持以下写法：
      //   /https://example.com  → 带协议   /example.com  → 自动补 https://
      if (path !== "/" && path !== landingPath && path !== "/api/sc") {
        let tu = path.slice(1);
        if (!/^https?:\/\//i.test(tu)) tu = "https://" + tu;
        const res = RES[url.searchParams.get("h") || ""] ? url.searchParams.get("h")! : DEF_RES;
        try { new URL(tu); } catch { return new Response("Invalid URL", { status: 400 }); }
        const h = await hashUrl(tu);
        // GET — 缓存优先
        const c = await getCached(env, h, res);
        if (c) return c;
        return await cap(env, tu, res, url);
      }

      return new Response("Not Found", { status: 404 });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || "Internal Error" }), {
        status: 500, headers: { "content-type": "application/json" }
      });
    }
  },
};