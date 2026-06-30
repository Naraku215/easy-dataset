# 高级分块模块修复影响检查报告

## Context

用户要求检查两件事：
1. 之前的修复（`stripContinuationTitles`）是否意外改动了项目其他文件
2. 高级分块模块（advanced markdown）是否影响了项目原有功能

## 检查结论

### 1. 修复改动范围确认

**git diff 结果**：仅 `lib/file/split-markdown/advanced/chunker.js` 一个文件被修改。

改动内容（共 2 处）：
- **新增** `stripContinuationTitles` 函数（纯函数，逐行过滤 `> 所属章节：...` 行）
- **修改** `mergeShortChunks` 中合并后赋值行：`target.content = stripContinuationTitles(mergedContent)`

**未改动任何其他文件**。git status 中的 `md-chunker/` 目录删除是之前提交 `06a56c9`（"md。chunker第一版，残缺"）遗留的工作区状态，与本次修复无关。

### 2. 高级分块模块与项目集成关系

```
项目调用链：
┌─────────────────────────────────────────────────────────┐
│ lib/file/text-splitter.js (line 128)                    │
│   splitType === 'advanced-markdown' 时调用              │
│   → require('./split-markdown/advanced/index')          │
│     → splitAdvancedMarkdown(fileContent, config)        │
│       │                                                 │
│       ├─ chunkSections()     ← 来自 chunker.js          │
│       ├─ mergeShortChunks()  ← 来自 chunker.js (本次修复)│
│       └─ stripContinuationTitles() ← 新增，chunker 内部  │
│                                                         │
│ app/api/projects/[projectId]/advanced-split-preview/    │
│   route.js (line 34)                                    │
│   → require('@/lib/file/split-markdown/advanced/index') │
│     → splitAdvancedMarkdown() 预览用                    │
└─────────────────────────────────────────────────────────┘
```

**模块依赖分析**：
- `chunker.js` **仅被** `advanced/index.js` 导入（全项目唯一一处 `require('./chunker')`）
- `mergeShortChunks` 和 `chunkSections` **仅被** `advanced/index.js` 调用
- `stripContinuationTitles` **未导出**，是 `chunker.js` 内部私有函数

**共享模块**：
- `core/parser.js` 和 `core/summary.js` 被标准分块和高级分块**共享使用**
- 但本次修复**未触碰**这些共享模块

### 3. 影响评估

| 维度 | 评估 |
|------|------|
| 改动文件数 | 1 个（仅 chunker.js） |
| API 契约变化 | 无（函数签名不变，返回格式不变） |
| 对标准分块影响 | 无（chunker.js 不被标准分块使用） |
| 对共享模块影响 | 无（未修改 parser/summary） |
| 对其他分块方式影响 | 无（text-splitter.js 中各 splitType 独立分支） |
| 行为变化 | 仅：合并短块时移除 `> 所属章节：...` 续标题行（即预期修复） |

**结论：修复完全自包含于 `advanced/chunker.js`，不影响项目其他部分。**
