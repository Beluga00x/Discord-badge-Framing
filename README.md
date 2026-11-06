<div align="center">

# ⚔️ Discord Badge & Playtime Farmer (24/7)

**Automated 24/7 Discord Gateway (v10) Game Presence & IRONCLAD Badge Playtime Farmer**

![NodeJS](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Discord](https://img.shields.io/badge/Discord_Gateway-v10-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Render](https://img.shields.io/badge/Render-24%2F7_Ready-46E3B7?style=for-the-badge&logo=render&logoColor=black)
![Game](https://img.shields.io/badge/Game-Brawlhalla-FF9900?style=for-the-badge)

</div>

---

## 📖 Overview

**Discord-badge-Framing** is a lightweight Node.js WebSocket client that connects directly to the **Discord Gateway API (v10)** to maintain 24/7 game activity. It is built to farm playtime hours for Discord's **Game Time (IRONCLAD)** Epic badge, which tracks hours of detectable PC games played with Discord open across tiers such as Casual (1 hour), Recreational (5 hours), Dedicated (20 hours), Committed (75 hours), and higher milestones.

---

## ✨ Key Features

* **Verified Game Icon Support:** Configured with the official *Brawlhalla* Application ID (`356944273133928458`) to prevent the missing question-mark (`?`) icon or the wrong Brawlhalla icon with the "Get on Steam" button.
* **Automatic Backend Playtime Sync:** Uses a 45-minute session flush cycle (with a 15-second cooldown) so Discord's backend properly saves session hours toward your badge progress (such as advancing from 1,812 hours through the remaining 188 hours).
* **24/7 Cloud Hosting Ready:** Includes a built-in HTTP web server (`0.0.0.0`) for **Render** port binding and **UptimeRobot** keep-alive pings.
* **Gateway Heartbeat & Auto-Reconnect:** Automatically responds to `op: 10` heartbeat intervals and reconnects within 5 seconds if the connection drops.
* **Secure Environment Variables:** Reads your Discord token safely from `DISCORD_TOKEN` without hardcoding credentials in the source code.

---

## 📂 Project Structure

```text
Discord-badge-Framing/
├── game_farmer.js    # Main Discord Gateway v10 WebSocket & HTTP server script
├── package.json      # Node.js dependencies ('ws' library)
└── README.md         # Project documentation and setup guide
