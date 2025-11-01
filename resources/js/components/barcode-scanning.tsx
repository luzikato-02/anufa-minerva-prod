"use client"

import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertCircle } from "lucide-react"

interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onScan: (barcode: string) => void
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    if (!open) return

    const startCamera = async () => {
      try {
        setScanError(null)
        setIsScanning(true)

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        setScanError("Unable to access camera. Please check permissions.")
        setIsScanning(false)
        console.error("Camera error:", err)
      }
    }

    startCamera()

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [open])

  useEffect(() => {
    if (!isScanning || !videoRef.current) return

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    const scanInterval = setInterval(() => {
      if (videoRef.current && ctx) {
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        ctx.drawImage(videoRef.current, 0, 0)

        // This is a placeholder - integrate with jsQR or similar library
        // For now, this demonstrates the flow
        console.log("[v0] Scanning frame...")
      }
    }, 500)

    return () => clearInterval(scanInterval)
  }, [isScanning])

//   const handleManualInput = () => {
//     const input = prompt("Enter batch number manually:")
//     if (input?.trim()) {
//       onScan(input.trim())
//       onClose()
//     }
//   }

  const handleClose = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
    }
    setIsScanning(false)
    setScanError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Batch Barcode</DialogTitle>
          <DialogDescription>Point your camera at the barcode to scan</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {scanError ? (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Camera Error</p>
                <p className="text-xs text-destructive/80 mt-1">{scanError}</p>
              </div>
            </div>
          ) : (
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-8 border-2 border-yellow-400 rounded-lg opacity-75" />
                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs text-yellow-400 font-medium">
                  Align barcode within frame
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} className="flex-1 h-10 bg-transparent">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
