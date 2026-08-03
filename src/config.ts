export interface RuntimeConfig {
  defaultDifficulty: number;
  maxPremoves: number;
  enableClocks: boolean;
  analyticsUrl?: string;
}

declare global {
  interface Window {
    __JCHESS_CONFIG__?: Partial<RuntimeConfig>;
  }
}

const DEFAULT_CONFIG: RuntimeConfig = {
  defaultDifficulty: 4,
  maxPremoves: 3,
  enableClocks: false,
};

export function getConfig(): RuntimeConfig {
  const windowConfig =
    typeof window !== "undefined" ? window.__JCHESS_CONFIG__ : undefined;
  return {
    ...DEFAULT_CONFIG,
    ...windowConfig,
  };
}
