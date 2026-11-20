import React, { useState } from 'react';
import { Check, Copy, Gift, Mail, X } from 'lucide-react';

interface GiftRegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCOUNT_NUMBER = '0014-8920-3411-7890';

export const GiftRegistryModal: React.FC<GiftRegistryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ACCOUNT_NUMBER);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2c3e35]/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gift-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#fcfbf9] border border-[#b89753]/35 p-5 sm:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana de mesa de regalos"
          className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-[#2c3e35]/70 hover:text-[#2c3e35] hover:bg-[#f7f5f0] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[#f7f5f0] border border-[#b89753]/30 text-[#b89753] flex items-center justify-center mx-auto mb-4">
            <Gift className="w-5 h-5" />
          </div>
          <h3
            id="gift-modal-title"
            className="font-serif text-2xl sm:text-3xl font-semibold text-[#2c3e35]"
          >
            Mesa de Regalos &amp; Lluvia de Sobres
          </h3>
          <p className="mt-2 text-sm text-[#2c3e35]/75 leading-relaxed">
            Su presencia en nuestro gran día es el obsequio más valioso. Si desean
            tener un detalle adicional, agradecemos su muestra de cariño mediante:
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-[#b89753]/25 p-5">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-[#b89753] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-serif text-xl font-semibold text-[#2c3e35]">
                  Lluvia de Sobres en Recepción
                </h4>
                <p className="mt-1 text-sm text-[#2c3e35]/75 leading-relaxed">
                  Tendremos un cofre dispuesto en la entrada del Salón de Eventos
                  Elegance para recibir sus sobres y buenos deseos.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-[#b89753]/25 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[#b89753] font-semibold">
              Transferencia Bancaria
            </p>
            <p className="mt-1 text-sm text-[#2c3e35] font-medium">
              A nombre de Jorge Luis Rodas Benítez
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-lg bg-[#f7f5f0] border border-[#b89753]/20 px-3.5 sm:px-4 py-2.5">
              <span className="font-mono text-xs sm:text-sm text-[#2c3e35] tabular-nums break-all">
                {ACCOUNT_NUMBER}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#b89753] hover:text-[#967739] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-emerald-700">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar cuenta</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-[#2c3e35] text-[#fcfbf9] text-sm font-medium hover:bg-[#1f2c26] transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
