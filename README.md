# Typing Contest

Typing game with routed pages (`Home`, `Quick Play`, `Solo`, `Lobby`), local profile persistence, and Socket.IO multiplayer.

## Features

- Solo mode requests a fresh snippet from websocket on each new round.
- Quick play matchmaking creates rooms of 5 players.
- Custom room flow: create room, share invite link, join, start with admin settings.
- Emoji markers show each player's live word position on the game board.
- Live heartbeat updates keep player stats and positions synced with small payloads.
- Server reads snippets from `Server/snippets.txt` (100 lines) and picks one at random.
- Strict word-confirm flow: only `Space` confirms a correctly typed word.
- Editor input always contains only the current word being typed.
- Profile persistence in localStorage (`name`, `emoji`, permanent `userId`, current color).
- Routing via `react-router-dom`.

## Routes

- `/` Home
- `/play` Quick Play
- `/play?room=<ROOM_CODE>` Custom room race
- `/solo` Solo Play
- `/lobby` Create custom room
- `/lobby?room=<ROOM_CODE>` Join custom room by link

## Run (Client)

```bash
npm install
npm run dev
```

## Run (Server)

From workspace root:

```bash
cd Server
npm install
npm start
```

Server default URL: `http://localhost:3000`

## Optional Client Socket URL

You can override the socket URL in the frontend with:

```bash
VITE_SOCKET_URL=http://localhost:3000
```

This is already the default if not provided.

## Production Build

```bash
npm run build
npm run preview
```
