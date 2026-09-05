import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  detectWebGamePlatform,
  normalizePlatformDuelCode,
} from "../app/web-game-platform.ts";

test("detects CrazyGames only in its portal context or explicit preview", () => {
  assert.equal(
    detectWebGamePlatform({
      hostname: "games.crazygames.com",
      referrer: "https://www.crazygames.com/game/blind-trading",
    }),
    "crazygames",
  );
  assert.equal(
    detectWebGamePlatform({ hostname: "localhost", search: "?useLocalSdk=true" }),
    "crazygames",
  );
  assert.equal(
    detectWebGamePlatform({ hostname: "localhost", search: "?platform=crazygames" }),
    "crazygames",
  );
});

test("detects Poki CDN, referrer, and explicit inspector previews", () => {
  assert.equal(
    detectWebGamePlatform({ hostname: "game-cdn.poki-gdn.com" }),
    "poki",
  );
  assert.equal(
    detectWebGamePlatform({
      hostname: "example.invalid",
      referrer: "https://poki.com/en/g/blind-trading",
    }),
    "poki",
  );
  assert.equal(
    detectWebGamePlatform({ hostname: "localhost", search: "?platform=poki" }),
    "poki",
  );
});

test("keeps the standalone site free of portal SDK requests", () => {
  assert.equal(
    detectWebGamePlatform({
      hostname: "mangpan-kline-game.hiayun.chatgpt.site",
    }),
    "standalone",
  );
});

test("accepts only safe platform duel codes before routing", () => {
  assert.equal(normalizePlatformDuelCode(" ab12cd34 "), "AB12CD34");
  assert.equal(normalizePlatformDuelCode("ABC"), null);
  assert.equal(normalizePlatformDuelCode("../../daily"), null);
  assert.equal(normalizePlatformDuelCode("AB12-CD34"), null);
});

