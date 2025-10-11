import { databaseService, prepareTwistingDataForDatabase, prepareWeavingDataForDatabase } from "./databaseConnector"

interface SpindleData {
  max: number | null
  min: number | null
}

interface CreelData {
  [side: string]: {
    [row: string]: {
      [col: number]: SpindleData
    }
  }
}

interface TwistingFormData {
  machineNumber: string
  itemNumber: string
  metersCheck: string
  operator: string
  dtexNumber: string
  tpm: string
  specTens: string
  tensPlus: string
  rpm: string
}

interface WeavingFormData {
  machineNumber: string
  metersCheck: string
  itemNumber: string
  operator: string
  productionOrder: string
  baleNumber: string
  colorCode: string
  specTens: string
  tensPlus: string
}

interface TwistingProblem {
  id: number
  spindleNumber: number
  description: string
  timestamp: Date
}

interface WeavingProblem {
  id: number
  position: string
  description: string
  timestamp: Date
}

export async function exportWeavingDataToCSV(
  creelData: CreelData,
  formData: WeavingFormData,
  problems: WeavingProblem[],
  filename = "weaving-tension-data",
  saveToDatabase = true,
) {
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

  // Add data rows
  Object.entries(creelData).forEach(([side, rows]) => {
    Object.entries(rows).forEach(([row, columns]) => {
      Object.entries(columns).forEach(([col, data]) => {
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
      const description = `"${problem.description.replace(/"/g, '""')}"` // Escape quotes in description
      csvRows.push(`${problem.position},${description},${timestamp}`)
    })
  } else {
    csvRows.push("No problems reported")
  }

  // Create CSV content
  const csvContent = csvRows.join("\n")

  // Save to database if requested
  if (saveToDatabase) {
    try {
      const record = prepareWeavingDataForDatabase()
      const result = await databaseService.saveTensionRecord(record)

      if (result.status === "success") {
  const newId = result.data?.id
  console.log(result.status)
  console.log("✅ Twisting data saved to database with ID:", newId)
  showNotification("Data saved to database successfully!", "success")
} else {
  console.log(result.status)
  // console.error("❌ Failed to save twisting data to database:", result.message || result.error)
  // showNotification("Failed to save to database: " + (result.message || result.error), "error")
}
    } catch (error) {
      console.error("❌ Database save error:", error)
      showNotification("Database connection error", "error")
    }
  }

  // Download CSV file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${filename}-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

export async function exportTwistingDataToCSV(
  spindleData: Record<number, SpindleData>,
  formData: TwistingFormData,
  problems: TwistingProblem[],
  filename = "twisting-tension-data",
  saveToDatabase = true,
) {
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

  // Add data rows
  Object.entries(spindleData).forEach(([spindleNumber, data]) => {
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
      const description = `"${problem.description.replace(/"/g, '""')}"` // Escape quotes in description
      csvRows.push(`${problem.spindleNumber},${description},${timestamp}`)
    })
  } else {
    csvRows.push("No problems reported")
  }

  // Create CSV content
  const csvContent = csvRows.join("\n")

  // Save to database if requested
  if (saveToDatabase) {
    try {
      const record = prepareTwistingDataForDatabase()
      const result = await databaseService.saveTensionRecord(record)

      if (result.success) {
        console.log("✅ Twisting data saved to database with ID:", result.id)
        // Show success notification
        showNotification("Data saved to database successfully!", "success")
      } else {
        console.error("❌ Failed to save twisting data to database:", result.error)
        showNotification("Failed to save to database: " + result.error, "error")
      }
    } catch (error) {
      console.error("❌ Database save error:", error)
      showNotification("Database connection error", "error")
    }
  }

  // Download CSV file
  const csvContent2 = csvRows.join("\n")
  const blob = new Blob([csvContent2], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${filename}-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

// Helper function to show notifications
function showNotification(message: string, type: "success" | "error" | "info" = "info") {
  // Create a simple notification
  const notification = document.createElement("div")
  notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
    type === "success"
      ? "bg-green-500 text-white"
      : type === "error"
        ? "bg-red-500 text-white"
        : "bg-blue-500 text-white"
  }`
  notification.textContent = message

  document.body.appendChild(notification)

  // Remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification)
    }
  }, 5000)
}
