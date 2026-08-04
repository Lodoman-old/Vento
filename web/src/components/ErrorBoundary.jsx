import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Error de React:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-white">
          <div className="max-w-lg w-full bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-600 font-semibold mb-2">Ocurrió un error</p>
            <p className="text-sm text-red-700 mb-4">
              {this.state.error.message || String(this.state.error)}
            </p>
            <pre className="text-xs bg-white border border-red-100 rounded p-3 overflow-auto max-h-64 text-red-800 whitespace-pre-wrap">
              {this.state.error.stack || ""}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}