import '../css/app.css';

import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { initializeTheme } from './hooks/use-appearance';
import ElectronAppLayout from './layouts/electron-app-layout';

// Import pages for Electron
import Dashboard from './pages/dashboard';
import TensionRecordsDisplay from './pages/tension-records-display';
import StockTakeRecordsDisplay from './pages/stock-take-records-display';
import FinishEarlierRecordsDisplay from './pages/finish-earlier-records-display';
import DatabaseSyncPage from './pages/database-sync';

// Initialize theme
initializeTheme();

function ElectronApp() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route
                    path="/dashboard"
                    element={
                        <ElectronAppLayout>
                            <Dashboard />
                        </ElectronAppLayout>
                    }
                />
                <Route
                    path="/tension-records"
                    element={
                        <ElectronAppLayout>
                            <TensionRecordsDisplay />
                        </ElectronAppLayout>
                    }
                />
                <Route
                    path="/stock-take-records"
                    element={
                        <ElectronAppLayout>
                            <StockTakeRecordsDisplay />
                        </ElectronAppLayout>
                    }
                />
                <Route
                    path="/finish-earlier-records"
                    element={
                        <ElectronAppLayout>
                            <FinishEarlierRecordsDisplay />
                        </ElectronAppLayout>
                    }
                />
                <Route
                    path="/database-sync"
                    element={
                        <ElectronAppLayout>
                            <DatabaseSyncPage />
                        </ElectronAppLayout>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

const container = document.getElementById('app');
if (container) {
    const root = createRoot(container);
    root.render(<ElectronApp />);
}
