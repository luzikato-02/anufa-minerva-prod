export function saveToLocalStorage<T>(key: string, data: T): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(data))
    }
  } catch (error) {
    console.warn(`Failed to save to localStorage for key "${key}":`, error)
  }
}

export function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window !== "undefined") {
      const item = localStorage.getItem(key)
      if (item) {
        return JSON.parse(item)
      }
    }
  } catch (error) {
    console.warn(`Failed to load from localStorage for key "${key}":`, error)
  }
  return defaultValue
}

export function removeFromLocalStorage(key: string): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(key)
    }
  } catch (error) {
    console.warn(`Failed to remove from localStorage for key "${key}":`, error)
  }
}

export function clearAllAppData(): void {
  const keys = [
    "twisting-form-data",
    "weaving-form-data",
    "twisting-spindle-data",
    "weaving-creel-data",
    "twisting-problems",
    "weaving-problems",
    "twisting-numpad-state",
    "weaving-numpad-state",
  ]

  keys.forEach((key) => {
    removeFromLocalStorage(key)
  })
}

export function restoreProblemsWithDates<T extends { timestamp: any }>(problems: any[]): T[] {
  if (!Array.isArray(problems)) {
    return []
  }

  return problems.map((problem) => ({
    ...problem,
    timestamp: new Date(problem.timestamp),
  })) as T[]
}

// --- Creel merge types and utility ---

interface SpindleCell { max: number | null; min: number | null; updatedAt?: string }
type CreelGrid = Record<string, Record<string, Record<number, SpindleCell>>>

export interface MergeConflictSummary {
  localOnly: number
  serverOnly: number
  localWon: number
  serverWon: number
}

/**
 * Last-write-wins merge of two creel grids.
 * Cells missing a timestamp are treated as oldest ("0") so any timestamped
 * cell beats legacy data from either source.
 */
export function mergeCreelData(
  local: CreelGrid,
  server: CreelGrid,
): { merged: CreelGrid; conflicts: MergeConflictSummary } {
  const merged: CreelGrid = {}
  const summary: MergeConflictSummary = { localOnly: 0, serverOnly: 0, localWon: 0, serverWon: 0 }
  const sides = new Set([...Object.keys(local), ...Object.keys(server)])

  for (const side of sides) {
    merged[side] = {}
    const rows = new Set([...Object.keys(local[side] ?? {}), ...Object.keys(server[side] ?? {})])

    for (const row of rows) {
      merged[side][row] = {}
      const cols = new Set([
        ...Object.keys(local[side]?.[row] ?? {}).map(Number),
        ...Object.keys(server[side]?.[row] ?? {}).map(Number),
      ])

      for (const col of cols) {
        const lc = local[side]?.[row]?.[col]
        const sc = server[side]?.[row]?.[col]
        if (!lc) { merged[side][row][col] = sc!; summary.serverOnly++; continue }
        if (!sc) { merged[side][row][col] = lc;  summary.localOnly++;  continue }
        if ((lc.updatedAt ?? "0") >= (sc.updatedAt ?? "0")) {
          merged[side][row][col] = lc; summary.localWon++
        } else {
          merged[side][row][col] = sc; summary.serverWon++
        }
      }
    }
  }
  return { merged, conflicts: summary }
}
