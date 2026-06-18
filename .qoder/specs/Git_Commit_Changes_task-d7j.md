# 高级 Markdown 分块模块独立项目

## Context

`easy-dataset` 项目中的高级 Markdown 分块模块（原子块保护 + 5维度评分 + 三栏布局交互）功能完整且独立，但耦合在大型项目中（Prisma数据库、40+依赖、多功能混合页面）。将其独立为轻量项目可以：
- 让用户无需安装整个 easy-dataset 就能使用分块功能
- 降低依赖复杂度（14个生产依赖 vs 40+）
- 使用本地 JSON 文件存储，零数据库配置

## 技术栈

- Next.js 14 (App Router) + React 18
- MUI 5.16.14 + @emotion/react + @emotion/styled
- react-markdown 10 + github-markdown-css
- i18next + react-i18next（zh-CN / en）
- nanoid（ID生成）+ formidable（文件上传）
- 本地 JSON 文件存储（替代 Prisma）

## 项目目录结构

```
d:\DevEnv\EDS\md-chunker\
├── app/
│   ├── api/
│   │   ├── files/
│   │   │   ├── route.js                  # GET 文件列表 / POST 上传
│   │   │   └── [fileId]/
│   │   │       ├── route.js              # GET 文件内容 / DELETE 删除
│   │   │       └── download/route.js     # GET 下载原始文件
│   │   └── chunks/
│   │       ├── preview/route.js          # POST 分块预览
│   │       ├── save/route.js             # POST 保存分块
│   │       ├── [fileId]/route.js         # GET 加载已保存分块
│   │       └── export/route.js           # POST 导出分块
│   ├── layout.js                         # 根布局
│   ├── page.js                           # 主页面
│   └── globals.css
├── components/
│   ├── ThemeRegistry.js                  # MUI SSR 兼容
│   ├── I18nProvider.js                   # i18n Provider
│   ├── layout/
│   │   ├── AppLayout.js                  # AppBar + Content
│   │   └── LanguageSwitcher.js
│   ├── files/
│   │   ├── FileUploadArea.js             # 拖拽上传
│   │   ├── FileList.js                   # 文件列表（精简）
│   │   └── MarkdownViewDialog.js         # 原文查看
│   ├── chunking/
│   │   ├── AdvancedChunkDialog.js        # 三栏主对话框
│   │   ├── ChunkPreviewList.js           # 分块列表（编辑/合并/拆分）
│   │   └── OutlineTreePanel.js           # 大纲树
│   └── common/
│       └── ConfirmDialog.js
├── lib/
│   ├── engine/
│   │   ├── advanced/
│   │   │   ├── index.js                  # splitAdvancedMarkdown（直接复制）
│   │   │   ├── atomics.js               # 原子块保护（直接复制）
│   │   │   ├── chunker.js               # 分块引擎（直接复制）
│   │   │   ├── scoring.js               # 质量评分（直接复制）
│   │   │   └── sentence-splitter.js     # 句子分割（直接复制）
│   │   └── core/
│   │       ├── parser.js                 # 大纲+分段（直接复制）
│   │       └── summary.js               # 摘要生成（直接复制）
│   ├── storage/
│   │   ├── files.js                      # 文件 CRUD（JSON存储）
│   │   └── chunks.js                     # 分块 CRUD（JSON存储）
│   └── i18n.js                           # i18next 初始化
├── locales/
│   ├── zh-CN/translation.json
│   └── en/translation.json
├── data/                                 # 运行时数据（gitignore）
│   ├── uploads/
│   └── chunks/
├── package.json
├── jsconfig.json
├── next.config.js
├── .gitignore
└── README.md
```

## Task 1: 项目脚手架初始化

使用 `npx create-next-app@14` 创建项目于 `d:\DevEnv\EDS\md-chunker\`，配置：
- App Router, 无 Tailwind, 无 ESLint, JavaScript
- 配置 `jsconfig.json` 的 `@/` 别名
- 安装所有依赖
- 创建 `data/uploads/` 和 `data/chunks/` 目录
- 编写 `.gitignore`（含 `data/`）

**依赖列表：**
```json
{
  "dependencies": {
    "next": "^14.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@mui/material": "5.16.14",
    "@mui/icons-material": "5.16.14",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "@emotion/cache": "^11.11.0",
    "react-markdown": "^10.0.1",
    "github-markdown-css": "^5.8.1",
    "i18next": "^24.2.2",
    "react-i18next": "^15.4.1",
    "i18next-browser-languagedetector": "^8.0.4",
    "nanoid": "^5.1.5",
    "formidable": "^3.5.2"
  }
}
```

## Task 2: 核心引擎迁移（直接复制，零修改）

从源项目复制 7 个引擎文件到 `lib/engine/`：

| 源路径 | 目标路径 | 修改 |
|--------|----------|------|
| `lib/file/split-markdown/core/parser.js` | `lib/engine/core/parser.js` | 无 |
| `lib/file/split-markdown/core/summary.js` | `lib/engine/core/summary.js` | 无 |
| `lib/file/split-markdown/advanced/atomics.js` | `lib/engine/advanced/atomics.js` | 无 |
| `lib/file/split-markdown/advanced/sentence-splitter.js` | `lib/engine/advanced/sentence-splitter.js` | 无 |
| `lib/file/split-markdown/advanced/chunker.js` | `lib/engine/advanced/chunker.js` | 无 |
| `lib/file/split-markdown/advanced/scoring.js` | `lib/engine/advanced/scoring.js` | 无 |
| `lib/file/split-markdown/advanced/index.js` | `lib/engine/advanced/index.js` | require 路径保持 `../core/parser`，结构一致无需改 |

## Task 3: 存储层实现

`lib/storage/files.js`：
- `addFile(fileName, buffer)` → 生成 nanoid，写入 `data/uploads/{id}.md`，更新索引 JSON
- `getFiles()` → 读取 `data/metadata.json`
- `getFileById(fileId)` → 返回单个文件元信息
- `getFileContent(fileId)` → 读取 .md 内容
- `deleteFile(fileId)` → 删除文件 + 分块

`lib/storage/chunks.js`：
- `saveChunks(fileId, data)` → 写入 `data/chunks/{fileId}.json`
- `getChunksByFileId(fileId)` → 读取分块 JSON
- `deleteChunksByFileId(fileId)` → 删除分块文件
- `exportChunks(fileId, format)` → 组装导出格式

数据格式：
```json
// data/metadata.json
{ "files": [{ "id": "xxx", "fileName": "example.md", "size": 1234, "uploadedAt": "...", "chunkedAt": null }] }

