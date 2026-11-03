// File: game_farmer.js
// Runtime: Node.js 18+ (requires 'ws' package)

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Brawlhalla Presence Farmer is active and running 24/7!\n');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP SERVER] Server is listening on port ${PORT}`);
});

const RAW_TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN || "";
const TOKEN = RAW_TOKEN.trim().replace(/^["']|["']$/g, '');

if (!TOKEN) {
  console.error("[ERROR] DISCORD_TOKEN or TOKEN not found in Render Environment Variables!");
  process.exit(1);
}

const GAME_NAME = "Brawlhalla";
const GAME_APP_ID = "118778495085182976"; 

const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

let ws;
let heartbeatInterval;
let lastSequence = null;
let sessionStartTime = Date.now();
let isSyncingBreak = false;

function getPresencePayload(clearActivity = false) {
  return {
    op: 3,
    d: {
      since: clearActivity ? null : sessionStartTime,
      activities: clearActivity ? [] : [
        {
          name: GAME_NAME,
          type: 0,
          application_id: GAME_APP_ID,
          timestamps: {
            start: sessionStartTime
          },
          flags: 1
        }
      ],
      status: "online",
      afk: false
    }
  };
}

function startGameFarmer() {
  ws = new WebSocket(GATEWAY_URL);

  ws.on('open', () => {
    console.log("[BRAWLHALLA FARMER] Connected to Discord Gateway.");
  });

  ws.on('message', (data) => {
    let payload;
    try {
      payload = JSON.parse(data);
    } catch (e) {
      return;
    }

    const { op, d, t, s } = payload;
    if (s !== null && s !== undefined) {
      lastSequence = s;
    }

    if (op === 10) {
      const interval = d.heartbeat_interval;
      clearInterval(heartbeatInterval);

      heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: 1, d: lastSequence }));
        }
      }, interval);

      const identifyPayload = {
        op: 2,
        d: {
          token: TOKEN,
          capabilities: 16381,
          properties: {
            os: "Windows",
            browser: "Discord Client",
            release_channel: "stable",
            client_version: "1.0.9152",
            os_version: "10.0.22631",
            os_arch: "x64",
            app_arch: "x64",
            system_locale: "en-US",
            has_client_mods: false,
            $os: "windows",
            $browser: "Discord Client",
            $device: "desktop"
          },
          presence: getPresencePayload(isSyncingBreak).d,
          compress: false,
          client_state: {
            guild_versions: {},
            highest_last_message_id: "0",
            read_state_version: 0,
            user_guild_settings_version: -1,
            user_settings_version: -1,
            private_channels_version: "0",
            api_code_version: 0
          }
        }
      };

      ws.send(JSON.stringify(identifyPayload));
    }

    if (op === 7 || op === 9) {
      ws.close();
    }

    if (t === "READY") {
      console.log(`[BRAWLHALLA FARMER] Logged in as ${d.user.username}. Clean presence active!`);
      ws.send(JSON.stringify(getPresencePayload(isSyncingBreak)));
    }
  });

  ws.on('close', (code) => {
    console.log(`[BRAWLHALLA FARMER] Connection closed (${code}). Reconnecting in 5s...`);
    clearInterval(heartbeatInterval);
    setTimeout(startGameFarmer, 5000);
  });

  ws.on('error', (err) => {
    console.error("[BRAWLHALLA FARMER] Error:", err.message);
  });
}

setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN && !isSyncingBreak) {
    ws.send(JSON.stringify(getPresencePayload(false)));
  }
}, 15 * 60 * 1000);

setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("[BRAWLHALLA FARMER] Refreshing session to sync playtime to badge...");
    isSyncingBreak = true;
    ws.send(JSON.stringify(getPresencePayload(true)));

    setTimeout(() => {
      sessionStartTime = Date.now();
      isSyncingBreak = false;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(getPresencePayload(false)));
        console.log("[BRAWLHALLA FARMER] Session successfully synced!");
      }
    }, 20 * 1000);
  }
}, 2 * 60 * 60 * 1000);

startGameFarmer();
