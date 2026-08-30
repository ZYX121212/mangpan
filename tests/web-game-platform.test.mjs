import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { detectWebGamePlatform } from "../app/web-game-platform.ts";

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

test("adapts to the official portal lifecycle without blocking the game", async () => {
  const [platform, game, lobby] = await Promise.all([
    readFile(new URL("../app/web-game-platform.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mode-lobby.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(platform, /crazygames-sdk-v3\.js/);
  assert.match(platform, /game-cdn\.poki\.com\/scripts\/v2\/poki-sdk\.js/);
  assert.match(platform, /CrazyGames\.SDK\.game\.gameplayStart/);
  assert.match(platform, /CrazyGames\.SDK\.game\.gameplayStop/);
  assert.match(platform, /PokiSDK\?\.gameLoadingFinished/);
  assert.match(platform, /PokiSDK\.gameplayStart/);
  assert.match(platform, /PokiSDK\.gameplayStop/);
  assert.match(platform, /Platform SDK failures must never block the game itself/);
  assert.match(game, /reportPlatformLoaded\(\)/);
  assert.match(game, /reportPlatformGameplayStart\(\)/);
  assert.match(game, /reportPlatformGameplayStop\(\)/);
  assert.match(game, /const advance = async[\s\S]*reportPlatformGameplayStart\(\)/);
  assert.match(lobby, /reportPlatformLoaded\(\)/);
});
