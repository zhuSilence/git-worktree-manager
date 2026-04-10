import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import type { ThreeWayDiff } from '@/types/worktree'

interface ThreeWayViewProps {
  threeWayDiff: ThreeWayDiff | null
  isLoading?: boolean
  error?: string | null
  onClose?: () => void
}

/** 对齐行类型 */
type AlignmentType = 'equal' | 'base-ours' | 'base-theirs' | 'both-changed' | 'ours-only' | 'theirs-only'

interface AlignedRow {
  baseLine: string | null
  oursLine: string | null
  theirsLine: string | null
  baseLineNum: number | null
  oursLineNum: number | null
  theirsLineNum: number | null
  type: AlignmentType
}

/**
 * 计算 LCS 长度表（用于行对齐）
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }
  return dp
}

/**
 * 从 LCS 表回溯得到对齐结果
 */
function backtrackLcs(a: string[], b: string[], dp: number[][]): [Array<string | null>, Array<string | null>] {
  const tempA: Array<string | null> = []
  const tempB: Array<string | null> = []
  let i = a.length
  let j = b.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      tempA.push(a[i - 1])
      tempB.push(b[j - 1])
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempA.push(null)
      tempB.push(b[j - 1])
      j--
    } else {
      tempA.push(a[i - 1])
      tempB.push(null)
      i--
    }
  }

  const alignedA: Array<string | null> = []
  const alignedB: Array<string | null> = []
  for (let k = tempA.length - 1; k >= 0; k--) {
    alignedA.push(tempA[k])
    alignedB.push(tempB[k])
  }
  return [alignedA, alignedB]
}

/**
 * 将三组行通过 LCS 对齐
 * 策略：先将 base 与 ours 对齐，再将 base 与 theirs 对齐，
 *        然后以 base 行为锚点合并为三列对齐的行
 */
function alignThreeWay(base: string[], ours: string[], theirs: string[]): AlignedRow[] {
  const dpBaseOurs = lcsTable(base, ours)
  const [alignedBaseOurs, alignedOurs] = backtrackLcs(base, ours, dpBaseOurs)

  const dpBaseTheirs = lcsTable(base, theirs)
  const [alignedBaseTheirs, alignedTheirs] = backtrackLcs(base, theirs, dpBaseTheirs)

  // 以 base 行为锚点合并
  const oursMap = new Map<number, { alignedIdx: number; line: string | null }>()
  const theirsMap = new Map<number, { alignedIdx: number; line: string | null }>()

  let baseRowIdx = 0
  for (let i = 0; i < alignedBaseOurs.length; i++) {
    if (alignedBaseOurs[i] !== null) {
      oursMap.set(baseRowIdx, { alignedIdx: i, line: alignedOurs[i] })
      baseRowIdx++
    }
  }

  baseRowIdx = 0
  for (let i = 0; i < alignedBaseTheirs.length; i++) {
    if (alignedBaseTheirs[i] !== null) {
      theirsMap.set(baseRowIdx, { alignedIdx: i, line: alignedTheirs[i] })
      baseRowIdx++
    }
  }

  const rows: AlignedRow[] = []
  let oursSegStart = 0
  let theirsSegStart = 0
  let baseLineNum = 0
  let oursLineNum = 0
  let theirsLineNum = 0

  for (let bIdx = 0; bIdx <= base.length; bIdx++) {
    const oursEnd = bIdx < base.length && oursMap.has(bIdx) ? oursMap.get(bIdx)!.alignedIdx : alignedOurs.length
    const theirsEnd = bIdx < base.length && theirsMap.has(bIdx) ? theirsMap.get(bIdx)!.alignedIdx : alignedTheirs.length

    const oursInserts: Array<string | null> = []
    for (let i = oursSegStart; i < oursEnd; i++) {
      oursInserts.push(alignedOurs[i])
    }

    const theirsInserts: Array<string | null> = []
    for (let i = theirsSegStart; i < theirsEnd; i++) {
      theirsInserts.push(alignedTheirs[i])
    }

    const maxInserts = Math.max(oursInserts.length, theirsInserts.length)
    for (let k = 0; k < maxInserts; k++) {
      const oursLine = k < oursInserts.length ? oursInserts[k] : null
      const theirsLine = k < theirsInserts.length ? theirsInserts[k] : null

      let type: AlignmentType
      if (oursLine !== null && theirsLine !== null) {
        type = oursLine === theirsLine ? 'equal' : 'both-changed'
      } else if (oursLine !== null) {
        type = 'ours-only'
      } else {
        type = 'theirs-only'
      }

      rows.push({
        baseLine: null,
        oursLine,
        theirsLine,
        baseLineNum: null,
        oursLineNum: oursLine !== null ? ++oursLineNum : null,
        theirsLineNum: theirsLine !== null ? ++theirsLineNum : null,
        type,
      })
    }

    oursSegStart = oursEnd
    theirsSegStart = theirsEnd

    if (bIdx < base.length) {
      baseLineNum++
      const oursLine = oursMap.has(bIdx) ? oursMap.get(bIdx)!.line : null
      const theirsLine = theirsMap.has(bIdx) ? theirsMap.get(bIdx)!.line : null

      if (oursLine !== null) oursLineNum++
      if (theirsLine !== null) theirsLineNum++

      let type: AlignmentType
      if (oursLine === base[bIdx] && theirsLine === base[bIdx]) {
        type = 'equal'
      } else if (oursLine !== base[bIdx] && theirsLine !== base[bIdx]) {
        type = 'both-changed'
      } else if (oursLine !== base[bIdx]) {
        type = 'base-ours'
      } else {
        type = 'base-theirs'
      }

      rows.push({
        baseLine: base[bIdx],
        oursLine,
        theirsLine,
        baseLineNum,
        oursLineNum: oursLine !== null ? oursLineNum : null,
        theirsLineNum: theirsLine !== null ? theirsLineNum : null,
        type,
      })
    }
  }

  return rows
}

