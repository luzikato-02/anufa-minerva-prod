import { useEffect, useState } from 'react';
import ServerConfigModal from './components/server-config-modal';

export default function ElectronBridge() {
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    console.log('[Electron] bridge mounted');

    const unsubscribe =
      window.electronAPI.onShowServerConfig(() => {
        console.log('[Electron] show-server-config received');
        setShowConfig(true);
      });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return (
    <ServerConfigModal
      open={showConfig}
      onClose={() => setShowConfig(false)}
    />
  );
}
