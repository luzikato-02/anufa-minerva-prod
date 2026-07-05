import { useEffect, useRef, useState } from "react"
import WeavingNumpad from "./weaving-tension-numpad"
import WeavingProblems from "./weaving-tension-problems"
import WeavingParams from "./weaving-tension-params"
import WeavingSessionSelect from "./weaving-session-select"
import { saveToLocalStorage, loadFromLocalStorage, removeFromLocalStorage, restoreProblemsWithDates, mergeCreelData, type MergeConflictSummary } from "@/lib/localStorage"
import { getWeavingSession, prepareWeavingDataForDatabase, startWeavingSession, updateWeavingSession } from "@/lib/databaseConnector"

interface SpindleData {
  max: number | null
  min: number | null
  updatedAt?: string
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
  itemDescription: string
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
  const [currentView, setCurrentView] = useState<"numpad" | "problems" | "recorder" | "session-select">("session-select")
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
    itemDescription: "",
    operator: "",
    productionOrder: "",
    baleNumber: "",
    colorCode: "",
    specTens: "",
    tensPlus: "",
  })

  // Server-side session for the current production order, so measurement
  // entry can be resumed later (from this device or another one).
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionProductionOrder, setSessionProductionOrder] = useState<string | null>(null)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [mergeSummary, setMergeSummary] = useState<MergeConflictSummary | null>(null)
  const isFirstRender = useRef(true)
  const autosaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    const savedSessionId = loadFromLocalStorage<number | null>("weaving-session-id", null)
    const savedSessionProductionOrder = loadFromLocalStorage<string | null>("weaving-session-po", null)
    const savedCurrentView = loadFromLocalStorage<string>("weaving-current-view", "session-select")

    setFormData(savedFormData)
    setCreelData(savedCreelData)
    setSubmittedProblems(restoreProblemsWithDates(savedProblems))
    setDisplay(savedNumpadState.display)
    setCounter(savedNumpadState.counter)
    setValueType(savedNumpadState.valueType)
    setCreelSideIndex(savedNumpadState.creelSideIndex)
    setCreelRowIndex(savedNumpadState.creelRowIndex)
    setSessionId(savedSessionId)
    setSessionProductionOrder(savedSessionProductionOrder)

    // Restore mid-recording numpad state; otherwise always start at session-select
    if (savedCurrentView === "numpad" && savedSessionId) {
      setCurrentView("numpad")
    }
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

  // Persist the active session so a page refresh still knows which record to update
  useEffect(() => {
    saveToLocalStorage("weaving-session-id", sessionId)
    saveToLocalStorage("weaving-session-po", sessionProductionOrder)
  }, [sessionId, sessionProductionOrder])

  // Persist current view so a mid-recording refresh restores to numpad
  useEffect(() => {
    saveToLocalStorage("weaving-current-view", currentView)
  }, [currentView])

  // Autosave progress to the server session after each measurement/problem change,
  // debounced so rapid entry doesn't fire a request per keystroke.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (!sessionId) return

    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current)
    autosaveTimeout.current = setTimeout(() => {
      const record = prepareWeavingDataForDatabase()
      updateWeavingSession(sessionId, record, "in_progress").catch((error) =>
        console.warn("Weaving session autosave failed:", error),
      )
    }, 600)

    return () => {
      if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current)
    }
  }, [creelData, submittedProblems, sessionId])

  // Merge server measurement_data into current local creelData state.
  // Uses functional setState so `prev` is always the hydrated local value.
  const applyServerMerge = (serverData: any) => {
    const serverGrid = serverData && Object.keys(serverData).length > 0
      ? serverData
      : { AI: {}, BI: {}, AO: {}, BO: {} }
    setCreelData(prev => {
      const { merged, conflicts } = mergeCreelData(prev, serverGrid)
      const hasActivity = conflicts.localOnly + conflicts.serverOnly + conflicts.localWon + conflicts.serverWon > 0
      if (hasActivity) setMergeSummary(conflicts)
      return merged
    })
  }

  // Check whether an in-progress session exists for a PO without hydrating state.
  const checkSessionExists = async (po: string): Promise<boolean> => {
    try {
      const result = await getWeavingSession(po)
      return result.success && !!result.data
    } catch {
      return false
    }
  }

  // Session select: navigate to params form with PO pre-filled (new session)
  const handleSessionCreateNew = (po: string) => {
    setFormData((prev) => ({
      ...prev,
      productionOrder: po,
    }))
    setCurrentView("recorder")
  }

  // Session select: fetch existing session and pre-populate form, then go to params
  const handleSessionContinue = async (po: string): Promise<boolean> => {
    setIsStartingSession(true)
    try {
      const resumed = await getWeavingSession(po)
      if (resumed.success && resumed.data) {
        const record = resumed.data
        setSessionId(record.id)
        setSessionProductionOrder(po)
        setFormData((prev) => ({ ...prev, ...record.form_data }))
        applyServerMerge(record.measurement_data)
        setSubmittedProblems(restoreProblemsWithDates(record.problems ?? []))
        setCurrentView("recorder")
        return true
      }
      return false
    } catch (error) {
      console.warn("Could not check for existing session:", error)
      return false
    } finally {
      setIsStartingSession(false)
    }
  }

  // Called when the user submits the params form to begin/resume measurement entry.
  // Looks for an existing in-progress session for this production order on the
  // server and hydrates from it; otherwise starts a new session.
  const handleStartRecording = async () => {
    const productionOrder = formData.productionOrder.trim()

    if (!productionOrder) {
      setCurrentView("numpad")
      return
    }

    setIsStartingSession(true)
    try {
      const resumed = await getWeavingSession(productionOrder)

      if (resumed.success && resumed.data) {
        const record = resumed.data
        setSessionId(record.id)
        setSessionProductionOrder(productionOrder)
        setFormData((prev) => ({ ...prev, ...record.form_data }))
        applyServerMerge(record.measurement_data)
        setSubmittedProblems(restoreProblemsWithDates(record.problems ?? []))
      } else {
        // No resumable session for this production order. If the locally
        // cached grid belongs to a different production order, drop it so
        // it doesn't leak into the new session.
        if (sessionProductionOrder && sessionProductionOrder !== productionOrder) {
          setCreelData({ AI: {}, BI: {}, AO: {}, BO: {} })
          setSubmittedProblems([])
        }

        const started = await startWeavingSession(formData)
        setSessionId(started.success ? started.data?.id ?? null : null)
        setSessionProductionOrder(started.success ? productionOrder : null)
      }
    } catch (error) {
      console.warn("Could not reach server to start/resume weaving session; continuing offline", error)
      setSessionId(null)
      setSessionProductionOrder(null)
    } finally {
      setIsStartingSession(false)
      setCurrentView("numpad")
    }
  }

  // Handle data clearing after finish
  const handleDataCleared = () => {
    // Reset all state to initial values
    setFormData({
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
    setSessionId(null)
    setSessionProductionOrder(null)
    removeFromLocalStorage("weaving-session-id")
    removeFromLocalStorage("weaving-session-po")

    setCurrentView("session-select")
    console.log("All weaving data cleared and reset to initial state - returned to session select")
  }

  const conflictBanner = mergeSummary && (
    <div className="fixed top-4 inset-x-0 flex justify-center z-50 px-4 pointer-events-none">
      <div className="pointer-events-auto max-w-sm w-full bg-amber-50 border border-amber-300 rounded-lg shadow-md p-3 flex items-start gap-2">
        <span className="text-amber-600 mt-0.5 shrink-0">⚠</span>
        <div className="flex-1 text-sm text-amber-800">
          <strong>Session merged.</strong>{" "}
          {mergeSummary.localWon > 0 && <span>Local newer: {mergeSummary.localWon} pos. </span>}
          {mergeSummary.serverWon > 0 && <span>Server newer: {mergeSummary.serverWon} pos. </span>}
          {mergeSummary.localOnly > 0 && <span>Local-only synced: {mergeSummary.localOnly} pos. </span>}
          {mergeSummary.serverOnly > 0 && <span>Server-only synced: {mergeSummary.serverOnly} pos.</span>}
        </div>
        <button
          onClick={() => setMergeSummary(null)}
          className="text-amber-600 hover:text-amber-900 shrink-0 leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  )

  if (currentView === "problems") {
    return (
      <>
        {conflictBanner}
        <WeavingProblems
          onBack={() => setCurrentView("numpad")}
          position={currentPosition}
          submittedProblems={submittedProblems}
          setSubmittedProblems={setSubmittedProblems}
        />
      </>
    )
  }

  if (currentView === "session-select") {
    return (
      <>
        {conflictBanner}
        <WeavingSessionSelect
          initialPo={sessionProductionOrder ?? ""}
          isChecking={isStartingSession}
          onCreateNew={handleSessionCreateNew}
          onContinue={handleSessionContinue}
          onCheckExists={checkSessionExists}
        />
      </>
    )
  }

  if (currentView === "recorder") {
    return (
      <>
        {conflictBanner}
        <WeavingParams
          formData={formData}
          setFormData={setFormData}
          onStartRecording={handleStartRecording}
          onExitSession={() => setCurrentView("session-select")}
          isStarting={isStartingSession}
        />
      </>
    )
  }

  return (
    <>
      {conflictBanner}
      <WeavingNumpad
        sessionId={sessionId}
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
    </>
  )
}
