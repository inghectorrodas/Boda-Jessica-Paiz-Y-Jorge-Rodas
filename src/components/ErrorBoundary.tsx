import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Ocurrió un error inesperado.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fcfbf9] text-[#2c3e35] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#b89753]/35 rounded-2xl p-8 text-center shadow-sm space-y-4">
            <h2 className="font-serif text-3xl font-semibold text-[#2c3e35]">
              Algo necesita atención
            </h2>
            <p className="text-sm text-[#2c3e35]/75 leading-relaxed">
              No pudimos completar una operación con la base de datos. Recarga
              la página o verifica tus permisos de acceso.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-full bg-[#b89753] hover:bg-[#967739] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
