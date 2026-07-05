import { loadFromLocalStorage, restoreProblemsWithDates } from "./localStorage"

interface TensionRecord {
  id?: string
  record_type: "twisting" | "weaving"
  timestamp: string
  csv_data: string
  form_data: any
  measurement_data: any
  problems: any[]
  metadata: {
    total_measurements: number
    completed_measurements: number
    progress_percentage: number
    operator: string
    machine_number: string
    item_number: string
    item_description?: string
    yarn_code?: string
  }
}

interface LaravelResponse<T> {
  data: T
  message?: string
  status: string
}

interface LaravelPaginatedResponse<T> {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface StockTakeBatch {
  batch_number: string
  material_code: string
  material_description: string
}

export interface RecordedBatch extends StockTakeBatch {
  actual_weight: number
  total_bobbins: number
  line_position: number | null
  row_position: string
  timestamp_found: string
  user_found: string
  explanation: string
  recorded_at: string
}

interface StockTakeSessionResponse {
  success: boolean
  message?: string
}

interface StockTakeBatchCheckResponse {
  exists: boolean
  already_recorded?: boolean
  batch_data?: Record<string, any>
  message?: string
}

export interface RecordStockBatchPayload {
  session_id: string
  batch_number: string
  material_code: string
  material_description: string
  actual_weight: number
  total_bobbins: number
  line_position: number
  row_position: string
  explanation: string
  found_by: string
  found_at: string
}

interface RecordStockBatchResponse {
  success: boolean
  message?: string
  data?: RecordedBatch
  errors?: Record<string, string[]>
}

export class LaravelDatabaseService {
  private baseUrl: string

  constructor() {
    this.baseUrl = window.location.origin;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
    }
    return headers
  }

  async saveTensionRecord(recordData: any): Promise<{ success: boolean; id?: number; message?: string; data?: any; error?: string }> {
    try {
      await fetch(`${this.baseUrl}/csrf-token`, { credentials: "include" })

      const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
      const csrfToken = match ? decodeURIComponent(match[1]) : ""

      const response = await fetch(`${this.baseUrl}/tension-records`, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          "X-XSRF-TOKEN": csrfToken,
        },
        body: JSON.stringify(recordData),
        credentials: "include",
      })

      const resultText = await response.text()

      let result: any
      try {
        result = JSON.parse(resultText)
      } catch {
        result = { message: resultText }
      }

      if (!response.ok) {
        return {
          success: false,
          message: result.message || `HTTP ${response.status}`,
          error: result.error || resultText,
        }
      }

