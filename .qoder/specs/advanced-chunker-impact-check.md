# 高级分块模块全面问题检查报告

## Context

用户要求对高级分块模块（advanced markdown）进行更全面的问题检查，包括：
1. 确认之前的修复（`stripContinuationTitles`）没有改动项目其他文件
2. 检查高级分块模块本身是否存在影响项目其他部分的问题

## 一、修复改动范围确认

**git diff 结果**：仅 `lib/file/split-markdown/advanced/chunker.js` 被修改，改动 2 处：
- 新增 `stripContinuationTitles` 函数（私有，未导出）
- `mergeShortChunks` 合并后调用该函数清理续标题

**结论：未改动任何其他文件。** git status 中的 `md-chunker/` 目录删除是之前提交 `06a56c9` 遗留的工作区状态。

## 二、模块集成关系

```
调用链：
text-splitter.js (splitType === 'advanced-markdown')
  → split-markdown/advanced/index.js → splitAdvancedMarkdown()
    ├─ core/parser.js     (共享模块)
    ├─ core/summary.js    (共享模块)
    ├─ advanced/atomics.js
    ├─ advanced/chunker.js ← 本次修复
    └─ advanced/scoring.js

API 路由：
  advanced-split-preview/route.js → 预览（调用 splitAdvancedMarkdown）
  advanced-split/route.js         → 保存（接收前端 chunks 写入 DB）
  advanced-split-chunks/route.js  → 读取已保存的分块
```

**隔离性**：`chunker.js` 仅被 `advanced/index.js` 导入，不影响标准分块（`core/splitter.js`）。

## 三、发现的问题清单

### 问题 1：`overlap` 参数被静默忽略
- **文件**：`lib/file/text-splitter.js` L132 + `advanced/index.js` L76-81
- **描述**：`text-splitter.js` 传入 `overlap: taskConfig.chunkOverlap || 0`，但 `splitAdvancedMarkdown` 的 `mergedConfig` 从未读取 `overlap` 字段，该参数被静默丢弃
- **影响**：用户在设置中调整 `chunkOverlap` 对高级分块完全无效，可能产生困惑
- **严重程度**：低（功能缺失，非错误）

### 问题 2：`mergeShortChunks` 合并后 `headingPath` 未更新
- **文件**：`advanced/chunker.js` L485-487
- **描述**：合并时更新了 `headings` 字段，但 `headingPath` 保持 target 的原始值未更新
- **影响**：合并后的块 `headingPath` 不准确，影响前端大纲树跳转和 DB 持久化
- **严重程度**：中（数据准确性）

### 问题 3：`flushBuffer` case 1 路径不清理续标题
- **文件**：`advanced/chunker.js` L250-260
- **描述**：`flushBuffer` 情况1（短内容合并到上一块）直接拼接 `lastChunk.content + '\n\n' + buffer.content`，如果 `lastChunk` 是 case 3 产生的 Part 2+（开头有 `> 所属章节：`），合并后续标题仍保留在开头
- **影响**：与用户报告的问题类似，但出现在不同的代码路径
- **严重程度**：中（内容质量问题）
- **说明**：此路径的续标题在开头位置（非中间），语义上可接受，但不理想

### 问题 4：短块判断与大小守卫的长度计算不一致
- **文件**：`advanced/chunker.js` L431 vs L477
- **描述**：短块判断用 `chunk.content.trim().length`，大小守卫用 `mergedContent.length`（未 trim）
- **影响**：含大量首尾空白的块可能被误判为超限而跳过合并
- **严重程度**：低（边界情况）

### 问题 5：`buildFullHeadingPath` 对重复标题只匹配第一个
- **文件**：`advanced/chunker.js` L219
- **描述**：`outline.findIndex(o => o.title === lastTitle)` 只找到第一个匹配，文档中有重名标题时路径可能错误
- **影响**：语义亲合度计算可能不准，导致合并方向选择不当
- **严重程度**：低（需要文档有重名标题才触发）

### 问题 6：`scoring.js` 对续标题的评分规则在合并后失效
- **文件**：`advanced/scoring.js` L79-81
- **描述**：`scoreHeadingPresence` 有规则 `if (/^\s*>\s*所属章节：/.test(content)) return 15`，但合并后续标题已被 `stripContinuationTitles` 移除，此规则不再匹配合并块
- **影响**：合并块如果无标题行开头，标题评分可能从 15 降为 0
- **严重程度**：低（评分仅用于预览展示，不持久化）
- **说明**：此行为变化是修复的合理副作用——合并后应基于实际内容评分

## 四、对项目其他部分的影响评估

| 检查项 | 结果 |
|--------|------|
| 标准分块 (`core/splitter.js`) | 不受影响（独立代码路径） |
| 共享模块 (`core/parser.js`, `core/summary.js`) | 不受影响（未修改） |
| TOC 提取 (`core/toc.js`) | 不受影响（高级分块不使用） |
| DB Schema (`Chunks` 模型) | 兼容（`headingPath` 为 `String @default("")`） |
| 问题生成 (`lib/services/tasks/`) | 不受影响（只读取 chunk.content） |
| 前端组件 | 不受影响（通过 API 获取数据） |

## 五、建议修复优先级

1. **问题 2**（headingPath 未更新）- 应修复，影响数据准确性
2. **问题 1**（overlap 被忽略）- 应处理，要么使用要么在 UI 提示不适用
3. **问题 3**（flushBuffer case 1 续标题）- 可选修复
4. 问题 4-6 - 低优先级，可后续处理
