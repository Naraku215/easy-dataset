/**
 * 分块质量评分模块
 *
 * 对每个分块计算 0-100 的质量分数，用于预览界面展示。
 * 评分不持久化到数据库。
 */

/**
 * 对单个分块评分
 * @param {Object} chunk - {content, headings, partIndex, totalParts}
 * @param {Object} config - {minLength, maxLength}
 * @returns {number} - 0-100 的质量分数
 */
function scoreChunk(chunk, config) {
  const { minLength = 800, maxLength = 2000 } = config;
  const content = chunk.content || '';
  const len = content.trim().length;

  let total = 0;

  // 1. 长度适当性 (0-30)
  total += scoreLengthAdequacy(len, minLength, maxLength);

  // 2. 标题存在 (0-15)
  total += scoreHeadingPresence(content, chunk.headings);

  // 3. 句子完整性 (0-20)
  total += scoreSentenceCompleteness(content);

  // 4. 原子块完整性 (0-20) - 算法保证，通常满分
  total += scoreAtomicIntegrity(content);

  // 5. 内容多样性 (0-15)
  total += scoreContentVariety(content);

  return Math.round(Math.min(100, Math.max(0, total)));
}

/**
 * 长度适当性评分 (0-30)
 * 在 [min, max] 的中点附近满分，越偏越低
 */
function scoreLengthAdequacy(len, minLength, maxLength) {
  if (len === 0) return 0;

  const midpoint = (minLength + maxLength) / 2;
  const halfRange = (maxLength - minLength) / 2;

  if (len >= minLength && len <= maxLength) {
    // 在范围内，按离中点的距离打分
    const distFromMid = Math.abs(len - midpoint);
    const ratio = 1 - (distFromMid / halfRange);
    return 20 + ratio * 10; // 20-30 分
  } else if (len < minLength) {
    // 低于最小值
    const ratio = len / minLength;
    return ratio * 20; // 0-20 分
  } else {
    // 超过最大值
    const overRatio = maxLength / len;
    return overRatio * 20; // 0-20 分
  }
}

/**
 * 标题存在评分 (0-15)
 */
function scoreHeadingPresence(content, headings) {
  // 检查内容是否以标题行开头
  const startsWithHeading = /^\s*#{1,6}\s+/.test(content);
  const hasHeadings = headings && headings.length > 0;

  if (startsWithHeading) return 15;
  if (hasHeadings) return 10;

  // 检查内容中是否有标题
  if (/^#{1,6}\s+/m.test(content)) return 8;

  return 0;
}

/**
 * 句子完整性评分 (0-20)
 * 检查块是否以完整句子结束
 */
function scoreSentenceCompleteness(content) {
  const trimmed = content.trim();
  if (trimmed.length === 0) return 0;

  let score = 10; // 基础分

  // 以句号/感叹号/问号结尾
  const lastChar = trimmed[trimmed.length - 1];
  if ('.!?。！？'.includes(lastChar)) {
    score += 5;
  }

  // 以代码块结尾（```）
  if (trimmed.endsWith('```')) {
    score += 5;
  }

  // 以完整标点结尾（包括引号、括号闭合）
  if (/[.!?。！？）\)」』\]】]$/.test(trimmed)) {
    score += 5;
  }

  // 不以连接词开头（and, but, however 等表示上文不完整）
  const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
  if (['and', 'but', 'however', 'therefore', 'moreover', 'furthermore', 'thus'].includes(firstWord)) {
    score -= 3;
  }

  return Math.min(20, Math.max(0, score));
}

/**
 * 原子块完整性评分 (0-20)
 * 检查是否有未闭合的表格、代码块、公式
 */
function scoreAtomicIntegrity(content) {
  let score = 20; // 满分起始

  // 检查未闭合的代码块
  const fenceMatches = content.match(/^(`{3,}|~{3,})/gm);
  if (fenceMatches && fenceMatches.length % 2 !== 0) {
    score -= 10;
  }

  // 检查未闭合的显示数学块
  const doubleDollarCount = (content.match(/\$\$/g) || []).length;
  if (doubleDollarCount % 2 !== 0) {
    score -= 10;
  }

  // 检查表格是否完整（有表头分隔行）
  const tableRows = content.match(/^\|.*\|$/gm);
  if (tableRows && tableRows.length > 0) {
    const hasSeparator = tableRows.some(row => /^\|[\s\-:|]+\|$/.test(row));
    if (!hasSeparator && tableRows.length > 1) {
      score -= 5; // 有表格行但缺少分隔行
    }
  }

  return Math.max(0, score);
}

/**
 * 内容多样性评分 (0-15)
 * 有文本+结构元素的混合得高分
 */
function scoreContentVariety(content) {
  let score = 5; // 基础分

  // 有表格
  if (/^\|.*\|$/m.test(content)) score += 2;

  // 有数学公式
  if (/\$[^$]+\$/.test(content) || /\$\$[\s\S]+?\$\$/.test(content)) score += 2;

  // 有列表
  if (/^\s*[-*+]\s+/m.test(content) || /^\s*\d+\.\s+/m.test(content)) score += 2;

  // 有代码块
  if (/^```/m.test(content)) score += 2;

  // 有普通文本段落（至少 100 字符的非结构化文本）
  const plainText = content
    .replace(/^\|.*\|$/gm, '')
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*[-*+]\s+.*/gm, '')
    .replace(/^\s*\d+\.\s+.*/gm, '')
    .replace(/^#{1,6}\s+.*/gm, '')
    .trim();

  if (plainText.length > 100) score += 2;

  return Math.min(15, score);
}

/**
 * 对所有分块计算统计信息
 * @param {Array} chunks - 分块数组（每块需有 qualityScore）
 * @param {Object} config - 配置
 * @returns {Object} - { avg, min, max, totalChunks, avgSize, minSize, maxSize }
 */
function scoreAll(chunks, config) {
  if (!chunks || chunks.length === 0) {
    return { avg: 0, min: 0, max: 0, totalChunks: 0, avgSize: 0, minSize: 0, maxSize: 0 };
  }

  const scores = chunks.map(c => c.qualityScore || scoreChunk(c, config));
  const sizes = chunks.map(c => (c.content || '').trim().length);

  return {
    totalChunks: chunks.length,
    avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    min: Math.min(...scores),
    max: Math.max(...scores),
    avgSize: Math.round(sizes.reduce((s, v) => s + v, 0) / sizes.length),
    minSize: Math.min(...sizes),
    maxSize: Math.max(...sizes)
  };
}

module.exports = {
  scoreChunk,
  scoreAll
};
