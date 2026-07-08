// 自动生成的类型声明 — 手动维护以匹配 wrangler.toml
interface BROWSER {
  quickAction: (action: "screenshot", options: ScreenshotOptions) => Promise<Response>;
}
interface ScreenshotOptions {
  url?: string;
  html?: string;
  viewport?: { width: number; height: number; deviceScaleFactor?: number };
  screenshotOptions?: { type?: "png" | "jpeg"; quality?: number; fullPage?: boolean };
  gotoOptions?: { waitUntil?: string; timeout?: number };
}