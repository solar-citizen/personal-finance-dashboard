'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useInspectStatement, useUploadStatement } from '#src/_generated/api/pfd-components';
import { cn } from '#src/lib/utils';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function PrivatBankUploadModal({ isOpen, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [useExisting, setUseExisting] = useState(true);
  const [customName, setCustomName] = useState('ПриватБанк - Картка для виплат');

  const [isDragging, setIsDragging] = useState(false);

  const {
    mutate: inspect,
    data: inspectData,
    isPending: isInspecting,
    reset: resetInspect,
  } = useInspectStatement();

  const { mutate: upload, isPending: isUploading, reset: resetUpload } = useUploadStatement();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFile(null);
        resetInspect();
        resetUpload();
        setIsDragging(false);
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, resetInspect, resetUpload]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    setFile(null);
    resetInspect();
    resetUpload();
    setIsDragging(false);
    onClose();
  };

  const handleFile = (selected: File | null) => {
    if (!selected) {
      return;
    }
    setFile(selected);
    const formData = new FormData();
    formData.append('file', selected);
    inspect({ body: formData });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleConfirm = () => {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    if (useExisting && inspectData?.matchedAccountId) {
      formData.append('accountId', inspectData.matchedAccountId);
    } else {
      formData.append('accountName', customName.trim());
    }

    const body: FormData = formData;

    upload(
      {
        body,
      },
      {
        onSuccess: () => {
          handleClose();
          onSuccess();
        },
      },
    );
  };

  return (
    <div
      className={'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'}
      onClick={handleClose}
    >
      <div
        className={
          'relative w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-4 shadow-lg text-card-foreground'
        }
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className={
            'absolute top-4 right-4 text-muted-foreground hover:text-destructive transition-colors cursor-pointer'
          }
        >
          {'✕'}
        </button>
        <h2 className={'text-xl font-bold'}>{t('privatbank.modalTitle')}</h2>

        {!inspectData ? (
          <div
            className={cn(
              'border-2 border-dashed p-6 text-center rounded-lg cursor-pointer transition-colors hover:border-muted-foreground hover:bg-muted',
              {
                'border-primary bg-muted': isDragging,
              },
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type={'file'}
              accept={'.xlsx'}
              onChange={handleFileChange}
              className={'hidden'}
              id={'privat-xlsx-file'}
              disabled={isInspecting}
            />
            <label htmlFor={'privat-xlsx-file'} className={'cursor-pointer block'}>
              {isInspecting ? t('common.loading') : t('privatbank.selectFile')}
            </label>
          </div>
        ) : (
          <div className={'space-y-4'}>
            <div className={'p-3 bg-muted rounded text-sm space-y-1'}>
              <div>
                <strong>{t('privatbank.card')}</strong> <span>{inspectData.maskedPan}</span>
              </div>
              <div>
                <strong>{t('privatbank.period')}</strong>{' '}
                <span>
                  {inspectData.periodFrom.slice(0, 10)}
                  {' - '}
                  {inspectData.periodTo.slice(0, 10)}
                </span>
              </div>
              <div>
                <strong>{t('privatbank.transactionsFound')}</strong>{' '}
                <span>{inspectData.totalTransactions}</span>
              </div>
            </div>

            {inspectData.matchedAccountId ? (
              <div className={'space-y-2'}>
                <label className={'flex items-center gap-2 cursor-pointer'}>
                  <input
                    type={'radio'}
                    name={'accountOption'}
                    checked={useExisting}
                    onChange={() => setUseExisting(true)}
                  />
                  <span>
                    {t('privatbank.useExistingAccount')} {inspectData.matchedAccountName}
                  </span>
                </label>
              </div>
            ) : null}

            <div className={'space-y-2'}>
              <label className={'flex items-center gap-2 cursor-pointer'}>
                <input
                  type={'radio'}
                  name={'accountOption'}
                  checked={!useExisting || !inspectData.matchedAccountId}
                  onChange={() => setUseExisting(false)}
                />
                <span>{t('privatbank.createNewAccount')}</span>
              </label>

              {!useExisting || !inspectData.matchedAccountId ? (
                <div className={'space-y-1 pt-1'}>
                  <label htmlFor={'customAccountName'} className={'text-xs text-muted-foreground'}>
                    {t('privatbank.accountNameLabel')}
                  </label>
                  <input
                    id={'customAccountName'}
                    type={'text'}
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    className={
                      'w-full p-2 border border-input rounded bg-background text-foreground text-sm'
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className={'flex justify-end gap-2 pt-2'}>
              <button
                type={'button'}
                onClick={handleClose}
                className={
                  'px-4 py-2 border border-input rounded text-sm hover:bg-accent transition-colors cursor-pointer'
                }
                disabled={isUploading}
              >
                {t('common.cancel')}
              </button>
              <button
                type={'button'}
                onClick={handleConfirm}
                disabled={isUploading}
                className={
                  'px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:scale-105 transition-all duration-200 ease-out disabled:opacity-50 cursor-pointer'
                }
              >
                {isUploading ? t('privatbank.importing') : t('privatbank.confirmImport')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
