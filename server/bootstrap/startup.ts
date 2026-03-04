import { loadAndValidateRuntimeEnv, type RuntimeEnv, type RuntimeEnvOptions } from './runtime-env.js';

export const bootstrapRuntime = (options: RuntimeEnvOptions = {}): RuntimeEnv => {
  const runtimeEnv = loadAndValidateRuntimeEnv(options);
  return runtimeEnv;
};
