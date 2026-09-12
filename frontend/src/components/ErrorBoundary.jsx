import { Component } from 'react';

/**
 * Catches a render error in one screen so it does not take the whole app down
 * with it. Without this, a single bad read leaves a blank white page with the
 * real reason only in the console.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui crash]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Something went wrong on this page</h1>
        <p className="mt-1 text-sm text-slate-600">
          The rest of the app is fine. Reload, or go back to the dashboard.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md bg-slate-100 p-3 text-left text-xs text-slate-700">
          {this.state.error.message}
        </pre>
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Dashboard
          </a>
        </div>
      </div>
    );
  }
}
