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
  const isElectron = typeof window !== "undefined" && !!window.platform

  const handleMinimize = () => window.platform?.minimize?.()
  const handleMaximize = () => window.platform?.maximize?.()
  const handleClose = () => window.platform?.close?.()

  return (
    <div className="h-12 flex items-center justify-between px-3 bg-muted border-b drag-region select-none">
      {/* LEFT — App menu */}
      <div className="flex items-center gap-2 pl-2 drag-region">
        <span className="text-sm font-semibold mr-2">Anufa Minerva</span>

        {isElectron && (
          <Menubar className="border-none shadow-none">
            <MenubarMenu>
              <MenubarTrigger>File</MenubarTrigger>
              <MenubarContent>
                <MenubarItem onClick={() => window.electronAPI?.showServerConfig?.()}>
                  Configure Server
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={handleClose}>
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
                <MenubarItem onClick={() => window.electronAPI?.onShowSyncLog?.(() => {})}>
                  View Sync Log
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger>Help</MenubarTrigger>
              <MenubarContent>
                <MenubarItem onClick={() => window.open("https://github.com/luzikato-02/anufa-minerva/wiki")}>
                  Documentation
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        )}
      </div>

      {/* RIGHT — Window controls (Electron only) */}
      {isElectron && (
        <div className="flex items-center gap-1 pr-2 no-drag">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleMinimize}
            className="hover:bg-gray-300 dark:hover:bg-gray-700"
          >
            <Minus className="w-4 h-4" />
          </Button>

          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleMaximize}
            className="hover:bg-gray-300 dark:hover:bg-gray-700"
          >
            <Square className="w-4 h-4" />
          </Button>

          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleClose}
            className="hover:bg-red-500 hover:text-white dark:hover:bg-red-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
