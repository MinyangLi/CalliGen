# CalliGen 前端

基于 React、TypeScript 和 Vite 的书法设计界面，包含 Sketch 画板、绘图工具栏和书法结果预览面板。

## 本地运行

```bash
cd web/frontend
npm ci
npm run dev
```

打开开发服务器输出的地址，并访问 `/calligen`，默认地址为 `http://localhost:5173/calligen`。

## 构建与预览

```bash
npm run build
npm run preview
```

本目录只包含前端。界面和画板可独立运行；AI 生成按钮预留了 `POST /api/generate-font` 请求，需要另行接入后端才会生成结果。开发代理配置见 `vite.config.ts`。
