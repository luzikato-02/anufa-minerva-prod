import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
    DatabaseIcon,
    HomeIcon,
    FileTextIcon,
    ClipboardListIcon,
    CalendarClockIcon,
    RefreshCwIcon,
    MoonIcon,
    SunIcon,
    MonitorIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppearance } from '@/hooks/use-appearance';

interface ElectronAppLayoutProps {
    children: React.ReactNode;
}

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
    { href: '/tension-records', label: 'Tension Records', icon: FileTextIcon },
    { href: '/stock-take-records', label: 'Stock Take Records', icon: ClipboardListIcon },
    { href: '/finish-earlier-records', label: 'Finish Earlier', icon: CalendarClockIcon },
    { href: '/database-sync', label: 'Database Sync', icon: DatabaseIcon },
];

export default function ElectronAppLayout({ children }: ElectronAppLayoutProps) {
    const location = useLocation();
    const { appearance, updateAppearance } = useAppearance();
    const [syncStatus, setSyncStatus] = useState<{
        pendingUploads: number;
        conflicts: number;
        isSyncing: boolean;
    }>({ pendingUploads: 0, conflicts: 0, isSyncing: false });

    // Check if running in Electron
    const isElectron = typeof window !== 'undefined' && (window as Window & { isElectron?: boolean }).isElectron;

    useEffect(() => {
        if (isElectron) {
            const electronWindow = window as Window & { 
                electronAPI?: {
                    sync: {
                        getStatus: () => Promise<{ pendingUploads: number; conflicts: number; isSyncing: boolean }>;
                        onProgress: (callback: (progress: { phase: string }) => void) => (() => void) | undefined;
                    };
                };
            };
            
            // Get initial sync status
            const fetchStatus = async () => {
                try {
                    const status = await electronWindow.electronAPI?.sync.getStatus();
                    if (status) {
                        setSyncStatus({
                            pendingUploads: status.pendingUploads,
                            conflicts: status.conflicts,
                            isSyncing: status.isSyncing,
                        });
                    }
                } catch (error) {
                    console.error('Failed to fetch sync status:', error);
                }
            };
            fetchStatus();

            // Subscribe to sync progress
            const unsubscribe = electronWindow.electronAPI?.sync.onProgress((progress) => {
                if (progress.phase === 'complete') {
                    fetchStatus();
                }
            });

            return () => {
                unsubscribe?.();
            };
        }
    }, [isElectron]);

    const cycleAppearance = () => {
        const modes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
        const currentIndex = modes.indexOf(appearance);
        const nextIndex = (currentIndex + 1) % modes.length;
        updateAppearance(modes[nextIndex]);
    };

    const AppearanceIcon = appearance === 'dark' ? MoonIcon : appearance === 'light' ? SunIcon : MonitorIcon;

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-card flex flex-col">
                {/* Logo/Header */}
                <div className="p-4 border-b">
                    <h1 className="text-xl font-bold text-primary">Manufacturing App</h1>
                    <p className="text-xs text-muted-foreground mt-1">Desktop Edition</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        const showBadge = item.href === '/database-sync' && (syncStatus.pendingUploads > 0 || syncStatus.conflicts > 0);

                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative',
                                    isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                                {showBadge && (
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                                        {syncStatus.pendingUploads + syncStatus.conflicts}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t space-y-3">
                    {/* Sync Status */}
                    {isElectron && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                                {syncStatus.isSyncing ? (
                                    <span className="flex items-center gap-1">
                                        <RefreshCwIcon className="h-3 w-3 animate-spin" />
                                        Syncing...
                                    </span>
                                ) : syncStatus.pendingUploads > 0 ? (
                                    `${syncStatus.pendingUploads} pending`
                                ) : (
                                    'All synced'
                                )}
                            </span>
                            {syncStatus.conflicts > 0 && (
                                <span className="text-destructive">{syncStatus.conflicts} conflicts</span>
                            )}
                        </div>
                    )}

                    {/* Theme Toggle */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={cycleAppearance}
                    >
                        <AppearanceIcon className="h-4 w-4" />
                        {appearance.charAt(0).toUpperCase() + appearance.slice(1)} Mode
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="p-6">{children}</div>
            </main>
        </div>
    );
}
