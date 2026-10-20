import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Spotibai Uncaught Error Boundary catch:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-spotify-black text-white p-6 select-none">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Something went wrong</h1>
          <p className="text-sm text-neutral-400 max-w-md text-center mb-6">
            Spotibai encountered an unexpected rendering error after resuming. Click below to restore playback and reload.
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-spotify-green hover:bg-spotify-green/90 text-black font-bold text-sm transition-transform active:scale-95 shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload Spotibai</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
