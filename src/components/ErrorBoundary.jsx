import React from "react";

// Last line of defence: a rendering error must never leave the customer on a blank page.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("UI error:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8 text-center">
        <div className="max-w-sm space-y-4">
          <h1 className="font-display font-bold text-xl">Something went wrong</h1>
          <p className="text-sm text-text-muted">The page could not be displayed. Your cart and orders are safe.</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-full bg-noon text-noon-fg text-sm font-semibold">Reload</button>
            <a href="/" className="px-5 py-2.5 rounded-full border border-border-hairline text-sm font-semibold">Home</a>
          </div>
        </div>
      </div>
    );
  }
}
