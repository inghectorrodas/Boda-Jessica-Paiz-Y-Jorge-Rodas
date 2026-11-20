import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Gift, Mail, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  DEFAULT_WEDDING_CONFIG,
  WeddingConfigRecord,
} from '../data/weddingData';

interface GiftRegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
  config?: WeddingConfigRecord;
}

export const GiftRegistryModal: React.FC<GiftRegistryModalProps> = ({
  isOpen,
  onClose,
  config,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const envelopeNote =
    config?.giftEnvelopeNote?.trim() ||
    DEFAULT_WEDDING_CONFIG.giftEnvelopeNote ||
    'Tendremos un cofre dispuesto en la entrada del Salón de Eventos Elegance para recibir sus sobres y buenos deseos.';
  const bankName =
    config?.giftBankName?.trim() ||
    DEFAULT_WEDDING_CONFIG.giftBankName ||
    'Transferencia Bancaria';
  const accountHolder =
    config?.giftAccountHolder?.trim() ||
    DEFAULT_WEDDING_CONFIG.giftAccountHolder ||
    'Jorge Luis Rodas Benítez';
  const accountType = config?.giftAccountType?.trim() || '';
  const accountNumber =
    config?.giftAccountNumber?.trim() ||
    DEFAULT_WEDDING_CONFIG.giftAccountNumber ||
    '0014-8920-3411-7890';
  const qrImage = config?.giftQrImage?.trim() || '';
  const qrValue = config?.giftQrValue?.trim() || '';
  const hasQr = Boolean(qrImage || qrValue);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(accountNumber);
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
                  {envelopeNote}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-[#b89753]/25 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[#b89753] font-semibold">
              {bankName}
            </p>
            <p className="mt-1 text-sm text-[#2c3e35] font-medium">
              A nombre de {accountHolder}
            </p>
            {accountType && (
              <p className="mt-0.5 text-xs text-[#2c3e35]/65">
                {accountType}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-lg bg-[#f7f5f0] border border-[#b89753]/20 px-3.5 sm:px-4 py-2.5">
              <span className="font-mono text-xs sm:text-sm text-[#2c3e35] tabular-nums break-all">
                {accountNumber}
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

            {hasQr && (
              <div className="mt-4 pt-4 border-t border-[#b89753]/15 text-center space-y-2.5">
                <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[#b89753] font-semibold">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Código QR para Transferencia</span>
                </div>
                <div className="flex justify-center">
                  <div className="inline-flex p-3 rounded-xl bg-white border border-[#b89753]/30 shadow-2xs">
                    {qrImage ? (
                      <img
                        src={qrImage}
                        alt={`Código QR para transferencia a ${accountHolder}`}
                        className="w-44 h-44 object-contain rounded-lg"
                      />
                    ) : (
                      <QRCodeSVG
                        value={qrValue}
                        size={172}
                        bgColor="#ffffff"
                        fgColor="#2c3e35"
                        level="M"
                      />
                    )}
                  </div>
                </div>
                {qrValue.startsWith('https://') && (
                  <div>
                    <a
                      href={qrValue}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b89753] hover:text-[#967739] underline underline-offset-4"
                    >
                      <span>Abrir enlace de pago</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
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
