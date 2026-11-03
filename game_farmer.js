// File: game_farmer.js
// Runtime: Node.js 18+ ('ws' package garjecha aahe)

const WebSocket = require('ws');
const http = require('http');

// 1. Render HTTP Server (0.0.0.0 var port chalu thevnyasathi)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Brawlhalla farmer 24/7 chalu aahe!\n');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP SERVER] Port ${PORT} var server chalu aahe`);
});

// 2. Render Environment Variables madhun Token ghene
const RAW_TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN || "";
const TOKEN = RAW_TOKEN.trim().replace(/^["']|["']$/g, '');

if (!TOKEN) {
  console.error("[ERROR] Render Environment Variables madhe DISCORD_TOKEN kinva TOKEN sapadla nahi!");
  process.exit(1);
}

// 3. Brawlhalla cha achuk Application ID
const GAME_NAME = "Brawlhalla";
const GAME_APP_ID = "356944273133928458"; 

const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

let ws;
let heartbeatInterval;
let lastSequence = null;
let sessionStartTime = Date.now();
let isResetting = false;

function getPresencePayload(clear = false) {
  return {
    op: 3,
    d: {
      since: clear ? null : sessionStartTime,
      activities: clear ? [] : [
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
    console.log("[BRAWLHALLA] Discord Gateway shi jodle gele aahe.");
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
          presence: getPresencePayload(isResetting).d,
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
      console.log(`[BRAWLHALLA] ${d.user.username} mhanun login jhale. ${GAME_NAME} che taas mojane suru aahe!`);
      ws.send(JSON.stringify(getPresencePayload(false)));
    }
  });

  ws.on('close', (code) => {
    console.log(`[BRAWLHALLA] Connection band jhale (${code}). 5 sekandat punha jodat aahe...`);
    clearInterval(heartbeatInterval);
    setTimeout(startGameFarmer, 5000);
  });

  ws.on('error', (err) => {
    console.error("[BRAWLHALLA] Error:", err.message);
  });
}

// Dar 15 minitanni presence refresh karne
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN && !isResetting) {
    ws.send(JSON.stringify(getPresencePayload(false)));
  }
}, 15 * 60 * 1000);

// Dar 45 minitanni session save karnyasathi 15 sekandacha break gheun punha suru karne
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("[BRAWLHALLA] Badge var taas save karnyasathi session refresh karat aahe...");
    isResetting = true;
    ws.send(JSON.stringify(getPresencePayload(true)));

    setTimeout(() => {
      sessionStartTime = Date.now();
      isResetting = false;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(getPresencePayload(false)));
        console.log("[BRAWLHALLA] Navin session suru jhale. Playtime server var save jhala aahe!");
      }
    }, 15 * 1000);
  }
}, 45 * 60 * 1000);

startGameFarmer();
