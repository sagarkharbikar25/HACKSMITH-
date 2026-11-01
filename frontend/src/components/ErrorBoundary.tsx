import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("BrandGuard UI ErrorBoundary caught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = "/login";
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0E0E0B] text-ink flex items-center justify-center p-6">
          <div className="w-full max-w-lg p-8 rounded-2xl bg-[#151511] border border-line shadow-2xl space-y-6 text-center frame-shimmer-border">
            <div className="w-14 h-14 rounded-full bg-critical/15 text-critical flex items-center justify-center mx-auto border border-critical/30 shadow-[0_0_20px_rgba(255,92,110,0.25)]">
              <AlertTriangle size={28} />
            </div>

            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-critical/20 text-critical border border-critical/30">
                Application Rendering Interruption
              </span>
              <h2 className="text-xl font-bold font-display text-white mt-2">
                BrandGuard Interface Recovered
              </h2>
              <p className="text-xs text-muted mt-2 font-sans leading-relaxed">
                An unexpected UI state occurred. You can reload this view or reset your session credentials to return cleanly to the login portal.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-[#0E0E0B] border border-line p-3 rounded-lg overflow-x-auto text-[11px] font-mono text-muted max-h-36">
                <span className="text-critical font-bold">{this.state.error.name}: </span>
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl bg-card hover:bg-white/10 border border-line text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Reload Page</span>
              </button>

              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl bg-primary text-black font-semibold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(175,230,7,0.3)]"
              >
                <LogOut size={14} />
                <span>Reset Session & Login</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
