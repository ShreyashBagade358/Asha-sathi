import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { listPredictions } from '@/patient/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/components/ui/Toast';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

import type { AIPrediction } from './types';

type Mode = 'ncd' | 'maternal';

const MODEL_OF: Record<Mode, string> = { ncd: 'ncd_risk', maternal: 'maternal_risk' };

const LEVEL_TONE: Record<string, 'error' | 'warning' | 'success'> = {
  high: 'error',
  moderate: 'warning',
  medium: 'warning',
  low: 'success',
};

function levelOf(prediction: AIPrediction, mode: Mode): string {
  const body = prediction.prediction ?? {};
  const raw = mode === 'ncd' ? body.overall_risk : body.risk_level;
  const level = typeof raw === 'string' ? raw : '';
  return level || 'low';
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface RiskPredictionCardProps {
  /** Beneficiary whose predictions are read and stored. */
  beneficiaryId?: string;
  mode: Mode;
  /** Builds the feature payload from the caller's own profile data. */
  onRun: () => Promise<AIPrediction>;
}

/**
 * Port of the web's RiskPredictionCard: shows the newest stored ML risk
 * assessment for one beneficiary and lets the caller run a fresh one. Data
 * comes from `GET /ai/predictions`; running posts to `/ai/{ncd,maternal}-risk
 * /predict`, which persists the result, so the list and the run always agree.
 */
export function RiskPredictionCard({ beneficiaryId, mode, onRun }: RiskPredictionCardProps) {
  const { t } = useLocalization();
  const { toast } = useToast();
  const [predictions, setPredictions] = useState<AIPrediction[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    if (!beneficiaryId) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      const rows = await listPredictions(beneficiaryId, 50);
      setPredictions(rows);
      setStatus('ready');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus('failed');
    }
  }, [beneficiaryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = predictions.find((p) => p.modelName === MODEL_OF[mode]);

  const run = async () => {
    if (running || !beneficiaryId) return;
    setRunning(true);
    try {
      const created = await onRun();
      setPredictions((old) => [created, ...old.filter((p) => p.id !== created.id)]);
    } catch (err) {
      toast(`${t('ai.failed')}: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const level = latest ? levelOf(latest, mode) : '';
  const factors = latest?.explanation?.risk_factors ?? [];

  return (
    <Card className="overflow-hidden">
      <View className="flex-row items-center justify-between gap-3 border-b border-outline-variant/60 px-4 py-4">
        <View className="flex-1 flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-container">
            <Icon name="activity" size={20} color={colors.onPrimaryContainer} />
          </View>
          <View className="flex-1">
            <Text className="font-headline-md text-headline-md text-on-surface">
              {mode === 'ncd' ? t('ai.titleNcd') : t('ai.titleMaternal')}
            </Text>
            <Text className="font-caption text-caption text-on-surface-variant">
              {t('ai.subtitle')}
            </Text>
          </View>
        </View>
        <Button
          label={latest ? t('ai.rerun') : t('ai.run')}
          shape="pill"
          loading={running}
          disabled={!beneficiaryId || status === 'loading'}
          onPress={() => void run()}
          testID="risk-run"
        />
      </View>

      {!beneficiaryId ? (
        <Text className="px-4 py-6 text-center font-body-md text-body-md text-on-surface-variant">
          {t('ai.needsBeneficiary')}
        </Text>
      ) : status === 'loading' ? (
        <LoadingState />
      ) : status === 'failed' ? (
        <ErrorState message={errorMessage ?? t('common.errorMsg')} onRetry={() => void load()} />
      ) : !latest ? (
        <View className="items-center px-4 py-6">
          <Text className="font-body-md text-body-md font-medium text-on-surface">
            {t('ai.none')}
          </Text>
          <Text className="mt-1 text-center font-caption text-caption text-on-surface-variant">
            {t('ai.noneHint')}
          </Text>
        </View>
      ) : (
        <View className="gap-3 px-4 py-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <Chip tone={LEVEL_TONE[level] ?? 'success'}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </Chip>
            {latest.confidence != null ? (
              <Text className="font-caption text-caption text-on-surface-variant">
                {t('ai.confidence')}: {Math.round(latest.confidence * 100)}%
              </Text>
            ) : null}
            <Text className="font-caption text-caption text-outline">
              {formatDateTime(latest.createdAt)}
              {latest.modelVersion ? ` · v${latest.modelVersion}` : ''}
            </Text>
          </View>

          {factors.length > 0 ? (
            <View>
              <Text className="mb-2 font-caption text-caption uppercase text-on-surface-variant">
                {t('ai.factors')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {factors.map((factor) => (
                  <Chip key={factor} tone="neutral">
                    {factor}
                  </Chip>
                ))}
              </View>
            </View>
          ) : null}

          <Text className="font-caption text-caption text-on-surface-variant">
            {t('ai.disclaimer')}
          </Text>
        </View>
      )}
    </Card>
  );
}
