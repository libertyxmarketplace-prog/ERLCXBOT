# 🌴 Orlando Support - Discord Ticket System

A production-ready, modern Discord Ticket System built with **discord.js v14** (ESM), local JSON file persistence, live auto-updating panels, interactive modals, responsive control panels, and standalone styled HTML transcripts with retroactive reason editing.

---

## 🚀 Quick Setup & Installation

### 1. Install Dependencies
Open PowerShell or your terminal in this directory and run:
```bash
npm install
```

### 2. Configure Environment Variables
Open `.env` and fill in your Discord credentials:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_bot_client_id_here
GUILD_ID=your_discord_server_id_here   # Recommended for instant slash command registration!
```

### 3. Customize Config (`config.js`)
Open `config.js` to customize:
- `BANNER_URL`: Pre-configured to your Orlando Support banner!
- `TRANSCRIPTS_CHANNEL_ID`: Channel ID where ticket logs & HTML transcripts are dispatched.
- `STAFF_ROLE_IDS`: Array of Role IDs permitted to view, claim, and manage tickets.
- `CATEGORIES`: Pre-configured with:
  - **General Support**: Category ID `1548331057911173140`
  - **Management Support**: Category ID `1548330987128229989`
  - **Partnerships & Affiliates**: Category ID `1550260772230139954`

### 4. Deploy Slash Commands
Register the `/ticket` slash command with Discord:
```bash
npm run deploy
```

### 5. Start the Bot
```bash
npm start
```

---

## 🛠️ Slash Commands Reference

| Command | Description | Permission |
|---|---|---|
| `/ticket panel [channel]` | Sends the main ticket panel to a channel and registers it for live auto-updating. | Staff / Admin |
| `/ticket status <online\|busy\|closed>` | Changes live operational desk status and refreshes all active panels in real-time. | Staff / Admin |
| `/ticket category <category> <enable\|disable>` | Toggles individual categories on/off and updates all live panels in real-time. | Staff / Admin |
| `/ticket close [reason]` | Initiates ticket archive, generates HTML transcript, DMs author, and logs to transcripts channel. | Staff / Author |
| `/ticket claim` | Assigns the ticket to you and updates the ticket control panel. | Staff |
| `/ticket unclaim` | Releases the ticket back to the staff queue. | Staff |
| `/ticket add <user>` | Grants a user access to the ticket channel. | Staff |
| `/ticket remove <user>` | Revokes a user's access to the ticket channel. | Staff |
| `/ticket rename <name>` | Renames the ticket channel. | Staff |

---

## 📂 Architecture & Persistence

Data is stored locally under the `data/` directory so nothing breaks across bot restarts:
- `data/tickets.json`: Active tickets metadata and historical archive records.
- `data/ticket_desk.json`: Current desk status (`online`, `busy`, `closed`) and list of disabled categories.
- `data/ticket_panels.json`: List of all posted panel messages (`channelId`, `messageId`) for real-time live synchronization.
