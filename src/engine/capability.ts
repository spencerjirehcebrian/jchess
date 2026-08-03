import { EngineCapabilities } from "./types";

export function detectCapabilities(): EngineCapabilities {
  const threaded =
    typeof SharedArrayBuffer !== "undefined" &&
    typeof self !== "undefined" &&
    self.crossOriginIsolated === true;

  const maxThreads = threaded
    ? Math.max(
        1,
        Math.min(
          4,
          (typeof navigator !== "undefined"
            ? (navigator.hardwareConcurrency ?? 2)
            : 2) - 1,
        ),
      )
    : 1;

  return {
    threaded,
    maxThreads,
    flavor: threaded ? "lite-multi" : "lite-single",
  };
}