// data/chunks/{fileId}.json
{ "fileId": "xxx", "fileName": "...", "savedAt": "...", "config": {...}, "chunks": [...], "stats": {...}, "outline": [...] }
```

## Task 4: API 路由实现

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/files` | GET | 返回文件列表 |
| `/api/files` | POST | 接收 FormData 上传 .md 文件 |
| `/api/files/[fileId]` | GET | 返回文件内容 |
| `/api/files/[fileId]` | DELETE | 删除文件及分块 |
| `/api/files/[fileId]/download` | GET | 流式下载原始文件 |
| `/api/chunks/preview` | POST | 调用 splitAdvancedMarkdown 返回预览结果 |
| `/api/chunks/save` | POST | 持久化分块结果到 JSON |
| `/api/chunks/[fileId]` | GET | 加载已保存分块 |
| `/api/chunks/export` | POST | 导出 JSON/JSONL 格式 |

## Task 5: 国际化配置

- `lib/i18n.js`：简化版，仅 zh-CN + en
- `locales/zh-CN/translation.json`：提取 `textSplit.*` + `common.*` + `settings.minLength/maxLength` 相关 key
- `locales/en/translation.json`：对应英文
- `components/I18nProvider.js`：客户端 Provider

## Task 6: 前端基础组件

- `components/ThemeRegistry.js`：MUI 5 Emotion SSR 兼容
- `app/layout.js`：根布局（ThemeRegistry + I18nProvider）
- `components/layout/AppLayout.js`：AppBar（应用名 + 语言切换）
- `components/layout/LanguageSwitcher.js`：语言切换按钮
- `components/common/ConfirmDialog.js`：通用确认弹窗

## Task 7: 文件管理组件

- `components/files/FileUploadArea.js`：.md 拖拽/点击上传
- `components/files/FileList.js`：精简版文件列表
  - 每行显示：文件名、大小、上传时间
  - 操作：查看原文、下载、高级分块、删除
  - **移除**：全选、搜索、GA对、批量删除、领域树等不相关功能
- `components/files/MarkdownViewDialog.js`：查看 Markdown 原文
  - 保留 react-markdown 渲染
  - 移除自定义分割模式（功能已由高级分块完全替代）
- `app/page.js`：主页面组合上述组件

## Task 8: 高级分块组件（核心 UI）

从源项目移植，最小修改：

**`components/chunking/OutlineTreePanel.js`** → 直接复制

**`components/chunking/ChunkPreviewList.js`** → 直接复制，保留全部交互：
- 展开/折叠、编辑、拆分、向上/下合并、删除
- 原子块完整性警告

**`components/chunking/AdvancedChunkDialog.js`** → 修改点：
- 去掉 `projectId` prop
- API 路径：
  - 预览：`/api/chunks/preview`（body: `{ fileId, config }`）
  - 保存：`/api/chunks/save`（body: `{ fileId, fileName, chunks, config }`）
  - 加载：`/api/chunks/${fileId}`
- DialogActions 增加"导出"按钮
- 保留完整的客户端评分副本和所有交互逻辑

## Task 9: 导出功能

- AdvancedChunkDialog 中增加"导出 JSON"按钮
- 调用 `/api/chunks/export`，支持 JSON / JSONL 格式
- 前端通过 Blob + <a> download 触发浏览器下载

## Task 10: README 与项目文档

- `README.md`：项目介绍、功能特性、安装运行、API文档、配置说明、示例
- `.gitignore`：`node_modules/`, `.next/`, `data/`
- `LICENSE`：AGPL 3.0（与源项目一致）

## Verification

1. `npm run dev` 启动开发服务器，访问 http://localhost:3000
2. 上传一个 .md 文件，验证文件列表正确显示
3. 点击"高级分块"按钮，调整参数，点击"预览分块"
4. 验证三栏布局正常：大纲树、分块列表（含评分+原子块警告）、参数统计
5. 测试编辑、拆分、合并操作后评分自动刷新
6. 保存分块，关闭对话框后重新打开，验证已保存数据正确加载
7. 导出 JSON，验证内容完整
8. 切换语言（zh-CN ↔ en），验证翻译正确
9. `npm run build` 确认构建成功
