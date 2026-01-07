import { useState, useEffect, useCallback } from 'react';
import {
    RefreshCwIcon,
    CheckCircle2Icon,
    XCircleIcon,
    AlertTriangleIcon,
    CloudIcon,
    DatabaseIcon,
    UploadCloudIcon,
    DownloadCloudIcon,
    SettingsIcon,
    HistoryIcon,
    AlertCircleIcon,
    Loader2Icon,
    ServerIcon,
    HardDriveIcon,
    WifiIcon,
    WifiOffIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface SyncStatus {
    isConnected: boolean;
    lastSyncTime: string | null;
    pendingUploads: number;
    pendingDownloads: number;
    conflicts: number;
    isSyncing: boolean;
}

interface SyncSettings {
    serverUrl: string;
    authToken: string;
    autoSync: boolean;
    syncIntervalMinutes: number;
    syncOnStartup: boolean;
    syncTensionRecords: boolean;
    syncStockTakeRecords: boolean;
    syncFinishEarlierRecords: boolean;
}

interface SyncProgress {
    phase: string;
    current: number;
    total: number;
    message: string;
}

interface SyncHistoryEntry {
    id: number;
    syncType: string;
    status: 'success' | 'partial' | 'failed';
    uploaded: number;
    downloaded: number;
    conflicts: number;
    errors: string[];
    startedAt: string;
    completedAt: string;
}

interface SyncConflict {
    id: string;
    tableName: string;
    recordId: number;
    localData: unknown;
    remoteData: unknown;
    createdAt: string;
}

interface DatabaseInfo {
    path: string;
    size: number;
    tables: { name: string; count: number }[];
    lastModified: string;
}

interface SyncResult {
    success: boolean;
    uploaded: number;
    downloaded: number;
    conflicts: number;
    errors: string[];
}

// ElectronAPI type for type safety
interface ElectronAPI {
    sync: {
        getStatus: () => Promise<SyncStatus>;
        getSettings: () => Promise<SyncSettings>;
        updateSettings: (settings: Partial<SyncSettings>) => Promise<{ success: boolean; error?: string }>;
        testConnection: (serverUrl: string, token: string) => Promise<{ success: boolean; error?: string }>;
        syncAll: () => Promise<SyncResult>;
        pullFromRemote: () => Promise<SyncResult>;
        pushToRemote: () => Promise<SyncResult>;
        resolveConflict: (conflictId: string, resolution: 'local' | 'remote') => Promise<{ success: boolean; error?: string }>;
        getConflicts: () => Promise<SyncConflict[]>;
        getSyncHistory: (limit?: number) => Promise<SyncHistoryEntry[]>;
        onProgress: (callback: (progress: SyncProgress) => void) => (() => void) | undefined;
    };
    database: {
        getInfo: () => Promise<DatabaseInfo>;
    };
}

export default function DatabaseSyncPage() {
    // Check if running in Electron
    const isElectron = typeof window !== 'undefined' && (window as Window & { isElectron?: boolean }).isElectron;
    const electronAPI = isElectron ? (window as Window & { electronAPI?: ElectronAPI }).electronAPI ?? null : null;

    const [status, setStatus] = useState<SyncStatus>({
        isConnected: false,
        lastSyncTime: null,
        pendingUploads: 0,
        pendingDownloads: 0,
        conflicts: 0,
        isSyncing: false,
    });
    const [settings, setSettings] = useState<SyncSettings>({
        serverUrl: '',
        authToken: '',
        autoSync: false,
        syncIntervalMinutes: 30,
        syncOnStartup: true,
        syncTensionRecords: true,
        syncStockTakeRecords: true,
        syncFinishEarlierRecords: true,
    });
    const [progress, setProgress] = useState<SyncProgress | null>(null);
    const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
    const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
    const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);
    const [showSettingsSaved, setShowSettingsSaved] = useState(false);

    // Load initial data
    const loadData = useCallback(async () => {
        if (!electronAPI) return;

        try {
            const [statusData, settingsData, historyData, conflictsData, dbInfoData] = await Promise.all([
                electronAPI.sync.getStatus(),
                electronAPI.sync.getSettings(),
                electronAPI.sync.getSyncHistory(20),
                electronAPI.sync.getConflicts(),
                electronAPI.database.getInfo(),
            ]);

            setStatus(statusData);
            setSettings(settingsData);
            setHistory(historyData);
            setConflicts(conflictsData);
            setDbInfo(dbInfoData);
        } catch (error) {
            console.error('Failed to load sync data:', error);
        } finally {
            setLoading(false);
        }
    }, [electronAPI]);

    useEffect(() => {
        loadData();

        // Subscribe to sync progress updates
        if (electronAPI) {
            const unsubscribe = electronAPI.sync.onProgress((progressData: SyncProgress) => {
                setProgress(progressData);
                if (progressData.phase === 'complete') {
                    loadData();
                    setTimeout(() => setProgress(null), 2000);
                }
            });

            return () => {
                unsubscribe?.();
            };
        }
    }, [electronAPI, loadData]);

    const handleSyncAll = async () => {
        if (!electronAPI) return;
        setProgress({ phase: 'starting', current: 0, total: 100, message: 'Starting sync...' });
        await electronAPI.sync.syncAll();
    };

    const handlePull = async () => {
        if (!electronAPI) return;
        setProgress({ phase: 'starting', current: 0, total: 100, message: 'Downloading from server...' });
        await electronAPI.sync.pullFromRemote();
    };

    const handlePush = async () => {
        if (!electronAPI) return;
        setProgress({ phase: 'starting', current: 0, total: 100, message: 'Uploading to server...' });
        await electronAPI.sync.pushToRemote();
    };

    const handleTestConnection = async () => {
        if (!electronAPI) return;
        setTestingConnection(true);
        setConnectionTestResult(null);

        try {
            const result = await electronAPI.sync.testConnection(settings.serverUrl, settings.authToken);
            setConnectionTestResult(result);
        } catch (error) {
            setConnectionTestResult({ success: false, error: (error as Error).message });
        } finally {
            setTestingConnection(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!electronAPI) return;

        try {
            await electronAPI.sync.updateSettings(settings);
            setShowSettingsSaved(true);
            setTimeout(() => setShowSettingsSaved(false), 3000);
            loadData();
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    };

    const handleResolveConflict = async (conflictId: string, resolution: 'local' | 'remote') => {
        if (!electronAPI) return;

        try {
            await electronAPI.sync.resolveConflict(conflictId, resolution);
            setSelectedConflict(null);
            loadData();
        } catch (error) {
            console.error('Failed to resolve conflict:', error);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString();
    };

    // Show message if not in Electron
    if (!isElectron) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircleIcon className="h-5 w-5 text-muted-foreground" />
                            Desktop App Only
                        </CardTitle>
                        <CardDescription>
                            Database synchronization is only available in the desktop application.
                            Please use the Electron desktop app to access this feature.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Database Synchronization</h1>
                    <p className="text-muted-foreground">
                        Manage your local database and sync with the remote server
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {status.isConnected ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <WifiIcon className="h-3 w-3 mr-1" />
                            Connected
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <WifiOffIcon className="h-3 w-3 mr-1" />
                            Disconnected
                        </Badge>
                    )}
                </div>
            </div>

            {/* Sync Progress */}
            {progress && (
                <Card className="border-primary">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-4">
                            <RefreshCwIcon className="h-5 w-5 animate-spin text-primary" />
                            <div className="flex-1">
                                <p className="font-medium">{progress.message}</p>
                                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {progress.current} / {progress.total}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                                <UploadCloudIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{status.pendingUploads}</p>
                                <p className="text-sm text-muted-foreground">Pending Uploads</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                                <DownloadCloudIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{status.pendingDownloads}</p>
                                <p className="text-sm text-muted-foreground">Pending Downloads</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "p-2 rounded-lg",
                                status.conflicts > 0 ? "bg-amber-100 dark:bg-amber-900" : "bg-gray-100 dark:bg-gray-800"
                            )}>
                                <AlertTriangleIcon className={cn(
                                    "h-5 w-5",
                                    status.conflicts > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-400"
                                )} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{status.conflicts}</p>
                                <p className="text-sm text-muted-foreground">Conflicts</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                                <HistoryIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium truncate">
                                    {formatDate(status.lastSyncTime)}
                                </p>
                                <p className="text-sm text-muted-foreground">Last Sync</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CloudIcon className="h-5 w-5" />
                        Sync Actions
                    </CardTitle>
                    <CardDescription>
                        Synchronize your local database with the remote server
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={handleSyncAll}
                            disabled={status.isSyncing || !status.isConnected}
                            className="gap-2"
                        >
                            <RefreshCwIcon className={cn("h-4 w-4", status.isSyncing && "animate-spin")} />
                            Sync All
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handlePull}
                            disabled={status.isSyncing || !status.isConnected}
                            className="gap-2"
                        >
                            <DownloadCloudIcon className="h-4 w-4" />
                            Pull from Server
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handlePush}
                            disabled={status.isSyncing || !status.isConnected}
                            className="gap-2"
                        >
                            <UploadCloudIcon className="h-4 w-4" />
                            Push to Server
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="settings" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="settings" className="gap-2">
                        <SettingsIcon className="h-4 w-4" />
                        Settings
                    </TabsTrigger>
                    <TabsTrigger value="database" className="gap-2">
                        <DatabaseIcon className="h-4 w-4" />
                        Database
                    </TabsTrigger>
                    <TabsTrigger value="conflicts" className="gap-2">
                        <AlertTriangleIcon className="h-4 w-4" />
                        Conflicts
                        {conflicts.length > 0 && (
                            <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 justify-center">
                                {conflicts.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <HistoryIcon className="h-4 w-4" />
                        History
                    </TabsTrigger>
                </TabsList>

                {/* Settings Tab */}
                <TabsContent value="settings">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sync Settings</CardTitle>
                            <CardDescription>
                                Configure your connection to the remote server
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Server Connection */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium flex items-center gap-2">
                                    <ServerIcon className="h-4 w-4" />
                                    Server Connection
                                </h3>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="serverUrl">Server URL</Label>
                                        <Input
                                            id="serverUrl"
                                            placeholder="https://your-server.com"
                                            value={settings.serverUrl}
                                            onChange={(e) => setSettings({ ...settings, serverUrl: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="authToken">API Token</Label>
                                        <Input
                                            id="authToken"
                                            type="password"
                                            placeholder="Your API token"
                                            value={settings.authToken}
                                            onChange={(e) => setSettings({ ...settings, authToken: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleTestConnection}
                                        disabled={testingConnection || !settings.serverUrl || !settings.authToken}
                                        className="gap-2"
                                    >
                                        {testingConnection ? (
                                            <Loader2Icon className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <WifiIcon className="h-4 w-4" />
                                        )}
                                        Test Connection
                                    </Button>
                                    {connectionTestResult && (
                                        <span className={cn(
                                            "text-sm flex items-center gap-1",
                                            connectionTestResult.success ? "text-green-600" : "text-red-600"
                                        )}>
                                            {connectionTestResult.success ? (
                                                <>
                                                    <CheckCircle2Icon className="h-4 w-4" />
                                                    Connection successful
                                                </>
                                            ) : (
                                                <>
                                                    <XCircleIcon className="h-4 w-4" />
                                                    {connectionTestResult.error || 'Connection failed'}
                                                </>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Sync Options */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium flex items-center gap-2">
                                    <RefreshCwIcon className="h-4 w-4" />
                                    Sync Options
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="autoSync"
                                            checked={settings.autoSync}
                                            onCheckedChange={(checked) =>
                                                setSettings({ ...settings, autoSync: !!checked })
                                            }
                                        />
                                        <Label htmlFor="autoSync">Enable automatic sync</Label>
                                    </div>
                                    {settings.autoSync && (
                                        <div className="ml-6 flex items-center gap-2">
                                            <Label htmlFor="syncInterval" className="text-sm">Sync every</Label>
                                            <Select
                                                value={settings.syncIntervalMinutes.toString()}
                                                onValueChange={(value) =>
                                                    setSettings({ ...settings, syncIntervalMinutes: parseInt(value) })
                                                }
                                            >
                                                <SelectTrigger id="syncInterval" className="w-32">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="5">5 minutes</SelectItem>
                                                    <SelectItem value="15">15 minutes</SelectItem>
                                                    <SelectItem value="30">30 minutes</SelectItem>
                                                    <SelectItem value="60">1 hour</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="syncOnStartup"
                                            checked={settings.syncOnStartup}
                                            onCheckedChange={(checked) =>
                                                setSettings({ ...settings, syncOnStartup: !!checked })
                                            }
                                        />
                                        <Label htmlFor="syncOnStartup">Sync on app startup</Label>
                                    </div>
                                </div>
                            </div>

                            {/* Data Types */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium flex items-center gap-2">
                                    <DatabaseIcon className="h-4 w-4" />
                                    Data Types to Sync
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="syncTension"
                                            checked={settings.syncTensionRecords}
                                            onCheckedChange={(checked) =>
                                                setSettings({ ...settings, syncTensionRecords: !!checked })
                                            }
                                        />
                                        <Label htmlFor="syncTension">Tension Records</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="syncStockTake"
                                            checked={settings.syncStockTakeRecords}
                                            onCheckedChange={(checked) =>
                                                setSettings({ ...settings, syncStockTakeRecords: !!checked })
                                            }
                                        />
                                        <Label htmlFor="syncStockTake">Stock Take Records</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="syncFinishEarlier"
                                            checked={settings.syncFinishEarlierRecords}
                                            onCheckedChange={(checked) =>
                                                setSettings({ ...settings, syncFinishEarlierRecords: !!checked })
                                            }
                                        />
                                        <Label htmlFor="syncFinishEarlier">Finish Earlier Records</Label>
                                    </div>
                                </div>
                            </div>

                            {/* Save Button */}
                            <div className="flex items-center gap-3">
                                <Button onClick={handleSaveSettings}>Save Settings</Button>
                                {showSettingsSaved && (
                                    <span className="text-sm text-green-600 flex items-center gap-1">
                                        <CheckCircle2Icon className="h-4 w-4" />
                                        Settings saved
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Database Tab */}
                <TabsContent value="database">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HardDriveIcon className="h-5 w-5" />
                                Local Database
                            </CardTitle>
                            <CardDescription>
                                Information about your local SQLite database
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {dbInfo && (
                                <div className="space-y-6">
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="p-4 rounded-lg bg-muted">
                                            <p className="text-sm text-muted-foreground">Database Size</p>
                                            <p className="text-lg font-semibold">{formatBytes(dbInfo.size)}</p>
                                        </div>
                                        <div className="p-4 rounded-lg bg-muted">
                                            <p className="text-sm text-muted-foreground">Last Modified</p>
                                            <p className="text-lg font-semibold">{formatDate(dbInfo.lastModified)}</p>
                                        </div>
                                        <div className="p-4 rounded-lg bg-muted">
                                            <p className="text-sm text-muted-foreground">Location</p>
                                            <p className="text-xs font-mono truncate" title={dbInfo.path}>
                                                {dbInfo.path}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-medium mb-3">Record Counts</h4>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            {dbInfo.tables.map((table) => (
                                                <div
                                                    key={table.name}
                                                    className="flex items-center justify-between p-3 rounded-lg border"
                                                >
                                                    <span className="text-sm capitalize">
                                                        {table.name.replace(/_/g, ' ')}
                                                    </span>
                                                    <Badge variant="secondary">{table.count}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Conflicts Tab */}
                <TabsContent value="conflicts">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangleIcon className="h-5 w-5" />
                                Sync Conflicts
                            </CardTitle>
                            <CardDescription>
                                Resolve data conflicts between local and remote databases
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {conflicts.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <CheckCircle2Icon className="h-12 w-12 mx-auto mb-3 text-green-500" />
                                    <p>No conflicts to resolve</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {conflicts.map((conflict) => (
                                        <div
                                            key={conflict.id}
                                            className="flex items-center justify-between p-4 rounded-lg border bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {conflict.tableName.replace(/_/g, ' ')} #{conflict.recordId}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Conflict detected: {formatDate(conflict.createdAt)}
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedConflict(conflict)}
                                            >
                                                Resolve
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HistoryIcon className="h-5 w-5" />
                                Sync History
                            </CardTitle>
                            <CardDescription>
                                Recent synchronization activities
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {history.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <HistoryIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>No sync history yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {history.map((entry) => (
                                        <div
                                            key={entry.id}
                                            className="flex items-center justify-between p-4 rounded-lg border"
                                        >
                                            <div className="flex items-center gap-3">
                                                {entry.status === 'success' ? (
                                                    <CheckCircle2Icon className="h-5 w-5 text-green-500" />
                                                ) : entry.status === 'partial' ? (
                                                    <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
                                                ) : (
                                                    <XCircleIcon className="h-5 w-5 text-red-500" />
                                                )}
                                                <div>
                                                    <p className="font-medium capitalize">
                                                        {entry.syncType} Sync
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {formatDate(entry.completedAt)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm">
                                                <span className="flex items-center gap-1 text-green-600">
                                                    <UploadCloudIcon className="h-4 w-4" />
                                                    {entry.uploaded}
                                                </span>
                                                <span className="flex items-center gap-1 text-blue-600">
                                                    <DownloadCloudIcon className="h-4 w-4" />
                                                    {entry.downloaded}
                                                </span>
                                                {entry.conflicts > 0 && (
                                                    <span className="flex items-center gap-1 text-amber-600">
                                                        <AlertTriangleIcon className="h-4 w-4" />
                                                        {entry.conflicts}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Conflict Resolution Dialog */}
            <AlertDialog open={!!selectedConflict} onOpenChange={() => setSelectedConflict(null)}>
                <AlertDialogContent className="max-w-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Resolve Conflict</AlertDialogTitle>
                        <AlertDialogDescription>
                            Choose which version of the data to keep. The other version will be discarded.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {selectedConflict && (
                        <div className="grid grid-cols-2 gap-4 my-4">
                            <div className="p-4 rounded-lg border">
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <HardDriveIcon className="h-4 w-4" />
                                    Local Version
                                </h4>
                                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                                    {JSON.stringify(selectedConflict.localData, null, 2)}
                                </pre>
                            </div>
                            <div className="p-4 rounded-lg border">
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <CloudIcon className="h-4 w-4" />
                                    Remote Version
                                </h4>
                                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                                    {JSON.stringify(selectedConflict.remoteData, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => selectedConflict && handleResolveConflict(selectedConflict.id, 'local')}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Keep Local
                        </AlertDialogAction>
                        <AlertDialogAction
                            onClick={() => selectedConflict && handleResolveConflict(selectedConflict.id, 'remote')}
                        >
                            Keep Remote
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
