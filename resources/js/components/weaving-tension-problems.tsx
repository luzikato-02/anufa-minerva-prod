"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Delete, ArrowLeft, X } from "lucide-react"

interface ProblemReport {
  id: number
  position: string
  description: string
  timestamp: Date
}

export default function WeavingProblems({
  onBack,
  position,
  submittedProblems,
  setSubmittedProblems,
}: {
  onBack?: () => void
  position: string
  submittedProblems: ProblemReport[]
  setSubmittedProblems: (value: ProblemReport[] | ((prev: ProblemReport[]) => ProblemReport[])) => void
}) {
  const [currentProblem, setCurrentProblem] = useState("")
  const [selectedProblemIndex, setSelectedProblemIndex] = useState<number | null>(null)

  const submitProblem = () => {
    if (currentProblem.trim()) {
      const newProblem: ProblemReport = {
        id: Date.now(),
        position: position,
        description: currentProblem.trim(),
        timestamp: new Date(),
      }
      setSubmittedProblems([...submittedProblems, newProblem])
      setCurrentProblem("")
      setSelectedProblemIndex(null)
      console.log("Problem submitted for", position, ":", currentProblem)
    }
  }

  const deleteProblem = (index: number) => {
    const newProblems = submittedProblems.filter((_, i) => i !== index)
    setSubmittedProblems(newProblems)
    setSelectedProblemIndex(null)
    console.log("Problem deleted at index:", index)
  }

  const deleteSelectedProblem = () => {
    if (selectedProblemIndex !== null) {
      deleteProblem(selectedProblemIndex)
    }
  }

  const clearCurrentText = () => {
    setCurrentProblem("")
    console.log("Current problem text cleared")
  }

  const goBack = () => {
    console.log("Back button clicked")
    onBack?.()
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-2">
      <Card className="w-full max-w-xs mx-auto shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-center">Problem Reports</CardTitle>
          <div className="text-sm text-center text-muted-foreground">Reporting for {position}</div>

          {/* Display Area for Submitted Problems */}
          <div className="bg-muted/50 rounded-lg p-3 min-h-[100px] max-h-[150px] overflow-y-auto">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              All Problems: {selectedProblemIndex !== null && "(Select to delete)"}
            </div>
            {submittedProblems.length > 0 ? (
              <div className="space-y-1">
                {submittedProblems.map((problem, index) => (
                  <div
                    key={problem.id}
                    className={`text-xs text-foreground bg-background/50 rounded p-2 border flex items-start justify-between gap-1 cursor-pointer transition-colors ${
                      selectedProblemIndex === index ? "border-destructive bg-destructive/10" : "hover:bg-background/70"
                    }`}
                    onClick={() => setSelectedProblemIndex(selectedProblemIndex === index ? null : index)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs font-semibold text-blue-600">{problem.position}</span>
                      </div>
                      <span className="text-xs">{problem.description}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteProblem(index)
                      }}
                    >
                      <X className="w-2 h-2" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic">No problems reported yet</div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Text Form */}
          <div className="space-y-2">
            <label htmlFor="problem-description" className="text-xs font-medium text-foreground">
              Describe the problem for {position}:
            </label>
            <Textarea
              id="problem-description"
              placeholder={`Enter problem description for ${position}...`}
              value={currentProblem}
              onChange={(e) => setCurrentProblem(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
              maxLength={500}
            />
            <div className="text-xs text-muted-foreground text-right">{currentProblem.length}/500</div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {/* Submit Button */}
            <Button
              size="sm"
              className="w-full h-10 text-sm font-medium bg-primary hover:bg-primary/90"
              onClick={submitProblem}
              disabled={!currentProblem.trim()}
            >
              Submit Problem for {position}
            </Button>

            {/* Delete and Back Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-sm font-medium hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={selectedProblemIndex !== null ? deleteSelectedProblem : clearCurrentText}
                disabled={selectedProblemIndex === null && !currentProblem}
              >
                <Delete className="w-3 h-3 mr-1" />
                {selectedProblemIndex !== null ? "Del Selected" : "Clear"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                onClick={goBack}
              >
                <ArrowLeft className="w-3 h-3 mr-1" />
                Back
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
