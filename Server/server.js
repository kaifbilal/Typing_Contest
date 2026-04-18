const fs = require("fs")
const path = require("path")
const { createServer } = require("http")
const { Server } = require("socket.io")

const PORT = Number(process.env.PORT || 3000)
const QUICK_TEAM_SIZE = 5
const HEARTBEAT_INTERVAL_MS = 260
const BOT_EMOJIS = ["👽", "👾", "🤖", "🧠", "🦊", "🐼", "🐧", "🦉"]
const BOT_NAMES = ["Arctetical", "Wendigo", "Doodles", "Vector", "Pulse", "Echo", "Nyx", "Rift"]
const BOT_COLORS = ["#5e4b8b", "#355c7d", "#4b6b5b", "#7d4d5f", "#5a5f7d", "#7f5a3a"]

const DEFAULT_QUICK_SETTINGS = Object.freeze({
    difficulty: "random",
    max: QUICK_TEAM_SIZE,
    countdown: 3,
    duration: 120,
})

const snippets = loadSnippets(path.join(__dirname, "snippets.txt"))

const httpServer = createServer()
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
})

const rooms = new Map()
const socketToRoom = new Map()
const quickQueue = []

function loadSnippets(filePath) {
    try {
        const raw = fs.readFileSync(filePath, "utf8")
        const lines = raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)

        if (lines.length > 0) {
            return lines
        }
    } catch (error) {
        console.warn("Unable to read snippets.txt, fallback snippets will be used.", error.message)
    }

    return [
        "Practice builds confidence one accurate word at a time.",
        "Consistency wins races before raw speed ever appears.",
        "Keep your focus calm and your fingers will follow.",
    ]
}

function randomSnippet() {
    const index = Math.floor(Math.random() * snippets.length)
    return snippets[index]
}

function sanitizeProfile(profile = {}) {
    const name = typeof profile.n === "string" && profile.n.trim() ? profile.n.trim().slice(0, 20) : "Player"
    const emoji = typeof profile.e === "string" && profile.e.trim() ? profile.e.trim().slice(0, 2) : "🤞"
    const color = typeof profile.c === "string" && profile.c.trim() ? profile.c.trim().slice(0, 16) : "#5e4b8b"

    return { n: name, e: emoji, c: color }
}

function clampInt(value, min, max, fallback) {
    if (!Number.isFinite(value)) {
        return fallback
    }

    return Math.max(min, Math.min(max, Math.round(value)))
}

function sanitizeSettings(settings = {}, fallback = DEFAULT_QUICK_SETTINGS) {
    return {
        difficulty:
            typeof settings.difficulty === "string" && settings.difficulty.trim()
                ? settings.difficulty.trim().slice(0, 12)
                : fallback.difficulty,
        max: clampInt(settings.max, 2, 20, fallback.max),
        countdown: clampInt(settings.countdown, 2, 20, fallback.countdown),
        duration: clampInt(settings.duration, 20, 600, fallback.duration),
    }
}

function roomHasHumanPlayers(room) {
    for (const player of room.players.values()) {
        if (!player.bot) {
            return true
        }
    }

    return false
}

