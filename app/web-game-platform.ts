export type WebGamePlatform = "standalone" | "crazygames" | "poki";

type PlatformDetectionInput = {
  hostname: string;
  search?: string;
  referrer?: string;
};

type CrazyGamesSdk = {
  init: () => Promise<unknown>;
  game: {
    gameplayStart: () => unknown;
    gameplayStop: () => unknown;
  };
};

type PokiSdk = {
  init: () => Promise<unknown>;
  gameLoadingFinished: () => unknown;
  gameplayStart: () => unknown;
  gameplayStop: () => unknown;
};

declare global {
  interface Window {
    CrazyGames?: { SDK?: CrazyGamesSdk };
    PokiSDK?: PokiSdk;
  }
}

const CRAZYGAMES_SDK_URL =
  "https://sdk.crazygames.com/crazygames-sdk-v3.js";
const POKI_SDK_URL = "https://game-cdn.poki.com/scripts/v2/poki-sdk.js";

export function detectWebGamePlatform({
  hostname,
  search = "",
  referrer = "",
}: PlatformDetectionInput): WebGamePlatform {
  const query = new URLSearchParams(search);
  const explicit = query.get("platform");
  if (explicit === "crazygames" || query.get("useLocalSdk") === "true")
    return "crazygames";
  if (explicit === "poki") return "poki";
  const context = `${hostname} ${referrer}`.toLowerCase();
  if (context.includes("crazygames.com")) return "crazygames";
  if (context.includes("poki.com") || context.includes("poki-gdn.com"))
    return "poki";
  return "standalone";
}

function currentPlatform() {
  if (typeof window === "undefined") return "standalone" as const;
  return detectWebGamePlatform({
    hostname: window.location.hostname,
    search: window.location.search,
    referrer: document.referrer,
  });
}

function loadScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    const script = existing ?? document.createElement("script");
    const loaded = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    const failed = () => reject(new Error(`Unable to load ${id}`));
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.id = id;
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

let platformPromise: Promise<WebGamePlatform> | null = null;
let loadingFinished = false;
let desiredPlaying = false;
let reportedPlaying = false;
let syncChain = Promise.resolve();

async function initializePlatform(): Promise<WebGamePlatform> {
  const platform = currentPlatform();
  if (platform === "standalone") return platform;
  try {
    if (platform === "crazygames") {
      if (!window.CrazyGames?.SDK)
        await loadScript("crazygames-sdk", CRAZYGAMES_SDK_URL);
      await window.CrazyGames?.SDK?.init();
    } else {
      if (!window.PokiSDK) await loadScript("poki-sdk", POKI_SDK_URL);
      await window.PokiSDK?.init().catch(() => undefined);
    }
  } catch {
    // Platform SDK failures must never block the game itself.
  }
  return platform;
}

function readyPlatform() {
  platformPromise ??= initializePlatform();
  return platformPromise;
}

export function reportPlatformLoaded() {
  void readyPlatform().then((platform) => {
    if (loadingFinished) return;
    loadingFinished = true;
    if (platform === "poki") window.PokiSDK?.gameLoadingFinished();
  });
}

async function syncGameplayState() {
  const platform = await readyPlatform();
  if (platform === "standalone" || desiredPlaying === reportedPlaying) return;
  if (desiredPlaying) {
    if (platform === "crazygames") {
      if (!window.CrazyGames?.SDK?.game) return;
      await window.CrazyGames.SDK.game.gameplayStart();
    } else {
      if (!window.PokiSDK) return;
      await window.PokiSDK.gameplayStart();
    }
    reportedPlaying = true;
  } else if (reportedPlaying) {
    if (platform === "crazygames") {
      if (!window.CrazyGames?.SDK?.game) return;
      await window.CrazyGames.SDK.game.gameplayStop();
    } else {
      if (!window.PokiSDK) return;
      await window.PokiSDK.gameplayStop();
    }
    reportedPlaying = false;
  }
}

function scheduleGameplaySync() {
  syncChain = syncChain.then(syncGameplayState).catch(() => undefined);
}

export function reportPlatformGameplayStart() {
  desiredPlaying = true;
  scheduleGameplaySync();
}

export function reportPlatformGameplayStop() {
  desiredPlaying = false;
  scheduleGameplaySync();
}
