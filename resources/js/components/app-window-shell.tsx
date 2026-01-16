import AppTitleBar from '@/components/app-title-bar';

export default function AppWindowShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Electron Title Bar (only if running in Electron) */}
      {typeof window !== 'undefined' && window.platform && (
        <div className="shrink-0 h-12 z-50">
          <AppTitleBar />
        </div>
      )}
      
      {/* Content Area - grows to fill remaining space */}
      <div className="flex-1 min-h-0 overflow-hidden w-full">
        {children}
      </div>
    </div>
  );
}