      return {
        success: result.status === "success" || result.success === true,
        id: result.id || result.data?.id,
        message: result.message,
        data: result.data,
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Unknown error",
      }
    }
  }

  async getTensionRecords(
    recordType?: "twisting" | "weaving",
    page = 1,
  ): Promise<{
    records: TensionRecord[]
    pagination?: {
      current_page: number
      last_page: number
      per_page: number
      total: number
    }
  }> {
    try {
      const params = new URLSearchParams()
      if (recordType) params.append("type", recordType)
      params.append("page", page.toString())

      const url = `${this.baseUrl}/tension-records?${params.toString()}`
      const response = await fetch(url, {
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.data && Array.isArray(result.data)) {
        return {
          records: result.data.map((record: any) => ({
            ...record,
            timestamp: record.timestamp || record.created_at,
          })),
          pagination: {
            current_page: result.current_page,
            last_page: result.last_page,
            per_page: result.per_page,
            total: result.total,
          },
        }
      }

      const records = Array.isArray(result) ? result : result.data || []
      return {
        records: records.map((record: any) => ({
          ...record,
          timestamp: record.timestamp || record.created_at,
        })),
      }
    } catch (error) {
      console.error("Failed to fetch tension records:", error)
      return { records: [] }
    }
  }

  async getTensionRecord(id: string): Promise<TensionRecord | null> {
    try {
      const response = await fetch(`${this.baseUrl}/tension-records/${id}`, {
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      const record = result.data || result

      return {
        ...record,
        timestamp: record.timestamp || record.created_at,
      }
    } catch (error) {
      console.error("Failed to fetch tension record:", error)
      return null
    }
  }

  async deleteTensionRecord(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/tension-records/${id}`, {
        method: "DELETE",
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      return { success: true }
    } catch (error) {
      console.error("Failed to delete tension record:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}

export const databaseService = new LaravelDatabaseService()

export async function getStockTakeSession(sessionId: string): Promise<StockTakeSessionResponse> {
  const response = await fetch(
    `/stock-take-records/session/${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  )

  if (!response.ok) {
    throw new Error("Failed to fetch session")
  }

  return response.json()
}

export async function checkStockBatch(sessionId: string, batchNumber: string): Promise<StockTakeBatchCheckResponse> {
  const params = new URLSearchParams({
    record_key: sessionId,
    batch: batchNumber,
  })

  const response = await fetch(`/stock-take-records/check-batch?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error("Failed to check batch")
  }

  return response.json()
}

export async function recordStockBatch(payload: RecordStockBatchPayload): Promise<RecordStockBatchResponse> {
  const tokenRes = await fetch("/csrf-token", { credentials: "include" })
  const { csrfToken } = await tokenRes.json()

  const response = await fetch("/stock-take-records/record-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error("Failed to record batch")
  }

  return response.json()
}

export async function startWeavingSession(
  formData: any,
): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    await fetch(`${window.location.origin}/csrf-token`, { credentials: "include" })
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
    const csrfToken = match ? decodeURIComponent(match[1]) : ""

    const response = await fetch("/tension-records/start-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-XSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({ form_data: formData }),
      credentials: "include",
    })

    const result = await response.json()
    if (!response.ok) {
      return { success: false, message: result.message || `HTTP ${response.status}` }
    }
    return { success: true, data: result.data }
  } catch (error) {
    console.warn("Failed to start weaving session:", error)
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function getWeavingSession(
  productionOrder: string,
): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    const response = await fetch(`/tension-records/session/${encodeURIComponent(productionOrder)}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
    })

    if (response.status === 404) {
      return { success: false }
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const result = await response.json()
    return { success: true, data: result.data }
  } catch (error) {
    console.warn("Failed to fetch weaving session:", error)
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function updateWeavingSession(
  id: number,
  record: any,
  status: "in_progress" | "completed" = "in_progress",
): Promise<{ success: boolean; id?: number; data?: any; message?: string; error?: string }> {
  try {
    await fetch(`${window.location.origin}/csrf-token`, { credentials: "include" })
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
    const csrfToken = match ? decodeURIComponent(match[1]) : ""

    const response = await fetch(`/tension-records/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-XSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({
        ...record,
        metadata: { ...record.metadata, status },
      }),
      credentials: "include",
    })

    const result = await response.json()
    if (!response.ok) {
      return { success: false, message: result.message || `HTTP ${response.status}`, error: result.error }
    }
    return { success: true, id: result.data?.id, data: result.data, message: result.message }
  } catch (error) {
    console.warn("Failed to update weaving session:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export function prepareTwistingDataForDatabase(): TensionRecord {
  const spindleData = loadFromLocalStorage("twisting-spindle-data", {})
  const formData = loadFromLocalStorage("twisting-form-data", {
    machineNumber: "",
    itemNumber: "",
    metersCheck: "",
    operator: "",
    dtexNumber: "",
    tpm: "",
    specTens: "",
    tensPlus: "",
    rpm: "",
    yarnCode: "",
  })
  const problems = loadFromLocalStorage("twisting-problems", [])
  const restoredProblems = restoreProblemsWithDates(problems)

  const csvData = generateTwistingCSV(spindleData, formData, restoredProblems)

  const entries = Object.entries(spindleData)
  const totalMeasurements = entries.length
  const completedMeasurements = entries.filter(
    ([_, data]: [string, any]) => data.max !== null && data.min !== null,
  ).length
  const progressPercentage = totalMeasurements > 0 ? Math.round((completedMeasurements / totalMeasurements) * 100) : 0

  return {
    record_type: "twisting",
    timestamp: new Date().toISOString(),
    csv_data: csvData,
    form_data: formData,
    measurement_data: spindleData,
    problems: restoredProblems,
    metadata: {
      total_measurements: totalMeasurements,
      completed_measurements: completedMeasurements,
      progress_percentage: progressPercentage,
      operator: formData.operator,
      machine_number: formData.machineNumber,
      item_number: formData.itemNumber,
      yarn_code: formData.yarnCode,
    },
  }
}

export function prepareWeavingDataForDatabase(): TensionRecord {
  const creelData = loadFromLocalStorage("weaving-creel-data", {
    AI: {},
    BI: {},
    AO: {},
    BO: {},
  })
  const formData = loadFromLocalStorage("weaving-form-data", {
    machineNumber: "",
    metersCheck: "",
    itemNumber: "",
    itemDescription: "",
    operator: "",
    productionOrder: "",
    baleNumber: "",
    colorCode: "",
    specTens: "",
    tensPlus: "",
  })
  const problems = loadFromLocalStorage("weaving-problems", [])
  const restoredProblems = restoreProblemsWithDates(problems)

  const csvData = generateWeavingCSV(creelData, formData, restoredProblems)

  let totalMeasurements = 0
  let completedMeasurements = 0

  Object.values(creelData).forEach((sides: any) => {
    Object.values(sides).forEach((rows: any) => {
      Object.values(rows).forEach((data: any) => {
        totalMeasurements++
        if (data.max !== null && data.min !== null) {
          completedMeasurements++
        }
      })
    })
  })

  const progressPercentage = totalMeasurements > 0 ? Math.round((completedMeasurements / totalMeasurements) * 100) : 0

  return {
    record_type: "weaving",
    timestamp: new Date().toISOString(),
    csv_data: csvData,
    form_data: formData,
    measurement_data: creelData,
    problems: restoredProblems,
    metadata: {
      total_measurements: totalMeasurements,
      completed_measurements: completedMeasurements,
      progress_percentage: progressPercentage,
      operator: formData.operator,
      machine_number: formData.machineNumber,
      item_number: formData.itemNumber,
      item_description: formData.itemDescription,
    },
  }
}

function countMeasurementLeaves(node: any): number {
  if (!node || typeof node !== "object") return 0
  if ("max" in node && "min" in node) return 1
  return Object.values(node).reduce((sum: number, child) => sum + countMeasurementLeaves(child), 0)
}

export function verifyPersistedRecord(
  sent: TensionRecord,
  fetched: TensionRecord | null,
): { ok: boolean; reason?: string } {
  if (!fetched) {
    return { ok: false, reason: "Could not retrieve the saved record from the database for verification." }
  }

  const sentMeasurements = countMeasurementLeaves(sent.measurement_data)
  const fetchedMeasurements = countMeasurementLeaves(fetched.measurement_data)
  if (sentMeasurements !== fetchedMeasurements) {
    return {
      ok: false,
      reason: `Measurement count mismatch: sent ${sentMeasurements}, saved ${fetchedMeasurements}.`,
    }
  }

  const sentProblems = sent.problems?.length ?? 0
  const fetchedProblems = fetched.problems?.length ?? 0
  if (sentProblems !== fetchedProblems) {
    return {
      ok: false,
      reason: `Problem count mismatch: sent ${sentProblems}, saved ${fetchedProblems}.`,
    }
  }

  if (sent.metadata.completed_measurements !== fetched.metadata?.completed_measurements) {
    return {
      ok: false,
      reason: `Completed measurements mismatch: sent ${sent.metadata.completed_measurements}, saved ${fetched.metadata?.completed_measurements}.`,
    }
  }

  return { ok: true }
}

function generateTwistingCSV(spindleData: any, formData: any, problems: any[]): string {
  const csvRows: string[] = []

  csvRows.push("TWISTING TENSION DATA EXPORT")
  csvRows.push(`Export Date: ${new Date().toLocaleString()}`)
  csvRows.push("")
  csvRows.push("=== CONFIGURATION PARAMETERS ===")
  csvRows.push("Parameter,Value")
  csvRows.push(`Operator,${formData.operator}`)
  csvRows.push(`Item Number,${formData.itemNumber}`)
  csvRows.push(`Meters Check,${formData.metersCheck}`)
  csvRows.push(`Dtex Number,${formData.dtexNumber}`)
  csvRows.push(`TPM,${formData.tpm}`)
  csvRows.push(`Spec Tens,${formData.specTens}`)
  csvRows.push(`Tens ±,${formData.tensPlus}`)
  csvRows.push(`RPM,${formData.rpm}`)
  csvRows.push(`Machine Number,${formData.machineNumber}`)
  csvRows.push(`Yarn Code,${formData.yarnCode}`)
  csvRows.push("")
  csvRows.push("=== TENSION MEASUREMENT DATA ===")
  csvRows.push("Spindle Number,Max Value,Min Value")

  Object.entries(spindleData).forEach(([spindleNumber, data]: [string, any]) => {
    const maxValue = data.max !== null ? data.max : ""
    const minValue = data.min !== null ? data.min : ""
    csvRows.push(`${spindleNumber},${maxValue},${minValue}`)
  })

  csvRows.push("")
  csvRows.push("=== PROBLEM REPORTS ===")
  csvRows.push("Spindle Number,Description,Timestamp")

  if (problems.length > 0) {
    problems.forEach((problem) => {
      const timestamp = problem.timestamp.toLocaleString()
      const description = `"${problem.description.replace(/"/g, '""')}"`
      csvRows.push(`${problem.spindleNumber},${description},${timestamp}`)
    })
  } else {
    csvRows.push("No problems reported")
  }

  return csvRows.join("\n")
}

function generateWeavingCSV(creelData: any, formData: any, problems: any[]): string {
  const csvRows: string[] = []

  csvRows.push("WEAVING TENSION DATA EXPORT")
  csvRows.push(`Export Date: ${new Date().toLocaleString()}`)
  csvRows.push("")
  csvRows.push("=== CONFIGURATION PARAMETERS ===")
  csvRows.push("Parameter,Value")
  csvRows.push(`Item Number,${formData.itemNumber}`)
  csvRows.push(`Item Description,${formData.itemDescription}`)
  csvRows.push(`Production Order,${formData.productionOrder}`)
  csvRows.push(`Meters Check,${formData.metersCheck}`)
  csvRows.push(`Bale Number,${formData.baleNumber}`)
  csvRows.push(`Color Code,${formData.colorCode}`)
  csvRows.push(`Spec Tens,${formData.specTens}`)
  csvRows.push(`Tens ±,${formData.tensPlus}`)
  csvRows.push(`Machine Number,${formData.machineNumber}`)
  csvRows.push(`Operator,${formData.operator}`)
  csvRows.push("")
  csvRows.push("=== TENSION MEASUREMENT DATA ===")
  csvRows.push("Position,Creel Side,Row,Column,Max Value,Min Value")

  Object.entries(creelData).forEach(([side, rows]: [string, any]) => {
    Object.entries(rows).forEach(([row, columns]: [string, any]) => {
      Object.entries(columns).forEach(([col, data]: [string, any]) => {
        const position = `${side}-${row}-Col${col}`
        const maxValue = data.max !== null ? data.max : ""
        const minValue = data.min !== null ? data.min : ""
        csvRows.push(`${position},${side},${row},${col},${maxValue},${minValue}`)
      })
    })
  })

  csvRows.push("")
  csvRows.push("=== PROBLEM REPORTS ===")
  csvRows.push("Position,Description,Timestamp")

  if (problems.length > 0) {
    problems.forEach((problem) => {
      const timestamp = problem.timestamp.toLocaleString()
      const description = `"${problem.description.replace(/"/g, '""')}"`
      csvRows.push(`${problem.position},${description},${timestamp}`)
    })
  } else {
    csvRows.push("No problems reported")
  }

  return csvRows.join("\n")
}
