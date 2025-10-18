import { loadFromLocalStorage, restoreProblemsWithDates } from "../utils/localStorage"
// Database record interface
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
  }
}

// Laravel API response interfaces
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

// Database service class for Laravel backend
export class LaravelDatabaseService {
  private baseUrl: string

  constructor() {
    // Configure this to point to your Laravel API
    this.baseUrl = window.location.origin;
  }

  // Get headers with authentication
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
    }
    return headers
  }

  // Save tension record to Laravel backend
async saveTensionRecord(recordData: any): Promise<{ success: boolean; id?: number; message?: string; data?: any; error?: string }> {
  try {
    // Step 1: Ensure CSRF cookie is set
    await fetch(`${this.baseUrl}/csrf-token`, { credentials: "include" })

    // Step 2: Extract token from cookie
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
    const csrfToken = match ? decodeURIComponent(match[1]) : ""

    console.log("🔍 Cookies:", document.cookie)
    console.log("🧩 Extracted CSRF token:", csrfToken)

    // Step 3: POST with CSRF header
    const response = await fetch(`${this.baseUrl}/tension-records`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "X-XSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify(recordData),
      credentials: "include",
    })

    console.log("Response status:", response.status)

    const resultText = await response.text()
    console.log("Response body:", resultText)

    // Try parsing JSON
    let result: any
    try {
      result = JSON.parse(resultText)
    } catch {
      result = { message: resultText }
    }

    // If not ok, return error object
    if (!response.ok) {
      return {
        success: false,
        message: result.message || `HTTP ${response.status}`,
        error: result.error || resultText,
      }
    }

    // Normalize Laravel’s response shape
    return {
      success: result.status === "success" || result.success === true,
      id: result.id || result.data?.id,
      message: result.message,
      data: result.data,
    }
  } catch (err: any) {
    console.error("Save failed:", err)
    return {
      success: false,
      error: err.message || "Unknown error",
    }
  }
}

  // Get all tension records from Laravel backend
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

      // Handle Laravel pagination response
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

      // Handle simple array response
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

  // Get single tension record by ID
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

  // Delete tension record
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

  // Update tension record
  async updateTensionRecord(id: string, record: Partial<TensionRecord>): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/tension-records/${id}`, {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify(record),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || `HTTP error! status: ${response.status}`)
      }

      return { success: true }
    } catch (error) {
      console.error("Failed to update tension record:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}

// Create singleton instance
export const databaseService = new LaravelDatabaseService()

// Helper function to prepare twisting data for Laravel database storage
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
  })
  const problems = loadFromLocalStorage("twisting-problems", [])
  const restoredProblems = restoreProblemsWithDates(problems)

  // Generate CSV data
  const csvData = generateTwistingCSV(spindleData, formData, restoredProblems)

  // Calculate statistics
  const entries = Object.entries(spindleData)
  const totalMeasurements = entries.length
  const completedMeasurements = entries.filter(
    ([_, data]: [string, any]) => data.max !== null && data.min !== null,
  ).length
  const progressPercentage = totalMeasurements > 0 ? Math.round((completedMeasurements / 84) * 100) : 0

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
    },
  }
}

// Helper function to prepare weaving data for Laravel database storage
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
    operator: "",
    productionOrder: "",
    baleNumber: "",
    colorCode: "",
    specTens: "",
    tensPlus: "",
  })
  const problems = loadFromLocalStorage("weaving-problems", [])
  const restoredProblems = restoreProblemsWithDates(problems)

  // Generate CSV data
  const csvData = generateWeavingCSV(creelData, formData, restoredProblems)

  // Calculate statistics
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

  const maxPositions = 4 * 5 * 120 // 4 sides * 5 rows * 120 columns
  const progressPercentage = maxPositions > 0 ? Math.round((completedMeasurements / maxPositions) * 100) : 0

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
    },
  }
}

// Helper function to generate CSV for twisting data
function generateTwistingCSV(spindleData: any, formData: any, problems: any[]): string {
  const csvRows: string[] = []

  // Add title and timestamp
  csvRows.push("TWISTING TENSION DATA EXPORT")
  csvRows.push(`Export Date: ${new Date().toLocaleString()}`)
  csvRows.push("")

  // Section 1: Configuration Parameters
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
  csvRows.push("")

  // Section 2: Tension Measurement Data
  csvRows.push("=== TENSION MEASUREMENT DATA ===")
  csvRows.push("Spindle Number,Max Value,Min Value")

  Object.entries(spindleData).forEach(([spindleNumber, data]: [string, any]) => {
    const maxValue = data.max !== null ? data.max : ""
    const minValue = data.min !== null ? data.min : ""
    csvRows.push(`${spindleNumber},${maxValue},${minValue}`)
  })

  csvRows.push("")

  // Section 3: Problem Reports
  csvRows.push("=== PROBLEM REPORTS ===")
  csvRows.push("Spindle Number,Description,Timestamp")

  if (problems.length > 0) {
    problems.forEach((problem) => {
      const timestamp = problem.timestamp.toLocaleString()
      const description = `"${problem.description.replace(/"/g, '""')}"` // Escape quotes
      csvRows.push(`${problem.spindleNumber},${description},${timestamp}`)
    })
  } else {
    csvRows.push("No problems reported")
  }

  return csvRows.join("\n")
}

// Helper function to generate CSV for weaving data
function generateWeavingCSV(creelData: any, formData: any, problems: any[]): string {
  const csvRows: string[] = []

  // Add title and timestamp
  csvRows.push("WEAVING TENSION DATA EXPORT")
  csvRows.push(`Export Date: ${new Date().toLocaleString()}`)
  csvRows.push("")

  // Section 1: Configuration Parameters
  csvRows.push("=== CONFIGURATION PARAMETERS ===")
  csvRows.push("Parameter,Value")
  csvRows.push(`Item Number,${formData.itemNumber}`)
  csvRows.push(`Production Order,${formData.productionOrder}`)
  csvRows.push(`Meters Check,${formData.metersCheck}`)
  csvRows.push(`Bale Number,${formData.baleNumber}`)
  csvRows.push(`Color Code,${formData.colorCode}`)
  csvRows.push(`Spec Tens,${formData.specTens}`)
  csvRows.push(`Tens ±,${formData.tensPlus}`)
  csvRows.push(`Machine Number,${formData.machineNumber}`)
  csvRows.push(`Operator,${formData.operator}`)
  csvRows.push("")

  // Section 2: Tension Measurement Data
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

  // Section 3: Problem Reports
  csvRows.push("=== PROBLEM REPORTS ===")
  csvRows.push("Position,Description,Timestamp")

  if (problems.length > 0) {
    problems.forEach((problem) => {
      const timestamp = problem.timestamp.toLocaleString()
      const description = `"${problem.description.replace(/"/g, '""')}"` // Escape quotes
      csvRows.push(`${problem.position},${description},${timestamp}`)
    })
  } else {
    csvRows.push("No problems reported")
  }

  return csvRows.join("\n")
}
