import AppTitleBar from '@/components/app-title-bar';

export default function AppWindowShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <div className="shrink-0">
        <AppTitleBar />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
