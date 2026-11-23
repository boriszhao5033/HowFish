# HowFish

HowFish 是一个面向中澳市场的常见食用鱼检索与知识展示应用，提供分类、俗称、学名、季节、价格、市场可得性与生食安全等信息。

项目为纯前端静态应用，使用 React、TypeScript、Vite、Tailwind CSS 与 PWA 构建。

## 开发

```powershell
npm install
npm run dev
```

## 检查与构建

```powershell
npm run typecheck
npm test
npm run build
```

离线单文件构建：

```powershell
npm run build:single
```

## 数据

前端运行时读取 `public/data/` 下的 JSON 数据。该目录仅包含前端展示所需的裁剪数据，不包含外部溯源链接。

## 部署

使用 Cloudflare Pages 部署：

- 构建命令：`npm run build`
- 输出目录：`dist`

## 许可证

本项目采用 MIT License，详见 `LICENSE`。
