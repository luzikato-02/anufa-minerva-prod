"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { clearAllAppData } from "./utils/localStorage"

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

export default function WeavingParams({
  formData,
  setFormData,
  onStartRecording,
}: {
  formData: TensionData
  setFormData: (value: TensionData | ((prev: TensionData) => TensionData)) => void
  onStartRecording?: () => void
}) {
  const handleInputChange = (field: keyof TensionData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const startRecording = () => {
    console.log("Started recording with data:", formData)
    onStartRecording?.()
  }

  const clearData = () => {
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
    console.log("Data cleared")
  }

  const clearAllData = () => {
    if (
      confirm(
        "Are you sure you want to clear all saved data? This will remove all forms, measurements, and problem reports.",
      )
    ) {
      clearAllAppData()
      clearData()
      console.log("All app data cleared from localStorage")
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-2">
      <Card className="w-full max-w-xs mx-auto shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-center">Weaving Tension Recorder</CardTitle>
          <p className="text-xs text-muted-foreground text-center">Configure recording parameters</p>
          <Separator className="mt-3" />
        </CardHeader>

        <CardContent className="space-y-1">
          {/* Form Fields */}
          <div className="space-y-1">
            <div>
              <Label htmlFor="itemNumber" className="text-xs font-medium text-foreground">
                Item Number
              </Label>
              <Input
                id="itemNumber"
                type="text"
                value={formData.itemNumber}
                onChange={(e) => handleInputChange("itemNumber", e.target.value)}
                className="h-7 text-sm"
              />
            </div>

            {/* Production Order and Meters Check side by side */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="productionOrder" className="text-xs font-medium text-foreground">
                  Production Order
                </Label>
                <Input
                  id="productionOrder"
                  type="text"
                  value={formData.productionOrder}
                  onChange={(e) => handleInputChange("productionOrder", e.target.value)}
                  className="h-7 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="metersCheck" className="text-xs font-medium text-foreground">
                  Meters Check
                </Label>
                <Input
                  id="metersCheck"
                  type="text"
                  value={formData.metersCheck}
                  onChange={(e) => handleInputChange("metersCheck", e.target.value)}
                  className="h-7 text-sm"
                />
              </div>
            </div>

            {/* Bale Number and Color Code side by side */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="baleNumber" className="text-xs font-medium text-foreground">
                  Bale Number
                </Label>
                <Input
                  id="baleNumber"
                  type="text"
                  value={formData.baleNumber}
                  onChange={(e) => handleInputChange("baleNumber", e.target.value)}
                  className="h-7 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="colorCode" className="text-xs font-medium text-foreground">
                  Color Code
                </Label>
                <Input
                  id="colorCode"
                  type="text"
                  value={formData.colorCode}
                  onChange={(e) => handleInputChange("colorCode", e.target.value)}
                  className="h-7 text-sm"
                />
              </div>
            </div>

            {/* Spec Tens and Tens ± side by side */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="specTens" className="text-xs font-medium text-foreground">
                  Spec Tens
                </Label>
                <Input
                  id="specTens"
                  type="text"
                  value={formData.specTens}
                  onChange={(e) => handleInputChange("specTens", e.target.value)}
                  className="h-7 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="tensPlus" className="text-xs font-medium text-foreground">
                  Tens ±
                </Label>
                <Input
                  id="tensPlus"
                  type="text"
                  value={formData.tensPlus}
                  onChange={(e) => handleInputChange("tensPlus", e.target.value)}
                  className="h-7 text-sm"
                />
              </div>
            </div>

            {/* Machine Number and Operator side by side */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="machineNumber" className="text-xs font-medium text-foreground">
                  Machine Number
                </Label>
                <Input
                  id="machineNumber"
                  type="text"
                  value={formData.machineNumber}
                  onChange={(e) => handleInputChange("machineNumber", e.target.value)}
                  className="h-7 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="operator" className="text-xs font-medium text-foreground">
                  Operator
                </Label>
                <Input
                  id="operator"
                  type="text"
                  value={formData.operator}
                  onChange={(e) => handleInputChange("operator", e.target.value)}
                  className="h-7 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Separator before buttons */}
          <div className="py-2">
            <Separator />
          </div>

          {/* Action Buttons */}
          <div className="space-y-1">
            <Button size="sm" className="w-full h-10 text-sm font-medium" onClick={startRecording}>
              Start Recording
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-sm font-medium bg-transparent"
                onClick={clearData}
              >
                Clear Form
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-xs font-medium hover:bg-destructive hover:text-destructive-foreground bg-transparent"
                onClick={clearAllData}
              >
                Clear All Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
