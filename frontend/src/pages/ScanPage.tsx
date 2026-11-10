import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { attendanceApi, type ScanResult } from '../api/attendance';
import { useAuth } from '../context/AuthContext';
import RecipientCard from '../components/RecipientCard';
import { apiErrorMessage } from '../api/client';
import Icon, { type IconName } from '../components/Icon';
import './ScanPage.css';

type ScanState = 'idle' | 'scanning' | 'processing' | 'result' | 'error';

const ScanPage: React.FC = () => {
  const { staff, logout } = useAuth();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [restartRequested, setRestartRequested] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const scannerDivId = 'qr-scanner-div';

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        // State 2 = SCANNING, State 3 = PAUSED
        if (state === 2 || state === 3) {
          await html5QrCodeRef.current.stop();
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    setScanState('scanning');
    setCameraError('');
    setErrorMessage('');
    setScanResult(null);
    isProcessingRef.current = false;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerDivId);
      }

      const config = {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
        formatsToSupport: [0], // QR_CODE only
      };

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        async (decodedText: string) => {
          if (isProcessingRef.current) return;
          isProcessingRef.current = true;

          await stopScanner();
          setScanState('processing');

          try {
            const result = await attendanceApi.scan(decodedText.trim());
            setScanResult(result);
            setScanState('result');
          } catch (err: unknown) {
            setErrorMessage(
              apiErrorMessage(err, 'Gagal terhubung ke Supabase. Periksa koneksi internet.'),
            );
            setScanState('error');
          }
        },
        undefined, // onError callback — diabaikan agar tidak spam
      );
    } catch (err: unknown) {
      const e = err as Error;
      if (e.message?.includes('Permission') || e.message?.includes('permission') || e.name === 'NotAllowedError') {
        setCameraError('Izin kamera ditolak. Buka pengaturan browser dan izinkan akses kamera.');
      } else if (e.name === 'NotFoundError' || e.message?.includes('device')) {
        setCameraError('Kamera tidak ditemukan di perangkat ini.');
      } else {
        setCameraError(`Kamera tidak dapat diakses: ${e.message}`);
      }
      setScanState('idle');
    }
  }, [stopScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  useEffect(() => {
    if (restartRequested && scanState === 'idle') {
      setRestartRequested(false);
      void startScanner();
    }
  }, [restartRequested, scanState, startScanner]);

  const handleNextScan = () => {
    setScanResult(null);
    setErrorMessage('');
    setCameraError('');
    html5QrCodeRef.current = null;
    setScanState('idle');
    setRestartRequested(true);
  };

  const getStatusConfig = (status: string): { icon: IconName; label: string; className: string } => {
    switch (status) {
      case 'recorded':
        return { icon: 'check', label: 'Absensi dicatat', className: 'status-success' };
      case 'already_present':
        return { icon: 'alert', label: 'Sudah absen', className: 'status-warning' };
      case 'invalid_qr':
        return { icon: 'x', label: 'Kode QR tidak valid', className: 'status-danger' };
      case 'inactive_beneficiary':
      case 'inactive_student':
        return { icon: 'ban', label: 'Penerima tidak aktif', className: 'status-danger' };
      default:
        return { icon: 'help', label: 'Status tidak diketahui', className: 'status-warning' };
    }
  };

  return (
    <div className="scan-page">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <div className="header-logo-icon"><Icon name="clipboard" size={16} /></div>
          <div>
            <div className="header-title">AbsenQR</div>
            <div className="header-subtitle">Absensi MBG</div>
          </div>
        </div>
        <div className="header-staff">
          <div className="staff-info">
            <div className="staff-name">{staff?.name}</div>
            <div className="staff-username">@{staff?.username}</div>
          </div>
          <div className="staff-avatar">
            {staff?.name?.charAt(0).toUpperCase()}
          </div>
          <button
            className="btn btn-ghost btn-logout"
            onClick={logout}
            id="logout-btn"
            title="Keluar"
            aria-label="Keluar"
          >
            <Icon name="log-out" size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="scan-main">
        <div className="scan-intro">
          <h1>Pindai kode QR</h1>
          <p>Arahkan kamera ke kartu penerima manfaat untuk mencatat kehadiran.</p>
        </div>

        {/* Scanner Area */}
        {(scanState === 'idle' || scanState === 'scanning') && (
          <div className="scanner-section">
            <div className="scanner-frame-wrapper">
              {/* Scanner div — selalu ada di DOM saat scanning */}
              <div
                id={scannerDivId}
                className={`scanner-video-container ${scanState === 'scanning' ? 'active' : 'hidden'}`}
              />

              {scanState === 'idle' && (
                <div className="scanner-placeholder">
                  <div className="scanner-placeholder-icon"><Icon name="camera" /></div>
                  <p className="scanner-placeholder-text">
                    Kamera belum aktif
                  </p>
                </div>
              )}

              {scanState === 'scanning' && (
                <div className="scanner-overlay">
                  <div className="scanner-target" />
                </div>
              )}
            </div>

            {cameraError && (
              <div className="alert alert-error mt-4">
                <Icon name="alert" size={16} />
                <span>{cameraError}</span>
              </div>
            )}

            {scanState === 'idle' && (
              <button
                className="btn btn-primary btn-full btn-lg scan-start-btn"
                onClick={startScanner}
                id="start-scan-btn"
              >
                <Icon name="camera" />
                Aktifkan kamera
              </button>
            )}

            {scanState === 'scanning' && (
              <div className="scanning-indicator">
                <div className="scanning-dot" />
                <span>Kamera aktif. Arahkan ke kode QR.</span>
              </div>
            )}
          </div>
        )}

        {/* Processing State */}
        {scanState === 'processing' && (
          <div className="processing-section" role="status" aria-live="polite">
            <div className="scan-skeleton skeleton" />
            <div className="processing-copy">
              <p className="processing-text">Memeriksa kode QR</p>
              <p className="processing-sub">Data penerima manfaat sedang diverifikasi.</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {scanState === 'error' && (
          <div className="result-section">
            <div className="result-status status-danger">
              <Icon className="result-status-icon" name="x" />
              <div>
                <div className="result-status-title">Tidak dapat terhubung</div>
                <div className="result-status-message">{errorMessage}</div>
              </div>
            </div>
            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={handleNextScan}
              id="retry-scan-btn"
            >
              <Icon name="refresh" />
              Coba lagi
            </button>
          </div>
        )}

        {/* Result State */}
        {scanState === 'result' && scanResult && (
          <div className="result-section">
            {/* Status Banner */}
            {(() => {
              const statusConfig = getStatusConfig(scanResult.status);
              return (
                <div className={`result-status ${statusConfig.className}`}>
                  <Icon className="result-status-icon" name={statusConfig.icon} />
                  <div>
                    <div className="result-status-title">{statusConfig.label}</div>
                    <div className="result-status-message">{scanResult.message}</div>
                  </div>
                </div>
              );
            })()}

            {/* Student Card */}
            {scanResult.recipient && (
              <RecipientCard
                recipient={scanResult.recipient}
                attendance={scanResult.attendance}
              />
            )}

            {/* Next Scan Button */}
            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={handleNextScan}
              id="next-scan-btn"
            >
              <Icon name="camera" />
              Pindai berikutnya
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default ScanPage;
