// OpenRouter routes only to providers at or below these USD-per-million-token rates.
export const MAX_PROVIDER_PRICE = { prompt: 5, completion: 15, request: 0 } as const;
export const DEFAULT_FACT_CHECK_MODEL = 'z-ai/glm-5.3';
export const PINNED_GLM_53 = 'z-ai/glm-5.3-20260816';

export function isDefaultFactCheckModel(model: string) {
  return model === DEFAULT_FACT_CHECK_MODEL || model === PINNED_GLM_53;
}

/** The request and its reservation must use the same provider price limits. */
export function factCheckModelRoute(model: string) {
  if (!isDefaultFactCheckModel(model)) {
    return { model, provider: { require_parameters: true, allow_fallbacks: false, max_price: MAX_PROVIDER_PRICE } };
  }
  return {
    model: PINNED_GLM_53,
    provider: {
      require_parameters: true,
      allow_fallbacks: false,
      only: ['wafer/us', 'inference-net/us', 'inference-net/fp4'],
      max_price: { prompt: 0.1, completion: 5, request: 0 },
    },
  };
}

/** Conservative reservation from caller-supplied hard token ceilings and tool fees. */
export function maximumRequestCost(inputTokenCeiling: number, outputTokenCeiling: number, toolFeeUsd = 0, model?: string): number {
  if (![inputTokenCeiling, outputTokenCeiling].every((value) => Number.isSafeInteger(value) && value >= 0) || !Number.isFinite(toolFeeUsd) || toolFeeUsd < 0) throw new Error('Invalid cost ceiling');
  const price = model ? factCheckModelRoute(model).provider.max_price : MAX_PROVIDER_PRICE;
  return (inputTokenCeiling * price.prompt + outputTokenCeiling * price.completion) / 1_000_000 + toolFeeUsd;
}
