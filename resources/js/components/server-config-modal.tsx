import { useEffect, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  open: boolean
  onClose: () => void
}

export default function ServerConfigModal({ open, onClose }: Props) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && window.electronAPI) {
      window.electronAPI.getServerUrl().then((saved) => {
        if (saved) setUrl(saved)
      })
    }
  }, [open])

  const save = async () => {
    if (!url.trim()) return

    setLoading(true)
    await window.electronAPI?.setServerUrl(url.trim())
    setLoading(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Server</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="server-url">Server URL</Label>
          <Input
            id="server-url"
            autoFocus
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            onClick={save}
            disabled={loading || !url.trim()}
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
