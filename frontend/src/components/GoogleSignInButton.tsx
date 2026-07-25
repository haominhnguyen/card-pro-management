import { useEffect, useRef, useState } from 'react';

/**
 * "Sign in with Google" button backed by Google Identity Services (GIS).
 * Loads the GIS script once, renders Google's official button, and hands the
 * returned ID token (credential) to `onCredential`. Renders nothing if the
 * client id isn't configured (VITE_GOOGLE_CLIENT_ID).
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Minimal shape of the bits of GIS we use.
interface GoogleId {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  onCredential: (idToken: string) => void;
  /** 'signin_with' (default) or 'signup_with' — changes the button label. */
  text?: 'signin_with' | 'signup_with';
  disabled?: boolean;
}

export default function GoogleSignInButton({ onCredential, text = 'signin_with', disabled }: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !holderRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (r) => onCredential(r.credential),
        });
        holderRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(holderRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.min(holderRef.current.offsetWidth || 320, 400),
        });
        setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
  }, [onCredential, text]);

  if (!CLIENT_ID) return null;

  return (
    <div
      className="flex justify-center mb-4"
      style={disabled ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
    >
      <div ref={holderRef} />
      {!ready && <span className="text-xs text-gray-400">Đang tải Google…</span>}
    </div>
  );
}
