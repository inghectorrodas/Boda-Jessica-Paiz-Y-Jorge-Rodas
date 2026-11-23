import React from 'react';
import { AlertTriangle, ExternalLink, RefreshCw, Eye } from 'lucide-react';
import { FIREBASE_PROJECT_ID, FIREBASE_DATABASE_ID } from '../firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  bypassError: boolean;
}

const UPGRADE_URL = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIREBASE_DATABASE_ID}/data?openUpgradeDialog=true`;

function isFirestoreQuotaError(message: string): boolean {
  const lower = (message || '').toLowerCase();
  return (
    lower.includes('quota limit exceeded') ||
    lower.includes('quota exceeded') ||
    lower.includes('free daily read units') ||
    lower.includes('free tier database')
  );
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', bypassError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      message: error.message || 'Ocurrió un error inesperado.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('ErrorBoundary capturó:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && !this.state.bypassError) {
      const isQuota = isFirestoreQuotaError(this.state.message);

      if (isQuota) {
        return (
          <div className="min-h-screen bg-[#fcfbf9] text-[#2c3e35] flex items-center justify-center p-4 sm:p-6">
            <div className="max-w-lg w-full bg-white border border-[#b89753]/35 rounded-2xl p-6 sm:p-8 text-center shadow-lg space-y-5">
              <div className="w-14 h-14 rounded-full bg-[#fdf5e6] text-[#b89753] flex items-center justify-center mx-auto border border-[#b89753]/30">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <span className="inline-block text-[11px] uppercase tracking-[0.2em] font-semibold text-[#b89753] bg-[#fcfbf9] border border-[#b89753]/30 px-3 py-1 rounded-full">
                  Cuota Firestore Gratuita
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2c3e35]">
                  Límite diario de lecturas superado
                </h2>
              </div>

              <p className="text-sm text-[#2c3e35]/80 leading-relaxed text-left sm:text-center">
                Se ha alcanzado el límite diario de lecturas gratuitas (50,000
                unidades/día) de la base de datos de Firestore en el plan
                gratuito (Spark).
              </p>

              <div className="rounded-xl bg-[#fcfbf9] border border-[#b89753]/25 p-4 text-xs text-[#2c3e35]/75 text-left space-y-2">
                <p>
                  • <strong>Reinicio automático:</strong> La cuota se reiniciará
                  mañana automáticamente a las 00:00 UTC.
                </p>
                <p>
                  • <strong>Para continuar sin límites:</strong> Puedes habilitar
                  facturación (Plan de Pago por Uso / Blaze) en la consola de Firebase.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <a
                  href={UPGRADE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[#b89753] hover:bg-[#967739] text-white text-xs font-semibold tracking-wide transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Habilitar facturación en Firebase Console</span>
                </a>

                <a
                  href="https://firebase.google.com/pricing#cloud-firestore"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#2c3e35]/65 hover:text-[#b89753] underline underline-offset-4"
                >
                  Ver límites y precios de Firestore (Plan Spark vs Blaze)
                </a>

                <button
                  type="button"
                  onClick={() => this.setState({ bypassError: true })}
                  className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-[#f7f5f0] hover:bg-[#ede8db] border border-[#b89753]/35 text-[#2c3e35] text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-[#b89753]" />
                  <span>Ver invitación con datos guardados (Modo sin conexión)</span>
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-[#fcfbf9] text-[#2c3e35] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#b89753]/35 rounded-2xl p-8 text-center shadow-sm space-y-4">
            <h2 className="font-serif text-3xl font-semibold text-[#2c3e35]">
              Algo necesita atención
            </h2>
            <p className="text-sm text-[#2c3e35]/75 leading-relaxed">
              No pudimos completar una operación con la base de datos. Recarga la
              página o verifica tus permisos de acceso.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-full bg-[#b89753] hover:bg-[#967739] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Recargar página</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        {this.state.bypassError && (
          <div className="sticky top-0 z-50 bg-[#b89753] text-white text-xs px-4 py-2 flex items-center justify-between shadow-md">
            <span>
              Mostrando la invitación en modo sin conexión (cuota diaria de Firestore superada).
            </span>
            <a
              href={UPGRADE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold ml-2 inline-flex items-center gap-1"
            >
              Habilitar facturación <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
        {this.props.children}
      </>
    );
  }
}
