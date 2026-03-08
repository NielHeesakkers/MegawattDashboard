import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-dark flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            {/* Megawatt logo */}
            <div className="mb-8">
              <h1 className="text-accent text-3xl font-bold tracking-wide">MEGAWATT</h1>
            </div>

            {/* Error icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>

            {/* Error message */}
            <h2 className="text-text-primary text-xl font-semibold mb-2">
              Er is iets misgegaan
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              Er is een onverwachte fout opgetreden. Probeer de pagina opnieuw te laden.
            </p>

            {/* Error detail */}
            {this.state.error && (
              <div className="mb-6 px-4 py-3 rounded-[8px] bg-red-500/10 border border-red-500/20 text-left">
                <p className="text-red-400 text-xs font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {/* Retry button */}
            <button
              onClick={this.handleReload}
              className="px-6 py-2.5 rounded-[8px] bg-accent text-bg-dark font-semibold text-sm hover:brightness-110 transition-all duration-150 shadow-[0_2px_8px_rgba(201,168,76,0.3)] cursor-pointer"
            >
              Probeer opnieuw
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
