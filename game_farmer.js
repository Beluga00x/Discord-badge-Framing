// file: game_farmer.js | runtime: Node.js v18+ | dependency: ws (npm i ws)
const WebSocket = require('ws');

// Enter your Discord Token there.
const TOKEN = process.env.DISCORD_TOKEN;

const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

// Brawlhalla Official Discord Verified Game Data
const VERIFIED_GAME = {
    name: "Brawlhalla",
    application_id: "356944273133928458",
    type: 0
};

function startGameFarmer() {
    const ws = new WebSocket(GATEWAY_URL);
    let heartbeatInterval = null;
    const startTime = Date.now();

    ws.on('open', () => {
        console.log("[GAME FARMER] Discord Gateway is CONNECTED.");
    });

    ws.on('message', (data) => {
        const payload = JSON.parse(data);
        const { op, d, t } = payload;

        if (op === 10) {
            heartbeatInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ op: 1, d: null }));
                }
            }, d.heartbeat_interval);

            ws.send(JSON.stringify({
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
                        system_locale: "en-US"
                    },
                    presence: {
                        status: "online",
                        since: 0,
                        activities: [{
                            name: VERIFIED_GAME.name,
                            type: VERIFIED_GAME.type,
                            application_id: VERIFIED_GAME.application_id,
                            timestamps: { start: startTime }
                        }],
                        afk: false
                    }
                }
            }));
        }

        if (t === "READY") {
            console.log(`[GAME FARMER] ${d.user.username} Loging Success. Now ${VERIFIED_GAME.name} Farming for hours!`);
        }
    });

    ws.on('close', (code) => {
        console.log(`[GAME FARMER] DISCONNECTED (${code}). Reconnecting in 5 seconds...`);
        clearInterval(heartbeatInterval);
        setTimeout(startGameFarmer, 5000);
    });

    ws.on('error', (err) => {
        console.error("[GAME FARMER] Error:", err.message);
    });
}

startGameFarmer();
