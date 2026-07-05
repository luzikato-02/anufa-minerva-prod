import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, Loader2, Plus, Search } from "lucide-react"

export default function WeavingSessionSelect({
  initialPo,
  isChecking,
  onCreateNew,
  onContinue,
}: {
  initialPo: string
  isChecking: boolean
  onCreateNew: (po: string) => void
  onContinue: (po: string) => Promise<boolean>
}) {
  const [po, setPo] = useState(initialPo)
  const [error, setError] = useState<string | null>(null)

  const handleCreateNew = () => {
    setError(null)
    if (!po.trim()) {
      setError("Please enter a production order number")
      return
    }
    onCreateNew(po.trim())
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
              disabled={isChecking}
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
            disabled={isChecking || !po.trim()}
            className="h-10 w-full text-sm font-medium"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Session
          </Button>

          {/* Continue Session Button */}
          <Button
            variant="outline"
            onClick={handleContinue}
            disabled={isChecking || !po.trim()}
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
    </div>
  )
}
