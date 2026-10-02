'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useInspectStatement, useUploadStatement } from '#src/_generated/api/pfd-components';

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

  const {
    mutate: inspect,
    data: inspectData,
    isPending: isInspecting,
    reset: resetInspect,
  } = useInspectStatement();

  const { mutate: upload, isPending: isUploading, reset: resetUpload } = useUploadStatement();

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    setFile(null);
    resetInspect();
    resetUpload();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];

    if (!selected) {
      return;
    }

    setFile(selected);
    const formData = new FormData();
    formData.append('file', selected);
    inspect({ body: formData });
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

    upload(
      {
        body: formData,
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
    <div className={'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'}>
      <div
        className={
          'w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-4 shadow-lg text-card-foreground'
        }
      >
        <h2 className={'text-xl font-bold'}>{t('privatbank.modalTitle')}</h2>

        {!inspectData ? (
          <div
            className={
              'border-2 border-dashed border-border p-6 text-center rounded-lg cursor-pointer'
            }
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
