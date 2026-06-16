# 评分模块第二轮修复：句子完整性加分逻辑

## Context

用户验证分块效果后发现：以 HTML闭合标签/$$/表格行 结尾的 chunk 与加句号结尾的 chunk 分差过大（8分），因为后三种结尾已代表语义完整，却未被视为"完整标点结尾"的等价物。扣分项也缺少中文指代词/连接词。

> 原子块完整性检测增强（问题2）暂搁置，本次仅处理问题1。

---

## Task 1：句子完整性加分逻辑重构（维度3）

### 文件：`scoring.js` + `AdvancedChunkDialog.js`

**问题**：以 `</table>` 结尾 → 12+5=17 分；以 `</table>。` 结尾 → 12+5+5+5=27→25 分。加一个句号增加 8 分，不合理。

**修复**：将 HTML闭合标签/$$/表格行结尾提取为布尔变量，并纳入"以完整标点结尾"的等价条件。

**修改前后对比**：

| 结尾方式 | 修改前 | 修改后 |
|---------|--------|--------|
| `</table>` | 17 | **22** |
| `</table>。` | 25 | 22 |
| `$$` | 17 | **22** |
| `\| a \| b \|` | 17 | **22** |
| `。` | 22 | 22 |

核心改动：
1. `endsWithHtmlClose`、`endsWithDisplayMath`、`endsWithTableRow` 提取为布尔变量
2. "完整标点结尾"条件扩展为：`/[.!?。！？）\)」』\]】]$/.test(trimmed) || endsWithHtmlClose || endsWithDisplayMath || endsWithTableRow`
3. 新增中文连接词/指代词扣分（26词），使用 `startsWith` 匹配：
   - 回指词：上述、前述、上列、前者
   - 下指词：如下、下列、以下
   - 近指词：该、此、这些、此项、此法
   - 承接连词：此外、另外、因而、故、进而、继而
   - 包含词：其中
   - 后指词：后者
   - 图表参照：见表、参见、详见、见下文、见下表

`AdvancedChunkDialog.js` 中 `_scoreSentenceCompleteness` 完全同步。

---

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `lib/file/split-markdown/advanced/scoring.js` | scoreSentenceCompleteness 重构 |
| `components/text-split/advanced/AdvancedChunkDialog.js` | _scoreSentenceCompleteness 同步 |

---

## 验证

1. `next build` 编译通过
2. 以 `</table>` 结尾 → 句子完整性得 22 分（原17分）；加句号后仍为 22 分
3. 以中文指代词（如"该"）开头 → 句子完整性扣 3 分