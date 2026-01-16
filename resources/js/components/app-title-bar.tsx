import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from "@/components/ui/menubar"

import { Minus, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AppTitleBar() {
  const isElectron = !!window.windowAPI

  return (
    <div className="h-10 flex items-center justify-between px-3 bg-muted border-b drag-region select-none">
      {/* LEFT — App menu */}
      <div className="flex items-center gap-2 pl-2 drag-region">
        <span className="text-sm font-semibold mr-2">Anufa Minerva</span>

        <Menubar className="border-none shadow-none">
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => window.electronAPI?.getServerUrl()}>
                Configure Server
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => window.close()}>
                Quit
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>Data</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => window.electronAPI?.onTriggerSync?.(() => {})}>
                Sync Now
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>Help</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => window.open("https://github.com/your-repo/wiki")}>
                Documentation
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>

      {/* RIGHT — Window controls */}
      <div className="flex items-center gap-1 pr-2 no-drag">
        <Button size="icon" variant="ghost" onClick={() => window.windowAPI?.minimize()}>
          <Minus className="w-4 h-4" />
        </Button>

        <Button size="icon" variant="ghost" onClick={() => window.windowAPI?.maximize()}>
          <Square className="w-4 h-4" />
        </Button>

        <Button size="icon" variant="ghost" onClick={() => window.windowAPI?.close()}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
