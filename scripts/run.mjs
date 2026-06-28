#!/usr/bin/env node
/**
 * Запуск: npm run tunnel
 * Поднимает cloudflared + сервер, обновляет .env и Telegram menu button.
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const PORT = 3000;

function loadEnv() {
  try {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch {
    console.error("Создайте .env из .env.example");
    process.exit(1);
  }
}

function saveWebAppUrl(url) {
  let text = readFileSync(envPath, "utf8");
  if (/^WEBAPP_URL=/m.test(text)) {
    text = text.replace(/^WEBAPP_URL=.*/m, `WEBAPP_URL=${url}`);
  } else {
    text += `\nWEBAPP_URL=${url}\n`;
  }
  writeFileSync(envPath, text);
  process.env.WEBAPP_URL = url;
}

function killOld() {
  for (const pattern of [
    "cloudflared tunnel --url http://localhost:3000",
    "node dist/server/index.js",
  ]) {
    try {
      spawn("pkill", ["-f", pattern]);
    } catch {
      /* ignore */
    }
  }
}

async function waitForTunnelUrl(proc) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Туннель не поднялся за 30 сек")), 30000);
    const onData = (chunk) => {
      const text = chunk.toString();
      process.stderr.write(text);
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timeout);
        proc.stdout?.off("data", onData);
        proc.stderr?.off("data", onData);
        resolve(match[0]);
      }
    };
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`cloudflared exited: ${code}`));
    });
  });
}

function startServer() {
  const child = spawn("node", ["dist/server/index.js"], {
    cwd: root,
    env: { ...process.env },
    stdio: "inherit",
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  return child;
}

async function main() {
  loadEnv();

  console.log("Останавливаю старые процессы...");
  killOld();
  await new Promise((r) => setTimeout(r, 2000));

  console.log("Запускаю Cloudflare tunnel...");
  const tunnel = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${PORT}`], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let url;
  try {
    url = await waitForTunnelUrl(tunnel);
  } catch (e) {
    console.error(e.message);
    console.error("\nУстановите cloudflared: brew install cloudflared");
    process.exit(1);
  }

  saveWebAppUrl(url);

  console.log("\n============================================");
  console.log(`  Mini App URL: ${url}`);
  console.log("============================================");
  console.log("\nURL сохранён в .env и будет отправлен в Telegram.");
  console.log("Откройте @picksmapsmeta_bot → /start → кнопка внизу экрана.");
  console.log("НЕ используйте старые ссылки!\n");

  const server = startServer();

  tunnel.on("exit", (code) => {
    console.error(`\n⚠️  Туннель упал (code ${code}). Error 1033 — перезапустите: npm run tunnel`);
    server.kill();
    process.exit(1);
  });

  process.on("SIGINT", () => {
    tunnel.kill();
    server.kill();
    process.exit(0);
  });
}

main();
