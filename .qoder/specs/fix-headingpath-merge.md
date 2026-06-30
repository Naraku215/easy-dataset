# 修复 mergeShortChunks 合并后 headingPath 未更新

## Context

`mergeShortChunks` 合并短块时更新了 `headings` 字段，但未更新 `headingPath`。导致合并后的块 `headingPath` 仅反映 target 的原始路径，而非合并后的完整路径。这会影响：
- 前端大纲树跳转（`headingPath` 用于定位）
- DB 持久化（`advanced-split/route.js` 将 `headingPath` 存为 JSON 字符串）

## 修复方案

**文件**：`lib/file/split-markdown/advanced/chunker.js`

在 `mergeShortChunks` 函数中，合并 `headings` 后立即用 `buildFullHeadingPath` 重新计算 `headingPath`：

```js
// 执行合并，并清理合并结果中残留的续标题行（> 所属章节：...）
target.content = stripContinuationTitles(mergedContent)
target.headings = (targetIdx < i)
  ? (target.headings || []).concat(chunk.headings || [])
  : (chunk.headings || []).concat(target.headings || []);

// 新增：根据合并后的 headings 重新计算 headingPath
target.headingPath = buildFullHeadingPath(target.headings, outline)
```

`buildFullHeadingPath` 已在同文件中定义（L208），接收 `headings` 数组和 `outline`，返回完整路径字符串数组。`outline` 参数已传入 `mergeShortChunks`。

## 验证

```bash
node -e "
const { splitAdvancedMarkdown } = require('./lib/file/split-markdown/advanced/index');
const md = '# 1 标题一\n' + '内容 '.repeat(100) + '\n# 1.1 子标题\n短内容\n# 1.2 另一子标题\n' + '更多内容 '.repeat(100);
const r = splitAdvancedMarkdown(md, { minLength: 800, maxLength: 2000 });
r.chunks.forEach((c,i) => {
  console.log('--- chunk', i, '---');
  console.log('headings:', c.headings);
  console.log('headingPath:', c.headingPath);
  console.log('headingPath matches last heading:', c.headingPath.length > 0 ? c.headingPath[c.headingPath.length-1] === c.headings[c.headings.length-1] : 'empty');
});
"
```
