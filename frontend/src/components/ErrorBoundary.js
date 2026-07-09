/**
 * ErrorBoundary.js
 *
 * A generic React error boundary that silently hides any child component
 * that throws during rendering (e.g. Three.js / WebGL failures on devices
 * that don't support it).
 *
 * Usage:
 *   <ErrorBoundary fallback={null}>
 *     <Scene3D />
 *   </ErrorBoundary>
 *
 * Optionally pass a `fallback` prop to render something instead of nothing.
 */

import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console in development so developers can see the error.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[ErrorBoundary] Caught error:", error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      // Render the fallback UI (defaults to null — silent hide).
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
