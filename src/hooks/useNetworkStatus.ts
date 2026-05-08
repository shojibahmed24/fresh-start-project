import { useEffect, useState } from "react";

// Slim wrapper around the browser's online/offline + Network Information APIs.
// `navigator.connection` is non-standard but widely supported on Chrome/Android.
// We detect:
//   - online/offline (navigator.onLine + window events)
//   - slow connection (effectiveType: 'slow-2g' | '2g' | save-data flag)
// so the UI can warn the user before they tap Send on a flaky link.

type Effective = "slow-2g" | "2g" | "3g" | "4g" | "5g" | "unknown";

export type NetworkStatus = {
  online: boolean;
  effectiveType: Effective;
  saveData: boolean;
  // True when 2g/slow-2g OR the user has Data Saver on.
  isSlow: boolean;
  // Round-trip estimate in ms (when available).
  rtt: number | null;
  // Estimated downlink in Mbps (when available).
  downlink: number | null;
};

type NavConnection = {
  effectiveType?: Effective;
  saveData?: boolean;
  rtt?: number;
  downlink?: number;
  addEventListener?: (e: string, fn: () => void) => void;
  removeEventListener?: (e: string, fn: () => void) => void;
};

const getConnection = (): NavConnection | null => {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as {
    connection?: NavConnection;
    mozConnection?: NavConnection;
    webkitConnection?: NavConnection;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
};

const snapshot = (): NetworkStatus => {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const conn = getConnection();
  const effectiveType: Effective = conn?.effectiveType ?? "unknown";
  const saveData = !!conn?.saveData;
  const isSlow =
    saveData || effectiveType === "slow-2g" || effectiveType === "2g";
  return {
    online,
    effectiveType,
    saveData,
    isSlow,
    rtt: conn?.rtt ?? null,
    downlink: conn?.downlink ?? null,
  };
};

export const useNetworkStatus = (): NetworkStatus => {
  const [status, setStatus] = useState<NetworkStatus>(() => snapshot());

  useEffect(() => {
    const update = () => setStatus(snapshot());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const conn = getConnection();
    conn?.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      conn?.removeEventListener?.("change", update);
    };
  }, []);

  return status;
};
