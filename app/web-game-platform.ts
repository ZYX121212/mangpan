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
    inviteLink?: (params: Record<string, string>) => string | Promise<string>;
    inviteParams?: Record<string, string> | null;
    getInviteParam?: (key: string) => string | null;
  };
  user?: {
    systemInfo?: { locale?: string };
  };
};

type PokiSdk = {
  init: () => Promise<unknown>;
  gameLoadingFinished: () => unknown;
  gameplayStart: () => unknown;
  gameplayStop: () => unknown;
  shareableURL?: (params: Record<string, string>) => Promise<string>;
  getURLParam?: (key: string) => string | null;
};

export type WebGameLaunchContext = {
  platform: WebGamePlatform;
  duelCode: string | null;
  crewCode: string | null;
  locale: "en" | "es" | "fr" | "zh" | null;
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

export function currentWebGamePlatform() {
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
  const platform = currentWebGamePlatform();
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

export function normalizePlatformDuelCode(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{8,12}$/.test(normalized) ? normalized : null;
}

function platformLocale(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("fr")) return "fr";
  return "en";
}

export async function getWebGameLaunchContext(): Promise<WebGameLaunchContext> {
  const platform = await readyPlatform();
  if (platform === "crazygames") {
    const game = window.CrazyGames?.SDK?.game;
    const duelCode = normalizePlatformDuelCode(
      game?.inviteParams?.duel ?? game?.getInviteParam?.("duel"),
    );
    return {
      platform,
      duelCode,
      crewCode: normalizePlatformDuelCode(
        game?.inviteParams?.crew ?? game?.getInviteParam?.("crew"),
      ),
      locale:
        platformLocale(window.CrazyGames?.SDK?.user?.systemInfo?.locale) ?? "en",
    };
  }
  if (platform === "poki") {
    return {
      platform,
      duelCode: normalizePlatformDuelCode(window.PokiSDK?.getURLParam?.("duel")),
      crewCode: normalizePlatformDuelCode(window.PokiSDK?.getURLParam?.("crew")),
      locale: null,
    };
  }
  return { platform, duelCode: null, crewCode: null, locale: null };
}

async function createPlatformShareUrl(
  key: "duel" | "crew",
  code: string,
  standaloneUrl: string,
) {
  const normalized = normalizePlatformDuelCode(code);
  if (!normalized) return null;
  const platform = await readyPlatform();
  if (platform === "standalone") return standaloneUrl;
  try {
    if (platform === "crazygames") {
      const inviteLink = window.CrazyGames?.SDK?.game.inviteLink;
      if (!inviteLink) return null;
      return await inviteLink({ [key]: normalized });
    }
    const shareableURL = window.PokiSDK?.shareableURL;
    if (!shareableURL) return null;
    return await shareableURL({ [key]: normalized });
  } catch {
    // Never leak portal traffic to a separately playable website as fallback.
    return null;
  }
}

export function createPlatformDuelShareUrl(
  duelCode: string,
  standaloneUrl: string,
) {
  return createPlatformShareUrl("duel", duelCode, standaloneUrl);
}

export function createPlatformCrewShareUrl(
  crewCode: string,
  standaloneUrl: string,
) {
  return createPlatformShareUrl("crew", crewCode, standaloneUrl);
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
