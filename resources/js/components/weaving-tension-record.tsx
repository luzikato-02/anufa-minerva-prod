import { useState, useEffect } from "react"
import WeavingNumpad from "./weaving-tension-numpad"
import WeavingProblems from "./weaving-tension-problems"
import WeavingParams from "./weaving-tension-params"
import { saveToLocalStorage, loadFromLocalStorage, restoreProblemsWithDates } from "./utils/localStorage"

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

interface ProblemReport {
  id: number
  position: string
  description: string
  timestamp: Date
}

interface TensionData {
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

interface NumpadState {
  display: string
  counter: number
  valueType: string
  creelSideIndex: number
  creelRowIndex: number
}

export default function WeavingTensionPage() {
  const [currentView, setCurrentView] = useState<"numpad" | "problems" | "recorder">("recorder")
  const [currentPosition, setCurrentPosition] = useState("AI-A-Col1")

  // Lifted all numpad state to preserve during navigation
  const [display, setDisplay] = useState("0")
  const [counter, setCounter] = useState(1) // Current column number
  const [valueType, setValueType] = useState("Max") // Max or Min
  const [creelSideIndex, setCreelSideIndex] = useState(0) // Index for creel side options
  const [creelRowIndex, setCreelRowIndex] = useState(0) // Index for creel row options

  // Lifted creelData state to preserve stored values during navigation
  const [creelData, setCreelData] = useState<CreelData>({
    AI: {},
    BI: {},
    AO: {},
    BO: {},
  })

  // Lifted problems state to preserve problems list during navigation
  const [submittedProblems, setSubmittedProblems] = useState<ProblemReport[]>([])

  // Lifted form data state to preserve parameter form data during navigation
  const [formData, setFormData] = useState<TensionData>({
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

  // Load data from localStorage on mount
  useEffect(() => {
    const savedFormData = loadFromLocalStorage("weaving-form-data", formData)
    const savedCreelData = loadFromLocalStorage("weaving-creel-data", creelData)
    const savedProblems = loadFromLocalStorage("weaving-problems", [])
    const savedNumpadState = loadFromLocalStorage("weaving-numpad-state", {
      display: "0",
      counter: 1,
      valueType: "Max",
      creelSideIndex: 0,
      creelRowIndex: 0,
    })

    setFormData(savedFormData)
    setCreelData(savedCreelData)
    setSubmittedProblems(restoreProblemsWithDates(savedProblems))
    setDisplay(savedNumpadState.display)
    setCounter(savedNumpadState.counter)
    setValueType(savedNumpadState.valueType)
    setCreelSideIndex(savedNumpadState.creelSideIndex)
    setCreelRowIndex(savedNumpadState.creelRowIndex)
  }, [])

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    saveToLocalStorage("weaving-form-data", formData)
  }, [formData])

  // Save creel data to localStorage whenever it changes
  useEffect(() => {
    saveToLocalStorage("weaving-creel-data", creelData)
  }, [creelData])

  // Save problems to localStorage whenever they change
  useEffect(() => {
    saveToLocalStorage("weaving-problems", submittedProblems)
  }, [submittedProblems])

  // Save numpad state to localStorage whenever it changes
  useEffect(() => {
    const numpadState: NumpadState = {
      display,
      counter,
      valueType,
      creelSideIndex,
      creelRowIndex,
    }
    saveToLocalStorage("weaving-numpad-state", numpadState)
  }, [display, counter, valueType, creelSideIndex, creelRowIndex])

  // Handle data clearing after finish
  const handleDataCleared = () => {
    // Reset all state to initial values
    setFormData({
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
    setCreelData({
      AI: {},
      BI: {},
      AO: {},
      BO: {},
    })
    setSubmittedProblems([])
    setDisplay("0")
    setCounter(1)
    setValueType("Max")
    setCreelSideIndex(0)
    setCreelRowIndex(0)

    // Force navigate back to params form for fresh start
    setCurrentView("recorder")

    console.log("All weaving data cleared and reset to initial state - returned to params form")
  }

  if (currentView === "problems") {
    return (
      <WeavingProblems
        onBack={() => setCurrentView("numpad")}
        position={currentPosition}
        submittedProblems={submittedProblems}
        setSubmittedProblems={setSubmittedProblems}
      />
    )
  }

  if (currentView === "recorder") {
    return (
      <WeavingParams formData={formData} setFormData={setFormData} onStartRecording={() => setCurrentView("numpad")} />
    )
  }

  return (
    <WeavingNumpad
      display={display}
      setDisplay={setDisplay}
      counter={counter}
      setCounter={setCounter}
      valueType={valueType}
      setValueType={setValueType}
      creelSideIndex={creelSideIndex}
      setCreelSideIndex={setCreelSideIndex}
      creelRowIndex={creelRowIndex}
      setCreelRowIndex={setCreelRowIndex}
      creelData={creelData}
      setCreelData={setCreelData}
      formData={formData}
      problems={submittedProblems}
      onReportProblem={(position) => {
        setCurrentPosition(position)
        setCurrentView("problems")
      }}
      onOpenRecorder={() => setCurrentView("recorder")}
      onDataCleared={handleDataCleared}
    />
  )
}