/**
 * 三方对比视图组件
 * 用于显示合并冲突场景下的 BASE / OURS / THEIRS 三个版本
 * 使用 LCS 算法进行行对齐，而非简单索引对齐
 */
export function ThreeWayView({
  threeWayDiff,
  isLoading = false,
  error = null,
  onClose,
}: ThreeWayViewProps) {
  const { t } = useTranslation()

  const alignedRows = useMemo(() => {
    if (!threeWayDiff) return []

    const base = threeWayDiff.baseContent?.split('\n') || []
    const ours = threeWayDiff.oursContent?.split('\n') || []
    const theirs = threeWayDiff.theirsContent?.split('\n') || []

    // 移除末尾空行（split('\n') 对 "abc\n" 会产生 ["abc", ""]）
    if (base.length > 0 && base[base.length - 1] === '') base.pop()
    if (ours.length > 0 && ours[ours.length - 1] === '') ours.pop()
    if (theirs.length > 0 && theirs[theirs.length - 1] === '') theirs.pop()

    return alignThreeWay(base, ours, theirs)
  }, [threeWayDiff])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        <span className="ml-2 text-sm text-gray-500">{t('merge.loadingThreeWayDiff')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
        {error}
      </div>
    )
  }

  if (!threeWayDiff) {
    return null
  }

  const getRowStyle = (type: AlignmentType, side: 'ours' | 'theirs') => {
    if (type === 'equal') return ''
    if (side === 'ours') {
      return type === 'base-ours' || type === 'both-changed' || type === 'ours-only'
        ? 'bg-blue-50 dark:bg-blue-900/20'
        : ''
    }
    return type === 'base-theirs' || type === 'both-changed' || type === 'theirs-only'
      ? 'bg-purple-50 dark:bg-purple-900/20'
      : ''
  }

  const getTextColor = (type: AlignmentType, side: 'ours' | 'theirs') => {
    if (type === 'equal') return 'text-gray-600 dark:text-gray-400'
    if (side === 'ours') {
      return type === 'base-ours' || type === 'both-changed' || type === 'ours-only'
        ? 'text-blue-700 dark:text-blue-300'
        : 'text-gray-600 dark:text-gray-400'
    }
    return type === 'base-theirs' || type === 'both-changed' || type === 'theirs-only'
      ? 'text-purple-700 dark:text-purple-300'
      : 'text-gray-600 dark:text-gray-400'
  }

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {t('merge.threeWayDiffTitle')}: {threeWayDiff.filePath}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 三列头部 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <div className="w-1/3 px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          BASE
        </div>
        <div className="w-1/3 px-2 py-1.5 text-xs font-semibold text-blue-500 dark:text-blue-400 border-r border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          OURS ({t('merge.currentBranch')})
        </div>
        <div className="w-1/3 px-2 py-1.5 text-xs font-semibold text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20">
          THEIRS ({t('merge.incomingBranch')})
        </div>
      </div>

      {/* 三列内容 */}
      <div className="flex-1 overflow-auto">
        {alignedRows.map((row, i) => (
          <div
            key={i}
            className="flex hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800"
          >
            {/* BASE 列 */}
            <div className="w-1/3 px-2 border-r border-gray-200 dark:border-gray-700 font-mono">
              <div className="flex">
                <span className="w-8 text-right pr-2 text-[10px] text-gray-400 select-none flex-shrink-0">
                  {row.baseLineNum ?? ''}
                </span>
                <span className="flex-1 text-[11px] whitespace-pre-wrap break-all leading-[20px] text-gray-600 dark:text-gray-400">
                  {row.baseLine ?? ''}
                </span>
              </div>
            </div>

            {/* OURS 列 */}
            <div className={`w-1/3 px-2 border-r border-gray-200 dark:border-gray-700 font-mono ${getRowStyle(row.type, 'ours')}`}>
              <div className="flex">
                <span className="w-8 text-right pr-2 text-[10px] text-gray-400 select-none flex-shrink-0">
                  {row.oursLineNum ?? ''}
                </span>
                <span className={`flex-1 text-[11px] whitespace-pre-wrap break-all leading-[20px] ${getTextColor(row.type, 'ours')}`}>
                  {row.oursLine ?? ''}
                </span>
              </div>
            </div>

            {/* THEIRS 列 */}
            <div className={`w-1/3 px-2 font-mono ${getRowStyle(row.type, 'theirs')}`}>
              <div className="flex">
                <span className="w-8 text-right pr-2 text-[10px] text-gray-400 select-none flex-shrink-0">
                  {row.theirsLineNum ?? ''}
                </span>
                <span className={`flex-1 text-[11px] whitespace-pre-wrap break-all leading-[20px] ${getTextColor(row.type, 'theirs')}`}>
                  {row.theirsLine ?? ''}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* 空状态 */}
        {alignedRows.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">
            {t('merge.noContentAvailable')}
          </div>
        )}
      </div>
    </div>
  )
}

export default ThreeWayView
