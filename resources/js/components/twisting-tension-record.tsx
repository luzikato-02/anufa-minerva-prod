"use client"

import { useState, useEffect } from "react"
import TwistingNumpad from "@/components/twisting-tension-numpad"
import TwistingProblemReport from "@/components/twisting-tension-problems"
import TwistingParams from "@/components/twisting-tension-params"
import { saveToLocalStorage, loadFromLocalStorage, restoreProblemsWithDates } from "@/components/utils/localStorage"

interface SpindleData {
  max: number | null
  min: number | null
}

interface TensionData {
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

interface SubmittedProblem {
  id: number
  spindleNumber: number
  description: string
  timestamp: Date
}

interface NumpadState {
  display: string
  counter: number
  valueType: string
}

export default function TwistingTensionPage() {
  // Lifted all numpad state to preserve during navigation
  const [display, setDisplay] = useState("0")
  const [counter, setCounter] = useState(1) // Current spindle number
  const [valueType, setValueType] = useState("Max") // Max or Min

  // Lifted spindleData state to preserve stored values during navigation
  const [spindleData, setSpindleData] = useState<Record<number, SpindleData>>({})

  // Lifted form data state to preserve parameter form data during navigation
  const [formData, setFormData] = useState<TensionData>({
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

  // Lifted problems state to preserve problems list during navigation
  const [submittedProblems, setSubmittedProblems] = useState<SubmittedProblem[]>([])

  const [currentView, setCurrentView] = useState<"numpad" | "problems" | "recorder">("recorder")
  const [currentSpindleNumber, setCurrentSpindleNumber] = useState(1)

  // Load data from localStorage on mount
  useEffect(() => {
    const savedFormData = loadFromLocalStorage("twisting-form-data", formData)
    const savedSpindleData = loadFromLocalStorage("twisting-spindle-data", spindleData)
    const savedProblems = loadFromLocalStorage("twisting-problems", [])
    const savedNumpadState = loadFromLocalStorage("twisting-numpad-state", {
      display: "0",
      counter: 1,
      valueType: "Max",
    })

    setFormData(savedFormData)
    setSpindleData(savedSpindleData)
    setSubmittedProblems(restoreProblemsWithDates(savedProblems))
    setDisplay(savedNumpadState.display)
    setCounter(savedNumpadState.counter)
    setValueType(savedNumpadState.valueType)
  }, [])

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    saveToLocalStorage("twisting-form-data", formData)
  }, [formData])

  // Save spindle data to localStorage whenever it changes
  useEffect(() => {
    saveToLocalStorage("twisting-spindle-data", spindleData)
  }, [spindleData])

  // Save problems to localStorage whenever they change
  useEffect(() => {
    saveToLocalStorage("twisting-problems", submittedProblems)
  }, [submittedProblems])

  // Save numpad state to localStorage whenever it changes
  useEffect(() => {
    const numpadState: NumpadState = { display, counter, valueType }
    saveToLocalStorage("twisting-numpad-state", numpadState)
  }, [display, counter, valueType])

  // Handle data clearing after finish
  const handleDataCleared = () => {
    // Reset all state to initial values
    setFormData({
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
    setSpindleData({})
    setSubmittedProblems([])
    setDisplay("0")
    setCounter(1)
    setValueType("Max")

    // Force navigate back to params form for fresh start
    setCurrentView("recorder")

    console.log("All twisting data cleared and reset to initial state - returned to params form")
  }

  if (currentView === "problems") {
    return (
      <TwistingProblemReport
        onBack={() => setCurrentView("numpad")}
        spindleNumber={currentSpindleNumber}
        submittedProblems={submittedProblems}
        setSubmittedProblems={setSubmittedProblems}
      />
    )
  }

  if (currentView === "recorder") {
    return (
      <TwistingParams
        formData={formData}
        setFormData={setFormData}
        onStartRecording={() => setCurrentView("numpad")}
      />
    )
  }

  return (
    <TwistingNumpad
      display={display}
      setDisplay={setDisplay}
      counter={counter}
      setCounter={setCounter}
      valueType={valueType}
      setValueType={setValueType}
      spindleData={spindleData}
      setSpindleData={setSpindleData}
      formData={formData}
      problems={submittedProblems}
      onReportProblem={(spindleNumber) => {
        setCurrentSpindleNumber(spindleNumber)
        setCurrentView("problems")
      }}
      onOpenRecorder={() => setCurrentView("recorder")}
      onDataCleared={handleDataCleared}
    />
  )
}
