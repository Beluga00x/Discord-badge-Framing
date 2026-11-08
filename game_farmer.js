// File: game_farmer.js
// Runtime: Node.js 18+ (requires 'ws' package)

const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');

// 1. Render Keep-Alive HTTP Server
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Brawlhalla Telemetry Farmer is running 24/7!\n');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP] Listening on port ${PORT}`);
});

// 2. Load Discord User Token
const RAW_TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN || "";
const TOKEN = RAW_TOKEN.trim().replace(/^["']|["']$/g, '');

if (!TOKEN) {
  console.error("[ERROR] Missing DISCORD_TOKEN in Environment Variables.");
  process.exit(1);
}

// 3. Verified Brawlhalla Constants
const GAME_NAME = "Brawlhalla";
const GAME_APP_ID = "356944273133928458";
const GAME_EXEC_PATH = "c:/program files (x86)/steam/steamapps/common/brawlhalla/brawlhalla.exe";

const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";
const API_BASE = "https://discord.com/api/v9";

let ws;
let heartbeatInterval;
let lastSequence = null;
let gatewaySessionId = null;
let userId = null;
let analyticsToken = null;
let sessionStartTime = Date.now();
let isResetting = false;

const clientProperties = {
  os: "Windows",
  browser: "Discord Client",
  release_channel: "stable",
  client_version: "1.0.9171",
  os_version: "10.0.22631",
  os_arch: "x64",
  app_arch: "x64",
  system_locale: "en-US",
  has_client_mods: false,
  browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9171 Chrome/128.0.6613.186 Electron/32.2.2 Safari/537.36",
  browser_version: "32.2.2",
  os_sdk_version: "22631",
  client_build_number: 346892,
  native_build_number: 54876,
  client_event_source: null
};

const superPropertiesBase64 = Buffer.from(JSON.stringify(clientProperties)).toString('base64');

// Send Discord Desktop 'launch_game' & 'game_session_end' telemetry events
async function sendGameTelemetry(eventType, durationSeconds = 0) {
  if (!analyticsToken) return;

  const eventPayload = {
    token: analyticsToken,
    events: [
      {
        type: eventType,
        properties: {
          client_track_timestamp: Date.now(),
          client_heartbeat_session_id: gatewaySessionId || crypto.randomUUID(),
          game_id: GAME_APP_ID,
          game_name: GAME_NAME,
          executable_name: "brawlhalla.exe",
          executable_path: GAME_EXEC_PATH,
          distributor: "steam",
          is_launcher: false,
          verified: true,
          platform: "desktop",
          duration_seconds: durationSeconds,
          client_send_timestamp: Date.now()
        }
      }
    ]
  };

  try {
    const res = await fetch(`${API_BASE}/science`, {
      method: "POST",
      headers: {
        "Authorization": TOKEN,
        "Content-Type": "application/json",
        "User-Agent": clientProperties.browser_user_agent,
        "X-Super-Properties": superPropertiesBase64
      },
      body: JSON.stringify(eventPayload)
    });
    console.log(`[TELEMETRY] Sent '${eventType}' -> HTTP ${res.status}`);
  } catch (err) {
    console.error(`[TELEMETRY ERROR] ${err.message}`);
  }
}

function getPresencePayload(clear = false) {
  return {
    op: 3,
    d: {
      since: 0,
      activities: clear ? [] : [
        {
          name: GAME_NAME,
          type: 0,
          application_id: GAME_APP_ID,
          platform: "desktop",
          session_id: gatewaySessionId || undefined,
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

function startFarmer() {
  ws = new WebSocket(GATEWAY_URL, {
    headers: {
      "User-Agent": clientProperties.browser_user_agent,
      "Origin": "https://discord.com"
    }
  });

  ws.on('open', () => {
    console.log("[GATEWAY] Connected to Discord v10.");
  });

  ws.on('message', (data) => {
    let payload;
    try {
      payload = JSON.parse(data);
    } catch (e) {
      return;
    }

    const { op, d, t, s } = payload;
    if (s !== null && s !== undefined) lastSequence = s;

    if (op === 10) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: 1, d: lastSequence }));
        }
      }, d.heartbeat_interval);

      ws.send(JSON.stringify({
        op: 2,
        d: {
          token: TOKEN,
          capabilities: 30717,
          properties: clientProperties,
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
      }));
    }

    if (op === 7 || op === 9) {
      ws.close();
    }

    if (t === "READY") {
      gatewaySessionId = d.session_id;
      userId = d.user.id;
      analyticsToken = d.analytics_token;
      console.log(`[READY] Logged in as ${d.user.username} | Session: ${gatewaySessionId}`);

      setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(getPresencePayload(false)));
          sendGameTelemetry("launch_game", 0);
        }
      }, 2000);
    }
  });

  ws.on('close', (code) => {
    console.log(`[GATEWAY] Closed (${code}). Reconnecting in 5s...`);
    clearInterval(heartbeatInterval);
    setTimeout(startFarmer, 5000);
  });

  ws.on('error', (err) => {
    console.error("[GATEWAY ERROR]", err.message);
  });
}

// Re-broadcast presence every 10 minutes
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN && !isResetting) {
    ws.send(JSON.stringify(getPresencePayload(false)));
  }
}, 10 * 60 * 1000);

// Flush session every 30 minutes (1800 seconds) with telemetry commit
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const playedSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
    console.log(`[SYNC] Flushing ${playedSeconds}s session to Discord backend...`);
    isResetting = true;
    ws.send(JSON.stringify(getPresencePayload(true)));
    sendGameTelemetry("game_session_end", playedSeconds);

    setTimeout(() => {
      sessionStartTime = Date.now();
      isResetting = false;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(getPresencePayload(false)));
        sendGameTelemetry("launch_game", 0);
      }
    }, 15 * 1000);
  }
}, 30 * 60 * 1000);

startFarmer();
