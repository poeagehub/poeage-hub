import React from 'react';

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

const RELOAD_FLAG = 'poeage_auto_reload_at';

/** Errors that mean "the page is running a mix of old and new code", which a reload fixes. */
const STALE_CODE = /must be used within|Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i;

/**
 * Catches any crash while rendering so the user sees a recoverable screen instead of a blank white page.
 * Stale-code errors (typical right after an update or a dev hot-reload) reload the page once automatically.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Render crash:', error, info.componentStack);
    if (!STALE_CODE.test(error.message)) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
      if (Date.now() - last > 15_000) {
        sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
        window.location.reload();
      }
    } catch {
      /* storage unavailable: fall through to the manual reload screen */
    }
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ maxWidth: 420, width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>Something went wrong</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
            This page hit an unexpected problem. Reloading usually fixes it. Your data is safe.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#2563eb', color: '#fff', border: 0, borderRadius: 10, padding: '10px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Reload page
          </button>
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            style={{ marginLeft: 8, background: '#f3f4f6', color: '#374151', border: 0, borderRadius: 10, padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            Go to home
          </button>
          <details style={{ marginTop: 18, textAlign: 'left' }}>
            <summary style={{ fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}>Technical details</summary>
            <pre style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'pre-wrap', marginTop: 6 }}>{this.state.error.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}
