// client/src/components/ErrorBoundary.jsx
import React, { Component } from "react";
import { logger } from "../utils/logger";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error for debugging
    logger.error("ErrorBoundary caught an error:", {
      error,
      errorInfo,
      componentName: this.props.componentName || "Unknown",
      errorStack: error?.stack,
    });

    // Store error info for display
    this.setState({
      errorInfo,
    });

    // TODO: In production, send to error tracking service (Sentry, LogRocket, etc.)
    // Example:
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     contexts: { react: { componentStack: errorInfo.componentStack } }
    //   });
    // }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const componentName = this.props.componentName || "Component";
      const fallback = this.props.fallback;

      // Use custom fallback if provided
      if (fallback) {
        return typeof fallback === "function"
          ? fallback(error, this.handleReset)
          : fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-6 shadow-lg">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
                Something went wrong
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                An error occurred in {componentName}
              </p>
              {error && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-4 font-mono">
                  {error.message || "Unknown error"}
                </p>
              )}
              <div className="flex gap-2 justify-center">
                <button
                  onClick={this.handleReset}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors"
                >
                  Reload Page
                </button>
              </div>
              {process.env.NODE_ENV === "development" && this.state.errorInfo && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Error Details (Dev Only)
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-auto max-h-48">
                    {this.state.error?.stack}
                    {"\n\n"}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
