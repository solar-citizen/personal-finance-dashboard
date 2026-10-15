'use client';

import { accountTypeNames, bankNames } from '@pfd/shared';
import { HardDriveUpload, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useCancelSyncJob,
  useGetAccounts,
  useGetSyncJobs,
  usePauseSyncJob,
  useResumeSyncJob,
  useRetrySyncJob,
  useSyncTransactions,
} from '#src/_generated/api/pfd-components';
import Button from '#src/components/common/Button';
import Select from '#src/components/common/Select';
import PrivatBankUploadModal from '#src/components/privatbank/PrivatBankUploadModal';
import { Card } from '#src/components/ui/card';

export default function DataSync() {
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [showColumnConfig, setShowColumnConfig] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState({
    jobId: true,
    status: true,
    progress: true,
    newUpdated: true,
    startedAt: true,
    actions: true,
  });

  const columnKeys = ['jobId', 'status', 'progress', 'newUpdated', 'startedAt', 'actions'] as const;

  const syncMutation = useSyncTransactions();
  const cancelMutation = useCancelSyncJob();
  const retryMutation = useRetrySyncJob();
  const pauseMutation = usePauseSyncJob();
  const resumeMutation = useResumeSyncJob();

  const { data, refetch: refetchJobs } = useGetSyncJobs(
    {
      queryParams: {
        page,
        limit,
      },
    },
    {
      refetchInterval: query => {
        const pageData = query.state.data;
        const hasActive = pageData?.items.some(
          (job: { status: string }) =>
            job.status === 'running' || job.status === 'pending' || job.status === 'saving',
        );
        return hasActive || syncMutation.isPending || retryMutation.isPending ? 2000 : false;
      },
    },
  );

  const jobs = data?.items;
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const { data: accounts } = useGetAccounts({});
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [fullHistory, setFullHistory] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [actionError, setActionError] = useState<boolean>(false);
  const { t } = useTranslation();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return t('dataSync.statuses.pending');
      case 'running':
        return t('dataSync.statuses.running');
      case 'saving':
        return t('dataSync.statuses.saving');
      case 'completed':
        return t('dataSync.statuses.completed');
      case 'failed':
        return t('dataSync.statuses.failed');
      case 'cancelled':
        return t('dataSync.statuses.cancelled');
      case 'paused':
        return t('dataSync.statuses.paused');
      default:
        return status;
    }
  };

  const handleSync = async () => {
    const accId = selectedAccountId || (accounts?.[0]?.id ?? '');

    if (!accId) {
      return;
    }

    setPage(1);
    await runJobAction(() =>
      syncMutation.mutateAsync({
        pathParams: { accountId: accId },
        body: { fullHistory },
      }),
    );
  };

  const handleCancel = async (jobId: string) => {
    await runJobAction(() => cancelMutation.mutateAsync({ pathParams: { jobId } }));
  };

  const handleRetry = async (jobId: string) => {
    setPage(1);
    await runJobAction(() => retryMutation.mutateAsync({ pathParams: { jobId } }));
  };

  const handlePause = async (jobId: string) => {
    await runJobAction(() => pauseMutation.mutateAsync({ pathParams: { jobId } }));
  };

  const handleResume = async (jobId: string) => {
    await runJobAction(() => resumeMutation.mutateAsync({ pathParams: { jobId } }));
  };

  const runJobAction = async (action: () => Promise<unknown>) => {
    setActionError(false);
    try {
      await action();
    } catch {
      setActionError(true);
    }
    await refetchJobs();
  };

  const toggleColumn = (col: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const activeColumnCount = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <div className={'p-6 space-y-6 pt-20'}>
      <div className={'flex justify-between items-center'}>
        <h1 className={'text-2xl font-bold'}>{t('dataSync.title')}</h1>
        <Button onClick={() => setIsUploadOpen(true)}>
          <HardDriveUpload className={'inline-block size-3.5 mr-1.5 -mt-0.5'} />
          {t('privatbank.importButton')}
        </Button>
      </div>

      <Card className={'p-6'}>
        <h2 className={'text-lg font-semibold'}>{t('dataSync.triggerMonobankSync')}</h2>
        <div className={'flex gap-4 items-center flex-wrap'}>
          <Select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
            {accounts?.map(({ id, type, bank, name, iban, currency }) => {
              const currencyUpper = currency.toUpperCase();
              const displayName =
                name ?? (type ? accountTypeNames[type] : null) ?? type ?? iban ?? id;
              const bankName = bank ? (bankNames[bank] ?? bank) : 'Monobank';
              return (
                <option key={id} value={id}>
                  {bankName}
                  {' - '}
                  {displayName}
                  {' ('}
                  {currencyUpper}
                  {')'}
                </option>
              );
            })}
          </Select>

          <label className={'flex items-center gap-2 cursor-pointer'}>
            <input
              type={'checkbox'}
              checked={fullHistory}
              onChange={e => setFullHistory(e.target.checked)}
            />
            {t('dataSync.fullHistorySync')}
          </label>

          <Button
            onClick={() => {
              void handleSync();
            }}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? t('dataSync.starting') : t('dataSync.startSync')}
          </Button>
        </div>
      </Card>

      <Card className={'p-6 space-y-4'}>
        {actionError && (
          <p role={'alert'} className={'text-sm text-destructive'}>
            {t('dataSync.actionFailed')}
          </p>
        )}
        <div className={'flex justify-between items-center relative'}>
          <h2 className={'text-lg font-semibold'}>{t('dataSync.recentJobs')}</h2>
          <div className={'relative'}>
            <Button
              variant={'outline'}
              size={'sm'}
              onClick={() => setShowColumnConfig(prev => !prev)}
              className={'flex items-center gap-1.5'}
            >
              <Settings2 className={'size-4'} />
              {t('dataSync.columns')}
            </Button>

            {showColumnConfig && (
              <div
                className={
                  'absolute right-0 mt-2 w-48 bg-card border rounded-lg shadow-lg p-3 z-20 space-y-2'
                }
              >
                <div className={'text-xs font-semibold text-muted-foreground mb-1'}>
                  {t('dataSync.toggleColumns')}
                </div>
                {columnKeys.map(col => (
                  <label key={col} className={'flex items-center gap-2 text-sm cursor-pointer'}>
                    <input
                      type={'checkbox'}
                      checked={visibleColumns[col]}
                      onChange={() => toggleColumn(col)}
                    />
                    <span className={'capitalize'}>
                      {col === 'jobId'
                        ? t('dataSync.jobId')
                        : col === 'status'
                          ? t('dataSync.status')
                          : col === 'progress'
                            ? t('dataSync.progress')
                            : col === 'newUpdated'
                              ? t('dataSync.newUpdated')
                              : col === 'startedAt'
                                ? t('dataSync.startedAt')
                                : t('dataSync.actions')}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={'overflow-x-auto'}>
          <table className={'w-full text-left border-collapse'}>
            <thead>
              <tr className={'border-b border-border'}>
                {visibleColumns.jobId && <th className={'p-2'}>{t('dataSync.jobId')}</th>}
                {visibleColumns.status && <th className={'p-2'}>{t('dataSync.status')}</th>}
                {visibleColumns.progress && <th className={'p-2'}>{t('dataSync.progress')}</th>}
                {visibleColumns.newUpdated && <th className={'p-2'}>{t('dataSync.newUpdated')}</th>}
                {visibleColumns.startedAt && <th className={'p-2'}>{t('dataSync.startedAt')}</th>}
                {visibleColumns.actions && <th className={'p-2'}>{t('dataSync.actions')}</th>}
              </tr>
            </thead>

            <tbody>
              {jobs?.map(
                ({ id, status, progress, total: jobTotal, newCount, updatedCount, createdAt }) => (
                  <tr key={id} className={'border-b border-border align-middle'}>
                    {visibleColumns.jobId && (
                      <td className={'p-2 font-mono text-xs select-all break-all align-middle'}>
                        {id}
                      </td>
                    )}

                    {visibleColumns.status && (
                      <td className={'p-2 align-middle'}>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold inline-block ${
                            status === 'completed'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : status === 'failed'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : status === 'saving'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : status === 'cancelled'
                                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                    : status === 'paused'
                                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}
                        >
                          {getStatusLabel(status)}
                        </span>
                      </td>
                    )}

                    {visibleColumns.progress && (
                      <td className={'p-2 align-middle'}>
                        <div className={'w-full bg-secondary rounded h-2.5 mb-1'}>
                          <div
                            className={'bg-primary h-2.5 rounded'}
                            style={{
                              width: `${jobTotal > 0 ? (progress / jobTotal) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className={'text-xs text-muted-foreground'}>
                          {progress}
                          {' / '}
                          {jobTotal}
                          {` ${t('dataSync.chunks')}`}
                        </span>
                      </td>
                    )}

                    {visibleColumns.newUpdated && (
                      <td className={'p-2 align-middle'}>
                        {newCount}
                        {' / '}
                        {updatedCount}
                      </td>
                    )}

                    {visibleColumns.startedAt && (
                      <td className={'p-2 text-sm text-muted-foreground align-middle'}>
                        {new Date(createdAt).toLocaleString()}
                      </td>
                    )}

                    {visibleColumns.actions && (
                      <td className={'p-2 align-middle'}>
                        <div className={'flex items-center gap-2 flex-wrap'}>
                          {(status === 'running' ||
                            status === 'pending' ||
                            status === 'paused') && (
                            <Button
                              type={'button'}
                              variant={'outline'}
                              size={'sm'}
                              onClick={() => {
                                void handleCancel(id);
                              }}
                              disabled={cancelMutation.isPending}
                            >
                              {t('dataSync.cancel')}
                            </Button>
                          )}
                          {status === 'running' && (
                            <Button
                              type={'button'}
                              variant={'outline'}
                              size={'sm'}
                              onClick={() => {
                                void handlePause(id);
                              }}
                              disabled={pauseMutation.isPending}
                            >
                              {t('dataSync.pause')}
                            </Button>
                          )}
                          {status === 'paused' && (
                            <Button
                              type={'button'}
                              variant={'outline'}
                              size={'sm'}
                              onClick={() => {
                                void handleResume(id);
                              }}
                              disabled={resumeMutation.isPending}
                            >
                              {t('dataSync.resume')}
                            </Button>
                          )}
                          {(status === 'failed' || status === 'cancelled') && (
                            <Button
                              type={'button'}
                              variant={'outline'}
                              size={'sm'}
                              onClick={() => {
                                void handleRetry(id);
                              }}
                              disabled={retryMutation.isPending}
                            >
                              {t('dataSync.retry')}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ),
              )}

              {(!jobs || jobs.length === 0) && (
                <tr>
                  <td
                    colSpan={activeColumnCount}
                    className={'p-4 text-center text-muted-foreground'}
                  >
                    {t('dataSync.noJobs')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div
          className={
            'flex justify-between items-center pt-4 border-t border-border flex-wrap gap-4'
          }
        >
          <div className={'flex items-center gap-2 text-sm text-muted-foreground'}>
            <span>{t('dataSync.rowsPerPage')}</span>

            <Select
              className={'text-sm'}
              value={limit}
              onChange={e => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>{'10'}</option>
              <option value={25}>{'25'}</option>
              <option value={50}>{'50'}</option>
            </Select>

            <span>
              {t('dataSync.total')} {total} {t('dataSync.jobs')}
            </span>
          </div>

          <div className={'flex items-center gap-2'}>
            <Button
              variant={'outline'}
              size={'sm'}
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page <= 1}
            >
              {t('dataSync.previous')}
            </Button>

            <span className={'text-sm text-muted-foreground'}>
              {t('dataSync.pageOf', { page, totalPages })}
            </span>

            <Button
              variant={'outline'}
              size={'sm'}
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
            >
              {t('dataSync.next')}
            </Button>
          </div>
        </div>
      </Card>

      {isUploadOpen && (
        <PrivatBankUploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onSuccess={() => {
            setIsUploadOpen(false);
            void refetchJobs();
          }}
        />
      )}
    </div>
  );
}