test("creates CrazyGames-native room links and reads launch context", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  let initialized = 0;
  globalThis.window = {
    location: {
      hostname: "games.crazygames.com",
      search: "",
    },
    CrazyGames: {
      SDK: {
        init: async () => {
          initialized += 1;
        },
        game: {
          gameplayStart() {},
          gameplayStop() {},
          inviteParams: { duel: "AB12CD34" },
          inviteLink: ({ duel, crew }) =>
            `https://www.crazygames.com/game/blind-trading?room=${duel ?? crew}`,
        },
        user: { systemInfo: { locale: "zh-CN" } },
      },
    },
  };
  globalThis.document = { referrer: "https://www.crazygames.com/" };
  try {
    const adapter = await import(
      `../app/web-game-platform.ts?crazy-native=${Date.now()}`
    );
    assert.deepEqual(await adapter.getWebGameLaunchContext(), {
      platform: "crazygames",
      duelCode: "AB12CD34",
      crewCode: null,
      locale: "zh",
    });
    assert.equal(
      await adapter.createPlatformDuelShareUrl(
        "AB12CD34",
        "https://standalone.invalid/d/AB12CD34",
      ),
      "https://www.crazygames.com/game/blind-trading?room=AB12CD34",
    );
    assert.equal(initialized, 1);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("reads a Spanish portal locale for the international first-play path", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = {
    location: { hostname: "games.crazygames.com", search: "" },
    CrazyGames: {
      SDK: {
        async init() {},
        game: { gameplayStart() {}, gameplayStop() {} },
        user: { systemInfo: { locale: "es-MX" } },
      },
    },
  };
  globalThis.document = { referrer: "https://www.crazygames.com/" };
  try {
    const adapter = await import(
      `../app/web-game-platform.ts?crazy-spanish=${Date.now()}`
    );
    assert.equal((await adapter.getWebGameLaunchContext()).locale, "es");
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("reads a Turkish portal locale for the international first-play path", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = {
    location: { hostname: "games.crazygames.com", search: "" },
    CrazyGames: {
      SDK: {
        async init() {},
        game: { gameplayStart() {}, gameplayStop() {} },
        user: { systemInfo: { locale: "tr-TR" } },
      },
    },
  };
  globalThis.document = { referrer: "https://www.crazygames.com/" };
  try {
    const adapter = await import(
      `../app/web-game-platform.ts?crazy-turkish=${Date.now()}`
    );
    assert.equal((await adapter.getWebGameLaunchContext()).locale, "tr");
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("creates Poki-native crew links and reads prefixed launch params", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = {
    location: { hostname: "game-cdn.poki-gdn.com", search: "" },
    PokiSDK: {
      async init() {},
      gameLoadingFinished() {},
      gameplayStart() {},
      gameplayStop() {},
      getURLParam: (key) => (key === "crew" ? "EF56GH78" : null),
      shareableURL: async ({ duel, crew }) =>
        `https://poki.com/en/g/blind-trading?gdroom=${duel ?? crew}`,
    },
  };
  globalThis.document = { referrer: "https://poki.com/" };
  try {
    const adapter = await import(
      `../app/web-game-platform.ts?poki-native=${Date.now()}`
    );
    assert.deepEqual(await adapter.getWebGameLaunchContext(), {
      platform: "poki",
      duelCode: null,
      crewCode: "EF56GH78",
      locale: null,
    });
    assert.equal(
      await adapter.createPlatformCrewShareUrl(
        "EF56GH78",
        "https://standalone.invalid/c/EF56GH78",
      ),
      "https://poki.com/en/g/blind-trading?gdroom=EF56GH78",
    );
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("deduplicates playable first-frame and pause lifecycle events", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  let starts = 0;
  let stops = 0;
  globalThis.window = {
    location: { hostname: "games.crazygames.com", search: "" },
    CrazyGames: {
      SDK: {
        async init() {},
        game: {
          gameplayStart() {
            starts += 1;
          },
          gameplayStop() {
            stops += 1;
          },
        },
      },
    },
  };
  globalThis.document = { referrer: "https://www.crazygames.com/" };
  try {
    const adapter = await import(
      `../app/web-game-platform.ts?first-frame=${Date.now()}`
    );
    adapter.reportPlatformGameplayStart();
    adapter.reportPlatformGameplayStart();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(starts, 1);

    adapter.reportPlatformGameplayStop();
    adapter.reportPlatformGameplayStop();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(stops, 1);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("adapts to the official portal lifecycle without blocking the game", async () => {
  const [platform, game, lobby, crew] = await Promise.all([
    readFile(new URL("../app/web-game-platform.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mode-lobby.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/c/[code]/crew-room-client.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(platform, /crazygames-sdk-v3\.js/);
  assert.match(platform, /game-cdn\.poki\.com\/scripts\/v2\/poki-sdk\.js/);
  assert.match(platform, /CrazyGames\.SDK\.game\.gameplayStart/);
  assert.match(platform, /CrazyGames\.SDK\.game\.gameplayStop/);
  assert.match(platform, /PokiSDK\?\.gameLoadingFinished/);
  assert.match(platform, /PokiSDK\.gameplayStart/);
  assert.match(platform, /PokiSDK\.gameplayStop/);
  assert.match(platform, /inviteLink\(\{ \[key\]: normalized \}\)/);
  assert.match(platform, /shareableURL\(\{ \[key\]: normalized \}\)/);
  assert.match(platform, /createPlatformCrewShareUrl/);
  assert.match(platform, /Never leak portal traffic to a separately playable website/);
  assert.match(platform, /Platform SDK failures must never block the game itself/);
  assert.match(game, /createPlatformDuelShareUrl/);
  assert.match(game, /router\.replace\(`\/d\/\$\{encodeURIComponent\(context\.duelCode\)\}`\)/);
  assert.match(game, /reportPlatformLoaded\(\)/);
  assert.match(game, /reportPlatformGameplayStart\(\)/);
  assert.match(game, /reportPlatformGameplayStop\(\)/);
  assert.match(game, /const platformGameplayActive = !\(/);
  assert.match(
    game,
    /platformGameplayActive = !\([\s\S]*trainingOpen[\s\S]*duelInviteOpen[\s\S]*challengeLoading[\s\S]*dailyExpired/,
  );
  assert.match(game, /useState\(Boolean\(initialDuel\)\)/);
  assert.match(game, /document\.hidden/);
  assert.match(game, /addEventListener\("visibilitychange", syncPlatformGameplay\)/);
  assert.doesNotMatch(game, /const hasStarted =/);
  assert.match(game, /const advance = async[\s\S]*reportPlatformGameplayStart\(\)/);
  assert.match(lobby, /reportPlatformLoaded\(\)/);
  assert.match(lobby, /getWebGameLaunchContext\(\)/);
  assert.match(lobby, /context\.crewCode/);
  assert.match(crew, /createPlatformCrewShareUrl/);
});
