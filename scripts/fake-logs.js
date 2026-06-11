#!/usr/bin/env node
/* eslint-disable */

const SERVICES = [
  "card-issuer",
  "sol-gateway",
  "tx-monitor",
  "auth-service",
  "rpc-relay",
  "ledger-sync",
  "vault",
  "fraud-engine",
  "kms",
  "card-vault",
  "balance-svc",
  "webhook-dispatcher",
  "rate-limiter",
  "cron-runner",
  "settlement",
];

const NETWORKS = ["solana-mainnet", "solana-devnet"];
const LEVELS = ["INFO", "INFO", "INFO", "INFO", "INFO", "DEBUG", "DEBUG", "WARN"];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randHex(len) {
  const c = "abcdef0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function randBase58(len) {
  const c = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function maskCard() {
  return `**** **** **** ${randInt(1000, 9999)}`;
}

function sol(amount) {
  return `${amount.toFixed(3)} SOL`;
}

function ts() {
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}Z`;
}

function log(line) {
  process.stdout.write(`${line}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TEMPLATES = [
  () => {
    const amt = +(Math.random() * 5 + 0.05).toFixed(3);
    return `payment received tx=${randBase58(44)} amount=${sol(amt)} network=${rand(NETWORKS)} confirmations=${randInt(15, 32)}`;
  },
  () =>
    `card issued card_id=card_${randHex(16)} masked=${maskCard()} tier=${rand(["virtual", "virtual-plus", "metal"])} status=active`,
  () =>
    `card balance topped up card_id=card_${randHex(12)} delta=+$${randInt(20, 2000)}.${randInt(10, 99)} new_balance=$${randInt(50, 9800)}.${randInt(10, 99)}`,
  () =>
    `auth approved card=${maskCard()} merchant="${rand(["Amazon", "Steam", "Uber", "Apple", "Spotify", "Cloudflare", "Vercel", "DigitalOcean", "Booking.com", "Netflix"])}" amount=$${randInt(2, 240)}.${randInt(10, 99)} mcc=${randInt(4000, 7999)} risk=${randInt(1, 18)}`,
  () =>
    `auth declined reason=${rand(["insufficient_funds", "velocity_limit", "merchant_blocked", "geo_mismatch"])} card=${maskCard()} attempt=${randInt(1, 4)}`,
  () =>
    `solana rpc ok endpoint=${rand(["mainnet.helius", "rpc.helius", "rpc.triton"])} slot=${randInt(245_000_000, 260_000_000)} latency=${randInt(38, 220)}ms`,
  () =>
    `block scanned slot=${randInt(245_000_000, 260_000_000)} txs=${randInt(800, 3400)} matched=${randInt(0, 6)} took=${randInt(110, 480)}ms`,
  () =>
    `webhook delivered url=https://api.internal/cards/events status=200 event=card.authorization.created took=${randInt(40, 220)}ms`,
  () =>
    `fraud-engine score card=${maskCard()} score=${(Math.random() * 0.3).toFixed(2)} model=v3.2 action=allow`,
  () => `kms unsealed key_id=k_${randHex(10)} grants=${randInt(2, 6)} ttl=${randInt(300, 3600)}s`,
  () => `vault rotation ok keyring=card-pan rotated=${randInt(1, 12)} pending=0`,
  () =>
    `settlement batch ok batch_id=stl_${randHex(10)} cards=${randInt(120, 9800)} volume=$${(Math.random() * 80000 + 5000).toFixed(2)} duration=${randInt(800, 3200)}ms`,
  () => `ledger reconciled period=${randInt(1, 24)}h drift=$0.00 entries=${randInt(2400, 18900)}`,
  () => `rate-limiter ok bucket=public/issue tokens=${randInt(40, 120)}/120 refilled=${randInt(1, 30)}`,
  () => `cron tick job=balance-sweep ran_for=${randInt(220, 1100)}ms cards_touched=${randInt(40, 4000)}`,
  () =>
    `sol payment confirmed signer=${randBase58(44)} memo="card-topup:card_${randHex(8)}" lamports=${randInt(50_000_000, 5_000_000_000)}`,
  () => `health ok db=ok redis=ok solana=ok issuer_api=ok queue_depth=${randInt(0, 14)}`,
  () => `queue drained queue=card.issuance processed=${randInt(1, 24)} failed=0 avg_ms=${randInt(80, 320)}`,
  () =>
    `card 3ds challenge passed card=${maskCard()} merchant_country=${rand(["US", "DE", "GB", "FR", "AE", "JP", "CA"])}`,
  () => `auth-service signed in admin=ops@internal scope=read,write mfa=ok`,
  () => `metrics flushed datapoints=${randInt(800, 4200)} sink=prom duration=${randInt(20, 90)}ms`,
  () =>
    `no-kyc onboarding complete wallet=${randBase58(44)} card_id=card_${randHex(10)} kyc=skipped tier=standard`,
  () =>
    `card spend limit updated card=${maskCard()} daily_limit=$${randInt(500, 5000)} monthly_limit=$${randInt(2000, 25000)}`,
  () =>
    `sol deposit matched wallet=${randBase58(44)} amount=${sol(+(Math.random() * 8 + 0.1).toFixed(3))} card_funded=true`,
];

function makeLine() {
  const tpl = rand(TEMPLATES);
  const level = rand(LEVELS);
  const svc = rand(SERVICES);
  return `${ts()}  ${level.padEnd(5)} [${svc}] ${tpl()}`;
}

function startupBanner() {
  const lines = [
    `${ts()}  INFO  [bootstrap] starting card-platform node=node-${randInt(1, 12)} region=${rand(["us-east-1", "eu-central-1", "ap-southeast-1"])}`,
    `${ts()}  INFO  [bootstrap] config loaded env=production features=card.v3,sol.payments,no-kyc`,
    `${ts()}  INFO  [bootstrap] connected db=primary pool=20 latency=${randInt(2, 12)}ms`,
    `${ts()}  INFO  [bootstrap] solana rpc connected cluster=mainnet slot=${randInt(245_000_000, 260_000_000)}`,
    `${ts()}  INFO  [bootstrap] kms ready keys=4 rotation=ok`,
    `${ts()}  INFO  [bootstrap] issuer api handshake ok partner=internal-bin sandbox=false`,
    `${ts()}  INFO  [bootstrap] ready listening=0.0.0.0:8080`,
  ];
  for (const line of lines) log(line);
}

function parseIntervalSeconds() {
  const intervalArg = process.argv.find((a) => a.startsWith("--interval="));
  if (intervalArg) {
    const seconds = parseInt(intervalArg.split("=")[1], 10);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 15;
  }
  return 60;
}

async function emitBurst(count) {
  for (let i = 0; i < count; i++) {
    log(makeLine());
    if (i < count - 1) {
      await sleep(randInt(120, 450));
    }
  }
}

async function run() {
  const intervalSeconds = parseIntervalSeconds();
  const burstSize = intervalSeconds >= 60 ? randInt(3, 6) : randInt(2, 4);

  startupBanner();
  log("");
  log(`${ts()}  INFO  [bootstrap] live stream active — activity burst every ${intervalSeconds}s (Ctrl+C to stop)`);
  log("");

  await emitBurst(burstSize);

  let secondsLeft = intervalSeconds;

  const countdown = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      secondsLeft = intervalSeconds;
    }
    process.stdout.write(`\r${ts()}  DEBUG [bootstrap] next activity burst in ${secondsLeft}s   `);
  }, 1000);

  const tick = setInterval(async () => {
    process.stdout.write("\r\x1b[K");
    await emitBurst(randInt(3, 6));
    secondsLeft = intervalSeconds;
  }, intervalSeconds * 1000);

  process.on("SIGINT", () => {
    clearInterval(countdown);
    clearInterval(tick);
    process.stdout.write("\r\x1b[K");
    log(`${ts()}  INFO  [bootstrap] shutting down (signal=SIGINT)`);
    process.exit(0);
  });
}

run();
