import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

interface UpdateProgress {
  current: number;
  total: number;
  percentage: number;
}

function UpdateChecker() {
  const [isChecking, setIsChecking] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress>({ current: 0, total: 0, percentage: 0 });
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      setIsChecking(true);
      setUpdateError(null);
      
      const update = await check();
      
      if (update?.available) {
        setUpdateAvailable(true);
        console.log('Update available:', update);
      } else {
        console.log('No update available');
        setIsChecking(false);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      setUpdateError('Failed to check for updates');
      setIsChecking(false);
    }
  };

  const handleUpdateAccept = async () => {
    try {
      setIsUpdating(true);
      setUpdateError(null);
      
      const update = await check();
      if (!update?.available) {
        setUpdateError('Update no longer available');
        setIsUpdating(false);
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            setUpdateProgress({ current: 0, total: contentLength, percentage: 0 });
            console.log(`Started downloading ${contentLength} bytes`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            const percentage = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
            setUpdateProgress({ current: downloaded, total: contentLength, percentage });
            console.log(`Download progress: ${percentage}% (${downloaded}/${contentLength})`);
            break;
          case 'Finished':
            setUpdateProgress({ current: contentLength, total: contentLength, percentage: 100 });
            console.log('Download finished');
            break;
        }
      });

      // Update completed, relaunch the app
      console.log('Update completed, relaunching app...');
      await relaunch();
    } catch (error) {
      console.error('Error during update:', error);
      setUpdateError('Update failed. Please try again.');
      setIsUpdating(false);
    }
  };

  const handleUpdateDecline = () => {
    setUpdateAvailable(false);
    setIsChecking(false);
  };

  // Show loading while checking for updates
  if (isChecking) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        color: 'white',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{ fontSize: '18px', marginBottom: '20px' }}>Checking for updates...</div>
        <div style={{
          width: '200px',
          height: '4px',
          backgroundColor: '#333',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#4CAF50',
            animation: 'pulse 1.5s ease-in-out infinite'
          }} />
        </div>
        <style>{`
          @keyframes pulse {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  // Show update available dialog
  if (updateAvailable && !isUpdating) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        color: 'white',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          backgroundColor: '#2a2a2a',
          padding: '30px',
          borderRadius: '10px',
          maxWidth: '400px',
          textAlign: 'center',
          border: '1px solid #444'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: '#4CAF50' }}>Update Available</h2>
          <p style={{ margin: '0 0 30px 0', lineHeight: '1.5' }}>
            A new version of the application is available. Would you like to update now?
          </p>
          {updateError && (
            <div style={{
              backgroundColor: '#f44336',
              color: 'white',
              padding: '10px',
              borderRadius: '5px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {updateError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button
              onClick={handleUpdateAccept}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              Update Now
            </button>
            <button
              onClick={handleUpdateDecline}
              style={{
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show update progress
  if (isUpdating) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        color: 'white',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          backgroundColor: '#2a2a2a',
          padding: '30px',
          borderRadius: '10px',
          maxWidth: '400px',
          textAlign: 'center',
          border: '1px solid #444'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: '#4CAF50' }}>Updating Application</h2>
          <p style={{ margin: '0 0 20px 0' }}>Please wait while the update is being downloaded and installed...</p>
          
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              width: '300px',
              height: '20px',
              backgroundColor: '#333',
              borderRadius: '10px',
              overflow: 'hidden',
              marginBottom: '10px'
            }}>
              <div style={{
                width: `${updateProgress.percentage}%`,
                height: '100%',
                backgroundColor: '#4CAF50',
                transition: 'width 0.3s ease',
                borderRadius: '10px'
              }} />
            </div>
            <div style={{ fontSize: '14px', color: '#ccc' }}>
              {updateProgress.percentage}% ({updateProgress.current.toLocaleString()} / {updateProgress.total.toLocaleString()} bytes)
            </div>
          </div>

          {updateError && (
            <div style={{
              backgroundColor: '#f44336',
              color: 'white',
              padding: '10px',
              borderRadius: '5px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {updateError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // No update available or update declined, show the app
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <UpdateChecker />
  </React.StrictMode>,
);
