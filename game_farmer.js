// File: unified_smart_farmer.js
// Runtime: Node.js 18+ (requires 'ws' package)

const WebSocket = require('ws');
const http = require('http');

// 1. Render HTTP Server (UptimeRobot 24/7 Keep-Alive)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Smart Discord Quest & Game Presence Farmer is running 24/7!\n');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP SERVER] Server is listening on port ${PORT}`);
});

// 2. Token Configuration from Render Environment Variables
const RAW_TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN || "";
const TOKEN = RAW_TOKEN.trim().replace(/^["']|["']$/g, '');

if (!TOKEN) {
  console.error("[ERROR] DISCORD_TOKEN or TOKEN not found in Render Environment Variables!");
  process.exit(1);
}

// 3. Configuration: Just change the game name here! App ID will be fetched automatically.
const GAME_NAME = "Arknights: Endfield";
let GAME_APP_ID = null;

const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";
const API_BASE = "https://discord.com/api/v10";

let ws;
let heartbeatInterval;
let lastSequence = null;
let sessionStartTime = Date.now();
let isSyncingBreak = false;

// Helper function for Discord REST API requests
async function discordApiRequest(endpoint, method = "GET", body = null) {
  try {
    const options = {
      method,
      headers: {
        "Authorization": TOKEN,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await res.json();
    return { ok: res.ok, status: res.status, body: data };
  } catch (err) {
    console.error(`[API ERROR] ${endpoint}:`, err.message);
    return { ok: false, body: null };
  }
}

// Fetch official game App ID from Discord Detectable Games list automatically
async function fetchOfficialGameAppId(gameName) {
  try {
    const response = await fetch("https://discord.com/api/v10/applications/detectable");
    const games = await response.json();
    const match = games.find(g => g.name.toLowerCase() === gameName.toLowerCase());
    if (match) {
      console.log(`[GAME FARMER] Found official App ID for ${match.name}: ${match.id}`);
      return match.id;
    }
  } catch (err) {
    console.error("[GAME FARMER] Error fetching App ID:", err.message);
  }
  return null;
}

// 4. Smart Quest Checker & Completer Logic
async function checkAndCompleteQuests() {
  console.log("[QUEST FARMER] Checking for active accepted/uncompleted quests...");
  
  const res = await discordApiRequest("/users/@me/quests");
  if (!res.ok || !res.body) {
    console.log("[QUEST FARMER] Failed to fetch quests or token unauthorized.");
    return;
  }

  const quests = res.body.quests || res.body;
  if (!Array.isArray(quests)) return;

  const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"];
  // Only target quests that are enrolled/accepted by the user and not yet completed
  const uncompleted = quests.filter(x => x.userStatus?.enrolledAt && !x.userStatus?.completedAt && new Date(x.config.expiresAt).getTime() > Date.now());

  if (uncompleted.length === 0) {
    console.log("[QUEST FARMER] No accepted quests found. Running pure game playtime & presence mode.");
    return;
  }

  console.log(`[QUEST FARMER] Found ${uncompleted.length} active accepted quest(s). Processing...`);

  for (const quest of uncompleted) {
    const questName = quest.config.messages.questName;
    const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
    const taskName = supportedTasks.find(x => taskConfig.tasks[x] != null);
    
    if (!taskName) continue;

    const taskData = taskConfig.tasks[taskName];
    const secondsNeeded = taskData.target;
    let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;

    console.log(`[QUEST] Processing: ${questName} | Task: ${taskName} | Progress: ${secondsDone}/${secondsNeeded}s`);

    if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
      while (secondsDone < secondsNeeded) {
        const increment = Math.min(10, secondsNeeded - secondsDone);
        secondsDone += increment;
        await discordApiRequest(`/quests/${quest.id}/video-progress`, "POST", { timestamp: secondsDone });
        console.log(`[QUEST] Video progress: ${secondsDone}/${secondsNeeded}s`);
        await new Promise(r => setTimeout(r, 3000));
      }
      console.log(`[QUEST] Completed video quest: ${questName}!`);
    } else {
      while (secondsDone < secondsNeeded) {
        const hbRes = await discordApiRequest(`/quests/${quest.id}/heartbeat`, "POST", { stream_key: null, terminal: false });
        if (hbRes.ok && hbRes.body?.progress?.[taskName]) {
          secondsDone = hbRes.body.progress[taskName].value;
          console.log(`[QUEST] Heartbeat progress: ${secondsDone}/${secondsNeeded}s`);
        }
        await new Promise(r => setTimeout(r, 20 * 1000));
        if (secondsDone >= secondsNeeded) {
          await discordApiRequest(`/quests/${quest.id}/heartbeat`, "POST", { stream_key: null, terminal: true });
          console.log(`[QUEST] Quest ${questName} finished successfully!`);
          break;
        }
      }
    }
  }
}

// 5. Game Presence Payload Generator
function getPresencePayload(clearActivity = false) {
  const activity = {
    name: GAME_NAME,
    type: 0,
    timestamps: {
      start: sessionStartTime
    },
    flags: 1
  };

  if (GAME_APP_ID) {
    activity.application_id = GAME_APP_ID;
  }

  return {
    op: 3,
    d: {
      since: clearActivity ? null : sessionStartTime,
      activities: clearActivity ? [] : [activity],
      status: "online",
      afk: false
    }
  };
}

// 6. Game Presence WebSocket Gateway Runner
function startGameFarmer() {
  ws = new WebSocket(GATEWAY_URL);

  ws.on('open', () => {
    console.log("[GAME FARMER] Connected to Discord Gateway.");
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
      console.log(`[GAME FARMER] Logged in as ${d.user.username}. Farming playtime for ${GAME_NAME}!`);
      ws.send(JSON.stringify(getPresencePayload(isSyncingBreak)));
    }
  });

  ws.on('close', (code) => {
    console.log(`[GAME FARMER] Connection closed (${code}). Reconnecting in 5s...`);
    clearInterval(heartbeatInterval);
    setTimeout(startGameFarmer, 5000);
  });

  ws.on('error', (err) => {
    console.error("[GAME FARMER] Error:", err.message);
  });
}

// Presence Refresh Interval (Every 15 mins)
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN && !isSyncingBreak) {
    ws.send(JSON.stringify(getPresencePayload(false)));
  }
}, 15 * 60 * 1000);

// Playtime Sync Interval (Every 2 hours)
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("[GAME FARMER] Refreshing session to sync playtime to badge...");
    isSyncingBreak = true;
    ws.send(JSON.stringify(getPresencePayload(true)));

    setTimeout(() => {
      sessionStartTime = Date.now();
      isSyncingBreak = false;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(getPresencePayload(false)));
        console.log("[GAME FARMER] Playtime session synced successfully!");
      }
    }, 20 * 1000);
  }
}, 2 * 60 * 60 * 1000);

// Start Quest Checker Loop (Every 10 minutes)
setInterval(checkAndCompleteQuests, 10 * 60 * 1000);

// Initialize App ID first, then start quest checking and game farming
(async () => {
  GAME_APP_ID = await fetchOfficialGameAppId(GAME_NAME);
  setTimeout(checkAndCompleteQuests, 5000);
  startGameFarmer();
})();