function createQuickBotPlayer(roomId, index) {
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]
    const emoji = BOT_EMOJIS[Math.floor(Math.random() * BOT_EMOJIS.length)]
    const color = BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)]
    const wpm = clampInt(85 + Math.random() * 55, 60, 180, 100)
    const accuracy = clampInt(92 + Math.random() * 7, 85, 100, 96)

    return {
        i: `bot-${roomId}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        n: name,
        e: emoji,
        c: color,
        wi: 0,
        m: [wpm, accuracy, 0],
        done: 0,
        bot: 1,
        pace: Math.max(0.5, wpm / 60),
        carry: 0,
    }
}

function addQuickBotsToRoom(room, botCount) {
    for (let index = 0; index < botCount; index += 1) {
        const bot = createQuickBotPlayer(room.id, index)
        room.players.set(bot.i, bot)
    }

    room.dirty = true
}

function advanceQuickBots(room) {
    if (room.kind !== "quick" || room.phase !== "running" || room.wordCount <= 0) {
        return
    }

    const deltaSeconds = HEARTBEAT_INTERVAL_MS / 1000

    room.players.forEach((player) => {
        if (!player.bot || player.done) {
            return
        }

        player.carry += player.pace * deltaSeconds
        const step = Math.floor(player.carry)

        if (step > 0) {
            player.carry -= step
            player.wi = Math.min(room.wordCount, player.wi + step)
            if (player.wi >= room.wordCount) {
                player.done = 1
            }

            room.dirty = true
        }
    })
}

function emitRoundResume(socket, room) {
    if (!room.snippet) {
        return
    }

    if (room.phase === "countdown") {
        socket.emit("room:start", {
            r: room.id,
            cd: Math.max(1, room.countdownRemaining),
            d: room.settings.duration,
            s: room.snippet,
        })
        return
    }

    if (room.phase === "running") {
        const remainingSeconds = Math.max(1, Math.ceil((room.endsAt - Date.now()) / 1000))

        socket.emit("room:start", {
            r: room.id,
            cd: 1,
            d: remainingSeconds,
            s: room.snippet,
        })

        socket.emit("room:go", {
            r: room.id,
            t: remainingSeconds,
        })
        return
    }

    if (room.phase === "ended") {
        socket.emit("room:start", {
            r: room.id,
            cd: 1,
            d: room.settings.duration,
            s: room.snippet,
        })

        socket.emit("room:end", {
            r: room.id,
            rank: rankPlayers(room),
        })
    }
}

function createRoomId(prefix = "R") {
    return `${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function buildRoomSnapshot(room) {
    return {
        r: room.id,
        k: room.kind,
        ph: room.phase,
        a: room.adminId,
        s: {
            difficulty: room.settings.difficulty,
            max: room.settings.max,
            countdown: room.settings.countdown,
            duration: room.settings.duration,
        },
        p: Array.from(room.players.values()).map((player) => ({
            i: player.i,
            n: player.n,
            e: player.e,
            c: player.c,
            wi: player.wi,
            m: player.m,
            d: player.done,
        })),
        msg: room.messages.slice(-20),
    }
}

function emitRoomSnapshot(room) {
    io.to(room.id).emit("room:snap", buildRoomSnapshot(room))
}

function emitRoomHeartbeat(room) {
    const now = Date.now()
    const remainingSeconds =
        room.phase === "running" && room.endsAt
            ? Math.max(0, Math.ceil((room.endsAt - now) / 1000))
            : Math.max(0, room.countdownRemaining)

    io.to(room.id).emit("room:hb", {
        r: room.id,
        ph: room.phase,
        t: remainingSeconds,
        p: Array.from(room.players.values()).map((player) => ({
            i: player.i,
            wi: player.wi,
            m: player.m,
            d: player.done,
        })),
    })
}

function ensureTicker(room) {
    if (room.ticker) {
        return
    }

    room.ticker = setInterval(() => {
        if (!rooms.has(room.id)) {
            clearInterval(room.ticker)
            room.ticker = null
            return
        }

        if (room.phase === "running") {
            advanceQuickBots(room)

            const everyoneDone = Array.from(room.players.values()).every((entry) => entry.done)
            if (everyoneDone) {
                finishRoomRound(room)
                return
            }
        }

        if (room.phase === "running" || room.dirty) {
            emitRoomHeartbeat(room)
            room.dirty = false
        }
    }, HEARTBEAT_INTERVAL_MS)
}

function clearRoomTimers(room) {
    if (room.countdownTimer) {
        clearInterval(room.countdownTimer)
        room.countdownTimer = null
    }

    if (room.endTimer) {
        clearTimeout(room.endTimer)
        room.endTimer = null
    }

    if (room.ticker) {
        clearInterval(room.ticker)
        room.ticker = null
    }
}

function addRoomMessage(room, text, system = 1) {
    const message = {
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        t: text,
        sys: system,
        ts: Date.now(),
    }

    room.messages.push(message)
    if (room.messages.length > 100) {
        room.messages.shift()
    }

    io.to(room.id).emit("room:msg", message)
}

function createRoom({ kind, adminId, settings, roomId }) {
    const id = roomId || createRoomId(kind === "custom" ? "C" : "Q")
    const room = {
        id,
        kind,
        adminId,
        settings,
        phase: "lobby",
        players: new Map(),
        messages: [],
        snippet: "",
        wordCount: 0,
        countdownRemaining: settings.countdown,
        endsAt: 0,
        dirty: true,
        countdownTimer: null,
        endTimer: null,
        ticker: null,
    }

    rooms.set(id, room)
    ensureTicker(room)
    return room
}

function addPlayerToRoom(room, socket, profile) {
    socket.join(room.id)
    socketToRoom.set(socket.id, room.id)

    room.players.set(socket.id, {
        i: socket.id,
        n: profile.n,
        e: profile.e,
        c: profile.c,
        wi: 0,
        m: [0, 100, 0],
        done: 0,
    })

    room.dirty = true
}

function removeFromQuickQueue(socketId) {
    const index = quickQueue.findIndex((entry) => entry.socketId === socketId)
    if (index >= 0) {
        quickQueue.splice(index, 1)
    }
}

function disposeRoomIfEmpty(room) {
    if (room.players.size > 0) {
        return
    }

    clearRoomTimers(room)
    rooms.delete(room.id)
}

function removePlayerFromRoom(socketId, reasonText = "left") {
    const roomId = socketToRoom.get(socketId)
    if (!roomId) {
        return
    }

    const room = rooms.get(roomId)
    socketToRoom.delete(socketId)

    if (!room) {
        return
    }

    const departed = room.players.get(socketId)
    room.players.delete(socketId)
    room.dirty = true

    if (!roomHasHumanPlayers(room)) {
        clearRoomTimers(room)
        rooms.delete(room.id)
        return
    }

    if (departed) {
        addRoomMessage(room, `${departed.n} ${reasonText}.`, 1)
    }

    if (room.adminId === socketId) {
        const nextAdmin = room.players.keys().next().value
        room.adminId = nextAdmin || null
        if (nextAdmin) {
            const adminPlayer = room.players.get(nextAdmin)
            addRoomMessage(room, `${adminPlayer.n} is now the room admin.`, 1)
        }
    }

    emitRoomSnapshot(room)
    disposeRoomIfEmpty(room)
}

function rankPlayers(room) {
    return Array.from(room.players.values())
        .sort((left, right) => {
            if (right.wi !== left.wi) {
                return right.wi - left.wi
            }

            const leftWpm = left.m[0] || 0
            const rightWpm = right.m[0] || 0
            return rightWpm - leftWpm
        })
        .map((player, index) => ({
            rank: index + 1,
            i: player.i,
            n: player.n,
            e: player.e,
            wi: player.wi,
            m: player.m,
        }))
}

function finishRoomRound(room) {
    if (room.phase !== "running" && room.phase !== "countdown") {
        return
    }

    if (room.countdownTimer) {
        clearInterval(room.countdownTimer)
        room.countdownTimer = null
    }

    if (room.endTimer) {
        clearTimeout(room.endTimer)
        room.endTimer = null
    }

    room.phase = "ended"
    room.endsAt = Date.now()
    room.dirty = true

    const ranking = rankPlayers(room)
    io.to(room.id).emit("room:end", {
        r: room.id,
        rank: ranking,
    })

    emitRoomHeartbeat(room)
}

function startRoomRound(room) {
    if (!room || room.players.size === 0) {
        return
    }

    if (room.phase === "countdown" || room.phase === "running") {
        return
    }

    if (room.countdownTimer) {
        clearInterval(room.countdownTimer)
        room.countdownTimer = null
    }

    if (room.endTimer) {
        clearTimeout(room.endTimer)
        room.endTimer = null
    }

    room.snippet = randomSnippet()
    room.wordCount = room.snippet.split(/\s+/).filter(Boolean).length
    room.phase = "countdown"
    room.countdownRemaining = room.settings.countdown
    room.endsAt = 0

    room.players.forEach((player) => {
        player.wi = 0
        player.m = [0, 100, 0]
        player.done = 0
    })

    room.dirty = true
    emitRoomSnapshot(room)

    io.to(room.id).emit("room:start", {
        r: room.id,
        cd: room.settings.countdown,
        d: room.settings.duration,
        s: room.snippet,
    })

    room.countdownTimer = setInterval(() => {
        room.countdownRemaining = Math.max(0, room.countdownRemaining - 1)
        room.dirty = true

        if (room.countdownRemaining > 0) {
            return
        }

        clearInterval(room.countdownTimer)
        room.countdownTimer = null

        room.phase = "running"
        room.endsAt = Date.now() + room.settings.duration * 1000
        room.dirty = true

        io.to(room.id).emit("room:go", {
            r: room.id,
            t: room.settings.duration,
        })

        room.endTimer = setTimeout(() => {
            finishRoomRound(room)
        }, room.settings.duration * 1000)
    }, 1000)
}

function tryMatchQuickQueue() {
    while (quickQueue.length >= QUICK_TEAM_SIZE) {
        const group = quickQueue.splice(0, QUICK_TEAM_SIZE)
        const room = createRoom({
            kind: "quick",
            adminId: group[0].socketId,
            settings: { ...DEFAULT_QUICK_SETTINGS },
        })

        let joinedPlayers = 0

        group.forEach((entry) => {
            const socket = io.sockets.sockets.get(entry.socketId)
            if (!socket) {
                return
            }

            removePlayerFromRoom(socket.id)
            addPlayerToRoom(room, socket, entry.profile)
            joinedPlayers += 1

            socket.emit("room:assigned", {
                r: room.id,
                k: "quick",
            })
        })

        if (joinedPlayers === 0) {
            rooms.delete(room.id)
            clearRoomTimers(room)
            continue
        }

        addRoomMessage(room, "Quick room ready. Countdown started.", 1)
        emitRoomSnapshot(room)
        startRoomRound(room)
    }
}

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id)

    socket.on("solo:next", (ack) => {
        const snippet = randomSnippet()
        if (typeof ack === "function") {
            ack({ ok: 1, s: snippet })
            return
        }

        socket.emit("solo:round", { s: snippet })
    })

    socket.on("quick:join", (profilePayload = {}) => {
        const profile = sanitizeProfile(profilePayload)
        removeFromQuickQueue(socket.id)
        removePlayerFromRoom(socket.id)

        const room = createRoom({
            kind: "quick",
            adminId: socket.id,
            settings: { ...DEFAULT_QUICK_SETTINGS },
        })

        addPlayerToRoom(room, socket, profile)
        addQuickBotsToRoom(room, QUICK_TEAM_SIZE - 1)

        socket.emit("room:assigned", {
            r: room.id,
            k: "quick",
        })

        addRoomMessage(room, "Quick room ready. Countdown started.", 1)
        emitRoomSnapshot(room)
        startRoomRound(room)
    })

    socket.on("custom:create", (payload = {}, ack) => {
        const profile = sanitizeProfile(payload.p)
        const requestedSettings = sanitizeSettings(payload.s, {
            difficulty: "random",
            max: 10,
            countdown: 10,
            duration: 120,
        })

        const existingRoomId = socketToRoom.get(socket.id)
        const existingRoom = existingRoomId ? rooms.get(existingRoomId) : null

        if (existingRoom && existingRoom.kind === "custom" && existingRoom.adminId === socket.id) {
            const existingPlayer = existingRoom.players.get(socket.id)
            if (existingPlayer) {
                existingPlayer.n = profile.n
                existingPlayer.e = profile.e
                existingPlayer.c = profile.c
            }

            if (existingRoom.phase === "lobby") {
                existingRoom.settings = sanitizeSettings(requestedSettings, existingRoom.settings)
            }

            existingRoom.dirty = true
            emitRoomSnapshot(existingRoom)

            if (typeof ack === "function") {
                ack({ ok: 1, r: existingRoom.id })
            }
            return
        }

        removeFromQuickQueue(socket.id)
        removePlayerFromRoom(socket.id)

        const room = createRoom({
            kind: "custom",
            adminId: socket.id,
            settings: requestedSettings,
            roomId: createRoomId("C"),
        })

        addPlayerToRoom(room, socket, profile)
        addRoomMessage(room, `${profile.n} created this room.`, 1)
        emitRoomSnapshot(room)

        if (typeof ack === "function") {
            ack({ ok: 1, r: room.id })
        }
    })

    socket.on("custom:join", (payload = {}, ack) => {
        const roomId = String(payload.r || "").trim().toUpperCase()
        const room = rooms.get(roomId)

        if (!room || room.kind !== "custom") {
            if (typeof ack === "function") {
                ack({ ok: 0, m: "Room not found." })
            }
            return
        }

        const existingPlayer = room.players.get(socket.id)
        if (existingPlayer) {
            socket.join(room.id)
            socketToRoom.set(socket.id, room.id)

            socket.emit("room:snap", buildRoomSnapshot(room))
            emitRoundResume(socket, room)

            if (typeof ack === "function") {
                ack({ ok: 1, r: room.id })
            }
            return
        }

        if (room.phase !== "lobby") {
            if (typeof ack === "function") {
                ack({ ok: 0, m: "Game already started." })
            }
            return
        }

        if (room.players.size >= room.settings.max) {
            if (typeof ack === "function") {
                ack({ ok: 0, m: "Room is full." })
            }
            return
        }

        const profile = sanitizeProfile(payload.p)

        removeFromQuickQueue(socket.id)
        removePlayerFromRoom(socket.id)
        addPlayerToRoom(room, socket, profile)

        addRoomMessage(room, `${profile.n} joined the room.`, 1)
        emitRoomSnapshot(room)

        if (typeof ack === "function") {
            ack({ ok: 1, r: room.id })
        }
    })

    socket.on("room:settings", (payload = {}) => {
        const roomId = String(payload.r || "").trim().toUpperCase()
        const room = rooms.get(roomId)
        if (!room || room.kind !== "custom" || room.phase !== "lobby") {
            return
        }

        if (room.adminId !== socket.id) {
            return
        }

        room.settings = sanitizeSettings(payload.s, room.settings)
        room.dirty = true
        emitRoomSnapshot(room)
    })

    socket.on("room:start", (payload = {}) => {
        const roomId = String(payload.r || "").trim().toUpperCase()
        const room = rooms.get(roomId)
        if (!room) {
            return
        }

        if (room.kind === "custom" && room.adminId !== socket.id) {
            return
        }

        startRoomRound(room)
    })

    socket.on("room:chat", (payload = {}) => {
        const roomId = String(payload.r || "").trim().toUpperCase()
        const room = rooms.get(roomId)
        if (!room) {
            return
        }

        const player = room.players.get(socket.id)
        if (!player) {
            return
        }

        const messageText = typeof payload.t === "string" ? payload.t.trim().slice(0, 240) : ""
        if (!messageText) {
            return
        }

        addRoomMessage(room, `${player.e} ${player.n}: ${messageText}`, 0)
    })

    socket.on("room:kick", (payload = {}) => {
        const roomId = String(payload.r || "").trim().toUpperCase()
        const targetId = String(payload.i || "")
        const room = rooms.get(roomId)

        if (!room || room.kind !== "custom") {
            return
        }

        if (room.adminId !== socket.id || targetId === room.adminId) {
            return
        }

        const targetPlayer = room.players.get(targetId)
        if (!targetPlayer) {
            return
        }

        const targetSocket = io.sockets.sockets.get(targetId)
        if (targetSocket) {
            targetSocket.leave(room.id)
            socketToRoom.delete(targetId)
            targetSocket.emit("room:error", { m: "You were removed from the room by admin." })
        }

        room.players.delete(targetId)
        room.dirty = true
        addRoomMessage(room, `${targetPlayer.n} was removed by admin.`, 1)
        emitRoomSnapshot(room)
        disposeRoomIfEmpty(room)
    })

    socket.on("room:profile", (payload = {}) => {
        const roomId = String(payload.r || socketToRoom.get(socket.id) || "").trim().toUpperCase()
        const room = rooms.get(roomId)
        if (!room) {
            return
        }

        const player = room.players.get(socket.id)
        if (!player) {
            return
        }

        const profile = sanitizeProfile(payload.p)
        player.n = profile.n
        player.e = profile.e
        player.c = profile.c
        room.dirty = true
        emitRoomSnapshot(room)
    })

    socket.on("room:hb", (payload = {}) => {
        const roomId = String(payload.r || socketToRoom.get(socket.id) || "").trim().toUpperCase()
        const room = rooms.get(roomId)
        if (!room) {
            return
        }

        const player = room.players.get(socket.id)
        if (!player) {
            return
        }

        if (Number.isFinite(payload.wi)) {
            const boundedWordIndex = Math.max(0, Math.min(Math.round(payload.wi), room.wordCount))
            if (boundedWordIndex !== player.wi) {
                player.wi = boundedWordIndex
                room.dirty = true
            }
        }

        if (Array.isArray(payload.m)) {
            const nextMetrics = [
                clampInt(payload.m[0], 0, 400, player.m[0]),
                clampInt(payload.m[1], 0, 100, player.m[1]),
                clampInt(payload.m[2], 0, 999, player.m[2]),
            ]

            if (
                nextMetrics[0] !== player.m[0] ||
                nextMetrics[1] !== player.m[1] ||
                nextMetrics[2] !== player.m[2]
            ) {
                player.m = nextMetrics
                room.dirty = true
            }
        }

        if (payload.done || player.wi >= room.wordCount) {
            if (!player.done) {
                player.done = 1
                room.dirty = true
            }
        }

        if (room.phase === "running") {
            const everyoneDone = Array.from(room.players.values()).every((entry) => entry.done)
            if (everyoneDone) {
                finishRoomRound(room)
            }
        }
    })

    socket.on("disconnect", () => {
        removeFromQuickQueue(socket.id)
        removePlayerFromRoom(socket.id, "disconnected")
        console.log("Client disconnected:", socket.id)
    })
})

httpServer.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`)
})

