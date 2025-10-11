// Utility functions for localStorage operations with error handling

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

  console.log("Clearing localStorage keys:", keys)
  keys.forEach((key) => {
    removeFromLocalStorage(key)
    console.log(`Cleared: ${key}`)
  })

  console.log("All app data cleared from localStorage")
}

// Helper to restore problem timestamps (since JSON.parse doesn't handle Date objects)
export function restoreProblemsWithDates<T extends { timestamp: any }>(problems: any[]): T[] {
  if (!Array.isArray(problems)) {
    return []
  }

  return problems.map((problem) => ({
    ...problem,
    timestamp: new Date(problem.timestamp),
  })) as T[]
}
