import type { FunctionBlock, MatchedPair } from './types'

/**
 * 计算两个字符串的 Levenshtein 编辑距离
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length
  const n = s2.length

  // 创建二维数组
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  // 初始化
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  // 动态规划填表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // 删除
          dp[i][j - 1] + 1,     // 插入
          dp[i - 1][j - 1] + 1  // 替换
        )
      }
    }
  }

  return dp[m][n]
}

/**
 * 计算两个函数名的相似度 (0-1)
 * @param name1 第一个函数名
 * @param name2 第二个函数名
 * @returns 相似度值，1 表示完全相同，0 表示完全不同
 */
export function functionNameSimilarity(name1: string, name2: string): number {
  if (name1 === name2) return 1

  // 计算编辑距离
  const distance = levenshteinDistance(name1.toLowerCase(), name2.toLowerCase())
  const maxLen = Math.max(name1.length, name2.length)

  if (maxLen === 0) return 1

  // 转换为相似度
  return 1 - distance / maxLen
}

/**
 * 匹配左右两侧的函数块
 * 使用贪婪算法，优先匹配完全相同的函数名
 *
 * @param leftFunctions 左侧函数块列表（删除/旧版本）
 * @param rightFunctions 右侧函数块列表（新增/新版本）
 * @returns 匹配的函数对列表
 */
export function matchFunctions(
  leftFunctions: FunctionBlock[],
  rightFunctions: FunctionBlock[]
): MatchedPair[] {
  const pairs: MatchedPair[] = []
  const matchedLeft = new Set<number>()
  const matchedRight = new Set<number>()

  // 第一轮：精确匹配（函数名完全相同）
  for (let li = 0; li < leftFunctions.length; li++) {
    if (matchedLeft.has(li)) continue

    const leftFunc = leftFunctions[li]

    for (let ri = 0; ri < rightFunctions.length; ri++) {
      if (matchedRight.has(ri)) continue

      const rightFunc = rightFunctions[ri]

      if (leftFunc.name === rightFunc.name) {
        pairs.push({
          left: leftFunc,
          right: rightFunc,
          type: 'matched',
        })
        matchedLeft.add(li)
        matchedRight.add(ri)
        break
      }
    }
  }

  // 第二轮：模糊匹配（相似度 > 80%）
  const SIMILARITY_THRESHOLD = 0.8

  for (let li = 0; li < leftFunctions.length; li++) {
    if (matchedLeft.has(li)) continue

    const leftFunc = leftFunctions[li]
    let bestMatch = -1
    let bestSimilarity = SIMILARITY_THRESHOLD

    for (let ri = 0; ri < rightFunctions.length; ri++) {
      if (matchedRight.has(ri)) continue

      const rightFunc = rightFunctions[ri]
      const similarity = functionNameSimilarity(leftFunc.name, rightFunc.name)

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = ri
      }
    }

    if (bestMatch !== -1) {
      pairs.push({
        left: leftFunc,
        right: rightFunctions[bestMatch],
        type: 'matched',
      })
      matchedLeft.add(li)
      matchedRight.add(bestMatch)
    }
  }

  // 第三轮：处理未匹配的左侧函数（仅删除）
  for (let li = 0; li < leftFunctions.length; li++) {
    if (matchedLeft.has(li)) continue

    pairs.push({
      left: leftFunctions[li],
      right: null,
      type: 'left-only',
    })
  }

  // 第四轮：处理未匹配的右侧函数（仅新增）
  for (let ri = 0; ri < rightFunctions.length; ri++) {
    if (matchedRight.has(ri)) continue

    pairs.push({
      left: null,
      right: rightFunctions[ri],
      type: 'right-only',
    })
  }

  // 按原始位置排序，保持代码顺序
  pairs.sort((a, b) => {
    const aPos = a.left?.startIdx ?? a.right?.startIdx ?? 0
    const bPos = b.left?.startIdx ?? b.right?.startIdx ?? 0
    return aPos - bPos
  })

  return pairs
}

/**
 * 根据函数块位置排序匹配对
 * 确保输出顺序与原始代码结构一致
 */
export function sortMatchedPairs(pairs: MatchedPair[]): MatchedPair[] {
  return [...pairs].sort((a, b) => {
    // 使用左侧位置优先，右侧位置次之
    const aLeftPos = a.left?.startIdx ?? Infinity
    const aRightPos = a.right?.startIdx ?? Infinity
    const bLeftPos = b.left?.startIdx ?? Infinity
    const bRightPos = b.right?.startIdx ?? Infinity

    const aPos = Math.min(aLeftPos, aRightPos)
    const bPos = Math.min(bLeftPos, bRightPos)

    return aPos - bPos
  })
}
