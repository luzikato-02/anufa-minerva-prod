import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertCircle, Loader2, Plus, Search } from "lucide-react"

export default function WeavingSessionSelect({
  initialPo,
  isChecking,
  onCreateNew,
  onContinue,
  onCheckExists,
}: {
  initialPo: string
  isChecking: boolean
  onCreateNew: (po: string) => void
  onContinue: (po: string) => Promise<boolean>
  onCheckExists: (po: string) => Promise<boolean>
}) {
  const [po, setPo] = useState(initialPo)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingNew, setIsCheckingNew] = useState(false)
  const [existingSessionPo, setExistingSessionPo] = useState<string | null>(null)

  const handleCreateNew = async () => {
    setError(null)
    const trimmed = po.trim()
    if (!trimmed) {
      setError("Please enter a production order number")
      return
    }
    setIsCheckingNew(true)
    try {
      const exists = await onCheckExists(trimmed)
      if (exists) {
        setExistingSessionPo(trimmed)
      } else {
        onCreateNew(trimmed)
      }
    } finally {
      setIsCheckingNew(false)
    }
  }

  const handleContinue = async () => {
    setError(null)
    if (!po.trim()) {
      setError("Please enter a production order number")
      return
    }
    const found = await onContinue(po.trim())
    if (!found) setError("No active session found for this production order.")
  }

  const busy = isChecking || isCheckingNew

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-2">
      <Card className="mx-auto w-full max-w-sm shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-center text-lg font-semibold">
            Session Selection
          </CardTitle>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Enter your production order to start or continue a session
          </p>
          <Separator className="mt-3" />
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Production Order Input */}
          <div className="space-y-2">
            <Label htmlFor="production-order" className="text-sm font-medium text-foreground">
              Production Order
            </Label>
            <Input
              id="production-order"
              type="text"
              placeholder="Enter production order..."
              value={po}
              onChange={(e) => {
                setPo(e.target.value)
                setError(null)
              }}
              disabled={busy}
              className="h-10 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              e.g., WO-2024-001, PO-12345, etc.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Create New Session Button */}
          <Button
            onClick={handleCreateNew}
            disabled={busy || !po.trim()}
            className="h-10 w-full text-sm font-medium"
          >
            {isCheckingNew ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create New Session
              </>
            )}
          </Button>

          {/* Continue Session Button */}
          <Button
            variant="outline"
            onClick={handleContinue}
            disabled={busy || !po.trim()}
            className="h-10 w-full text-sm font-medium"
          >
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Continue Session
              </>
            )}
          </Button>

          {/* Info Section */}
          <div className="pt-2">
            <Separator />
            <div className="mt-3 rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Instructions:</strong> Enter your production order number
                to create a new recording session or continue a previous one.
                Your previous measurements will be automatically loaded when
                continuing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing session detected during "Create New" — must continue it */}
      <AlertDialog open={!!existingSessionPo} onOpenChange={(open) => { if (!open) setExistingSessionPo(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Session already exists</AlertDialogTitle>
            <AlertDialogDescription>
              An in-progress session for <strong>{existingSessionPo}</strong> already exists.
              You must continue it or use a different production order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setExistingSessionPo(null)}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                const currentPo = existingSessionPo
                setExistingSessionPo(null)
                if (currentPo) onContinue(currentPo)
              }}
            >
              Continue Session
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
