import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'

import {
  createRoom,
  getRoom,
  joinRoom,
  addSongToQueue,
  updatePlayback,
  leaveRoom,
  selectRandomStripPrize,
} from './rooms.js'

const app = express()
const httpServer = createServer(app)

const PORT = Number(process.env.PORT) || 3000

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
  },
})

app.use(cors({ origin: process.env.CLIENT_URL || true }))
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({
    message: 'Videoke API is running!',
  })
})

/*
 * CREATE ROOM
 */
app.post('/rooms', (req, res) => {
  const {
    name,
    strip,
  } = req.body

  if (
    !name ||
    typeof name !== 'string'
  ) {
    return res.status(400).json({
      message: 'Name is required',
    })
  }

  const result = createRoom(
    name.trim(),
    strip,
  )

  return res.status(201).json(result)
})

/*
 * GET ROOM
 */
app.get('/rooms/:code', (req, res) => {
  const { code } = req.params

  const room = getRoom(
    code.toUpperCase(),
  )

  if (!room) {
    return res.status(404).json({
      message: 'Room not found',
    })
  }

  return res.status(200).json(room)
})

/*
 * JOIN ROOM
 */
app.post(
  '/rooms/:code/join',
  (req, res) => {
    const { code } = req.params
    const { name } = req.body

    if (
      !name ||
      typeof name !== 'string'
    ) {
      return res.status(400).json({
        message: 'Name is required',
      })
    }

    const result = joinRoom(
      code.toUpperCase(),
      name.trim(),
    )

    if (!result) {
      return res.status(404).json({
        message: 'Room not found',
      })
    }

    io.to(code.toUpperCase()).emit(
      'room:updated',
      result.room,
    )

    return res.status(200).json(result)
  },
)

/*
 * LEAVE ROOM
 */
app.post(
  '/rooms/:code/leave',
  (req, res) => {
    const { code } = req.params
    const { userId } = req.body

    if (
      !userId ||
      typeof userId !== 'string'
    ) {
      return res.status(400).json({
        message:
          'userId is required',
      })
    }

    const roomCode =
      code.toUpperCase()

    const existingRoom =
      getRoom(roomCode)

    if (!existingRoom) {
      return res.status(404).json({
        message: 'Room not found',
      })
    }

    const userExists =
      existingRoom.users.some(
        (user) =>
          user.id === userId,
      )

    if (!userExists) {
      return res.status(404).json({
        message:
          'User is not in this room',
      })
    }

    const room = leaveRoom(
      roomCode,
      userId,
    )

    if (!room) {
      io.to(roomCode).emit(
        'room:closed',
      )

      return res.status(200).json({
        message: 'Room closed',
      })
    }

    io.to(roomCode).emit(
      'room:updated',
      room,
    )

    return res.status(200).json(room)
  },
)

/*
 * YOUTUBE SEARCH
 */
app.get(
  '/youtube/search',
  async (req, res) => {
    const query = req.query.q

    if (
      !query ||
      typeof query !== 'string'
    ) {
      return res.status(400).json({
        message:
          'Search query is required',
      })
    }

    const apiKey =
      process.env.YOUTUBE_API_KEY

    if (!apiKey) {
      return res.status(500).json({
        message:
          'YouTube API key is not configured',
      })
    }

    try {
      const url = new URL(
        'https://www.googleapis.com/youtube/v3/search',
      )

      url.searchParams.set(
        'part',
        'snippet',
      )

      url.searchParams.set(
        'q',
        query,
      )

      url.searchParams.set(
        'type',
        'video',
      )

      url.searchParams.set(
        'maxResults',
        '10',
      )

      url.searchParams.set(
        'videoEmbeddable',
        'true',
      )

      url.searchParams.set(
        'videoSyndicated',
        'true',
      )

      url.searchParams.set(
        'key',
        apiKey,
      )

      const response =
        await fetch(url)

      if (!response.ok) {
        const errorData: unknown =
          await response.json()

        console.error(
          'YouTube API error:',
          errorData,
        )

        return res.status(
          response.status,
        ).json({
          message:
            'YouTube search failed',
        })
      }

      const data: unknown =
        await response.json()

      if (
        typeof data !== 'object' ||
        data === null ||
        !('items' in data) ||
        !Array.isArray(data.items)
      ) {
        return res.status(500).json({
          message:
            'Invalid response from YouTube API',
        })
      }

      const results = data.items
        .filter(
          (
            item,
          ): item is {
            id: {
              videoId: string
            }
            snippet: {
              title: string
              thumbnails?: {
                medium?: {
                  url: string
                }
                default?: {
                  url: string
                }
              }
            }
          } =>
            typeof item ===
              'object' &&
            item !== null &&
            'id' in item &&
            typeof item.id ===
              'object' &&
            item.id !== null &&
            'videoId' in
              item.id &&
            typeof item.id
              .videoId ===
              'string' &&
            'snippet' in item &&
            typeof item.snippet ===
              'object' &&
            item.snippet !== null &&
            'title' in
              item.snippet &&
            typeof item.snippet
              .title ===
              'string',
        )
        .map((item) => ({
          videoId:
            item.id.videoId,
          title:
            item.snippet.title,
          thumbnail:
            item.snippet
              .thumbnails
              ?.medium?.url ||
            item.snippet
              .thumbnails
              ?.default?.url ||
            '',
        }))

      return res
        .status(200)
        .json(results)
    } catch (error) {
      console.error(
        'YouTube search error:',
        error,
      )

      return res.status(500).json({
        message:
          'Unable to search YouTube',
      })
    }
  },
)

/*
 * REMOVE CURRENT SONG
 *
 * This endpoint is now responsible for
 * triggering the automatic Strip.
 *
 * Flow:
 *
 * Song ends
 *      ↓
 * Host calls this endpoint
 *      ↓
 * Server verifies song
 *      ↓
 * Server selects Strip prize
 *      ↓
 * Server broadcasts Strip prize
 *      ↓
 * Server removes song
 *      ↓
 * Server resets playback
 *      ↓
 * Next song appears
 */
app.delete(
  '/rooms/:roomCode/queue/current',
  (req, res) => {
    const {
      roomCode,
    } = req.params

    const {
      songId,
    } = req.body

    const code =
      roomCode.toUpperCase()

    const room = getRoom(code)

    if (!room) {
      return res.status(404).json({
        message: 'Room not found',
      })
    }

    if (
      !songId ||
      typeof songId !== 'string'
    ) {
      return res.status(400).json({
        message:
          'songId is required',
      })
    }

    const currentSong =
      room.queue.songs[0]

    if (!currentSong) {
      return res.status(400).json({
        message:
          'Queue is empty',
      })
    }

    /*
     * Only remove the song if the song
     * that ended is STILL the first song.
     */
    if (
      currentSong.id !== songId
    ) {
      return res.status(409).json({
        message:
          'Song has already been changed',
      })
    }

    /*
     * Select the Strip prize BEFORE
     * changing the queue.
     */
    const selectedPrize =
      selectRandomStripPrize(code)

    /*
     * Remove ONLY the first song.
     */
    room.queue.songs.shift()

    /*
     * Reset playback for the new song.
     */
    room.playback = {
      isPlaying: false,
      currentTime: 0,
      updatedAt: Date.now(),
    }

    /*
     * IMPORTANT:
     *
     * Send the Strip event before
     * the room update.
     *
     * Everyone receives the same prize.
     */
    if (selectedPrize) {
      io.to(code).emit(
        'strip:prize-selected',
        selectedPrize,
      )

      /*
       * Update everyone with the
       * new queue.
       */
      io.to(code).emit(
        'room:updated',
        room,
      )
    } else {
      /*
       * NO PRIZE TO SHOW
       *
       * This happens when the Strip is
       * disabled, or enabled with no
       * prizes configured.
       *
       * There is no Strip animation to
       * wait for here, so tell clients
       * to advance to the next queued
       * video right away.
       *
       * `room:updated` goes out FIRST so
       * clients already know about the
       * new current song by the time
       * `queue:advance` tells them to
       * start playing it.
       */
      io.to(code).emit(
        'room:updated',
        room,
      )

      io.to(code).emit(
        'queue:advance',
      )
    }

    return res.status(200).json(room)
  },
)

/*
 * SKIP CURRENT SONG (MANUAL "NEXT")
 *
 * Host and Admins can force the queue
 * to move on early. This ALWAYS skips
 * the Strip prize, even if the Strip
 * is enabled — the prize is only ever
 * awarded when a song finishes playing
 * on its own.
 */
app.post(
  '/rooms/:roomCode/queue/next',
  (req, res) => {
    const {
      roomCode,
    } = req.params

    const {
      requesterId,
      songId,
    } = req.body

    const code =
      roomCode.toUpperCase()

    if (
      !requesterId ||
      typeof requesterId !== 'string'
    ) {
      return res.status(400).json({
        message:
          'requesterId is required',
      })
    }

    const room = getRoom(code)

    if (!room) {
      return res.status(404).json({
        message: 'Room not found',
      })
    }

    const requester =
      room.users.find(
        (user) =>
          user.id === requesterId,
      )

    if (!requester) {
      return res.status(403).json({
        message:
          'User is not in this room',
      })
    }

    if (
      requester.role !== 'host' &&
      requester.role !== 'admin'
    ) {
      return res.status(403).json({
        message:
          'Only the host or an admin can skip songs',
      })
    }

    if (
      !songId ||
      typeof songId !== 'string'
    ) {
      return res.status(400).json({
        message:
          'songId is required',
      })
    }

    const currentSong =
      room.queue.songs[0]

    if (!currentSong) {
      return res.status(400).json({
        message:
          'Queue is empty',
      })
    }

    /*
     * Only skip if the song being
     * skipped is STILL the first song.
     */
    if (
      currentSong.id !== songId
    ) {
      return res.status(409).json({
        message:
          'Song has already been changed',
      })
    }

    room.queue.songs.shift()

    room.playback = {
      isPlaying: false,
      currentTime: 0,
      updatedAt: Date.now(),
    }

    io.to(code).emit(
      'room:updated',
      room,
    )

    io.to(code).emit(
      'queue:advance',
    )

    return res.status(200).json(room)
  },
)

/*
 * ADD SONG
 */
app.post(
  '/rooms/:code/queue',
  (req, res) => {
    const { code } =
      req.params

    const {
      videoId,
      title,
      addedBy,
      addedById,
    } = req.body

    if (
      !videoId ||
      typeof videoId !==
        'string' ||
      !title ||
      typeof title !==
        'string' ||
      !addedBy ||
      typeof addedBy !==
        'string' ||
      !addedById ||
      typeof addedById !==
        'string'
    ) {
      return res.status(400).json({
        message:
          'videoId, title, addedBy and addedById are required',
      })
    }

    const room =
      getRoom(
        code.toUpperCase(),
      )

    if (!room) {
      return res.status(404).json({
        message:
          'Room not found',
      })
    }

    /*
     * Prevent duplicate YouTube videos.
     */
    const alreadyQueued =
      room.queue.songs.some(
        (song) =>
          song.videoId ===
          videoId,
      )

    if (alreadyQueued) {
      return res.status(409).json({
        message:
          'This song is already in the queue',
      })
    }

    const song = {
      id: crypto.randomUUID(),
      videoId,
      title,
      addedBy,
      addedById,
    }

    room.queue.songs.push(
      song,
    )

    io.to(
      code.toUpperCase(),
    ).emit(
      'room:updated',
      room,
    )

    return res
      .status(201)
      .json(song)
  },
)

/*
 * SOCKET.IO
 */
io.on(
  'connection',
  (socket) => {
    console.log(
      `Socket connected: ${socket.id}`,
    )

    /*
     * TIME SYNC
     *
     * Bug #2 fix: clients compensate
     * for playback drift using
     * `Date.now() - playback.updatedAt`.
     *
     * `updatedAt` is a SERVER timestamp,
     * but clients were comparing it
     * against their OWN clock. Different
     * devices have different clock drift,
     * so this introduced a constant bias
     * (the observed "~1 second behind").
     *
     * This just echoes the server's
     * current time back immediately so
     * the client can estimate the offset
     * between its clock and the server's.
     */
    socket.on(
      'time:sync',
      (
        _clientTime: number,
        callback: (
          serverTime: number,
        ) => void,
      ) => {
        callback(Date.now())
      },
    )

    /*
     * JOIN SOCKET ROOM
     */
    socket.on(
      'room:join',
      ({
        roomCode,
        userId,
      }: {
        roomCode: string
        userId: string
      }) => {
        const code =
          roomCode.toUpperCase()

        const room =
          getRoom(code)

        if (!room) {
          socket.emit(
            'room:error',
            'Room not found',
          )

          return
        }

        const userExists =
          room.users.some(
            (user) =>
              user.id ===
              userId,
          )

        if (!userExists) {
          socket.emit(
            'room:error',
            'User is not a member of this room',
          )

          return
        }

        socket.data.roomCode =
          code

        socket.data.userId =
          userId

        socket.join(code)

        socket.emit(
          'room:updated',
          room,
        )

        socket.emit(
          'playback:sync',
          room.playback,
        )

        console.log(
          `${socket.id} joined room ${code} as ${userId}`,
        )
      },
    )

    /*
     * PLAY
     */
    socket.on(
      'playback:play',
      ({
        roomCode,
        currentTime,
      }: {
        roomCode: string
        currentTime: number
      }) => {
        const code =
          roomCode.toUpperCase()

        const playback =
          updatePlayback(
            code,
            true,
            currentTime,
          )

        if (!playback) {
          return
        }

        socket
          .to(code)
          .emit(
            'playback:play',
            playback,
          )
      },
    )

    /*
     * PAUSE
     */
    socket.on(
      'playback:pause',
      ({
        roomCode,
        currentTime,
      }: {
        roomCode: string
        currentTime: number
      }) => {
        const code =
          roomCode.toUpperCase()

        const playback =
          updatePlayback(
            code,
            false,
            currentTime,
          )

        if (!playback) {
          return
        }

        socket
          .to(code)
          .emit(
            'playback:pause',
            playback,
          )
      },
    )

    /*
     * SEEK
     */
    socket.on(
      'playback:seek',
      ({
        roomCode,
        currentTime,
        isPlaying,
      }: {
        roomCode: string
        currentTime: number
        isPlaying: boolean
      }) => {
        const code =
          roomCode.toUpperCase()

        const playback =
          updatePlayback(
            code,
            isPlaying,
            currentTime,
          )

        if (!playback) {
          return
        }

        socket
          .to(code)
          .emit(
            'playback:seek',
            playback,
          )
      },
    )

    /*
     * HEARTBEAT
     */
    socket.on(
      'playback:heartbeat',
      ({
        roomCode,
        currentTime,
        isPlaying,
      }: {
        roomCode: string
        currentTime: number
        isPlaying: boolean
      }) => {
        const code =
          roomCode.toUpperCase()

        const room = getRoom(code)

        if (!room) {
          return
        }

        if (
          !room.playback.isPlaying
        ) {
          return
        }

        if (!isPlaying) {
          return
        }

        const playback =
          updatePlayback(
            code,
            true,
            currentTime,
          )

        if (!playback) {
          return
        }

        socket
          .to(code)
          .emit(
            'playback:sync',
            playback,
          )
      },
    )

    /*
     * REMOVE SONG FROM QUEUE
     *
     * Host:
     *   Can remove any queued song.
     *
     * Joiner:
     *   Can remove only songs they added.
     */
    app.delete(
      '/rooms/:roomCode/queue/:songId',
      (req, res) => {
        const {
          roomCode,
          songId,
        } = req.params

        const {
          userId,
        } = req.body

        const code =
          roomCode.toUpperCase()

        if (!userId) {
          return res.status(400).json({
            message:
              'userId is required',
          })
        }

        const room =
          getRoom(code)

        if (!room) {
          return res.status(404).json({
            message:
              'Room not found',
          })
        }

        const user =
          room.users.find(
            (item) =>
              item.id === userId,
          )

        if (!user) {
          return res.status(403).json({
            message:
              'User is not in this room',
          })
        }

        const songIndex =
          room.queue.songs.findIndex(
            (song) =>
              song.id === songId,
          )

        if (songIndex === -1) {
          return res.status(404).json({
            message:
              'Song not found',
          })
        }

        if (songIndex === 0) {
          return res.status(400).json({
            message:
              'The currently playing song cannot be removed here',
          })
        }

        const song =
          room.queue.songs[
            songIndex
          ]

        if (!song) {
          return res.status(404).json({
            message:
              'Song not found',
          })
        }

        if (
          user.role !== 'host' &&
          song.addedById !==
            user.id
        ) {
          return res.status(403).json({
            message:
              'You can only remove songs you added',
          })
        }

        room.queue.songs.splice(
          songIndex,
          1,
        )

        io.to(code).emit(
          'room:updated',
          room,
        )

        return res.status(200).json(
          room,
        )
      },
    )

    /*
     * ASSIGN ADMIN
     *
     * Only the host can promote a
     * joiner to admin.
     */
    app.post(
      '/rooms/:roomCode/admin/:userId',
      (req, res) => {
        const {
          roomCode,
          userId,
        } = req.params

        const {
          requesterId,
        } = req.body

        const code =
          roomCode.toUpperCase()

        if (!requesterId) {
          return res.status(400).json({
            message:
              'requesterId is required',
          })
        }

        const room =
          getRoom(code)

        if (!room) {
          return res.status(404).json({
            message:
              'Room not found',
          })
        }

        const requester =
          room.users.find(
            (user) =>
              user.id === requesterId,
          )

        if (!requester) {
          return res.status(403).json({
            message:
              'User is not in this room',
          })
        }

        if (
          requester.role !== 'host'
        ) {
          return res.status(403).json({
            message:
              'Only the host can assign admins',
          })
        }

        const target =
          room.users.find(
            (user) =>
              user.id === userId,
          )

        if (!target) {
          return res.status(404).json({
            message:
              'User not found in this room',
          })
        }

        if (target.role === 'host') {
          return res.status(400).json({
            message:
              'The host role cannot be changed',
          })
        }

        target.role = 'admin'

        io.to(code).emit(
          'room:updated',
          room,
        )

        return res.status(200).json(
          room,
        )
      },
    )

    /*
     * REMOVE ADMIN
     *
     * Only the host can demote an
     * admin back to a regular joiner.
     */
    app.delete(
      '/rooms/:roomCode/admin/:userId',
      (req, res) => {
        const {
          roomCode,
          userId,
        } = req.params

        const {
          requesterId,
        } = req.body

        const code =
          roomCode.toUpperCase()

        if (!requesterId) {
          return res.status(400).json({
            message:
              'requesterId is required',
          })
        }

        const room =
          getRoom(code)

        if (!room) {
          return res.status(404).json({
            message:
              'Room not found',
          })
        }

        const requester =
          room.users.find(
            (user) =>
              user.id === requesterId,
          )

        if (!requester) {
          return res.status(403).json({
            message:
              'User is not in this room',
          })
        }

        if (
          requester.role !== 'host'
        ) {
          return res.status(403).json({
            message:
              'Only the host can manage admins',
          })
        }

        const target =
          room.users.find(
            (user) =>
              user.id === userId,
          )

        if (!target) {
          return res.status(404).json({
            message:
              'User not found in this room',
          })
        }

        if (target.role !== 'admin') {
          return res.status(400).json({
            message:
              'User is not an admin',
          })
        }

        target.role = 'joiner'

        io.to(code).emit(
          'room:updated',
          room,
        )

        return res.status(200).json(
          room,
        )
      },
    )

    /*
     * KICK USER
     *
     * Host:
     *   Can kick anyone except the host.
     *
     * Admin:
     *   Can kick only joiners (not the
     *   host, and not other admins).
     */
    app.post(
      '/rooms/:roomCode/kick/:userId',
      (req, res) => {
        const {
          roomCode,
          userId,
        } = req.params

        const {
          requesterId,
        } = req.body

        const code =
          roomCode.toUpperCase()

        if (!requesterId) {
          return res.status(400).json({
            message:
              'requesterId is required',
          })
        }

        const room =
          getRoom(code)

        if (!room) {
          return res.status(404).json({
            message:
              'Room not found',
          })
        }

        const requester =
          room.users.find(
            (user) =>
              user.id === requesterId,
          )

        if (!requester) {
          return res.status(403).json({
            message:
              'User is not in this room',
          })
        }

        if (
          requester.role !== 'host' &&
          requester.role !== 'admin'
        ) {
          return res.status(403).json({
            message:
              'Only the host or an admin can kick users',
          })
        }

        const kickedUser =
          room.users.find(
            (user) =>
              user.id === userId,
          )

        if (!kickedUser) {
          return res.status(404).json({
            message:
              'User not found in this room',
          })
        }

        if (
          kickedUser.role ===
          'host'
        ) {
          return res.status(400).json({
            message:
              'The host cannot be kicked',
          })
        }

        /*
         * Admins can only kick joiners —
         * not the host (checked above)
         * and not other admins.
         */
        if (
          requester.role === 'admin' &&
          kickedUser.role !== 'joiner'
        ) {
          return res.status(403).json({
            message:
              'Admins can only kick joiners',
          })
        }

        room.users =
          room.users.filter(
            (user) =>
              user.id !== userId,
          )

        room.queue.songs =
          room.queue.songs.filter(
            (song) =>
              song.addedById !==
              kickedUser.id,
          )

        for (const [
          socketId,
          socket,
        ] of io.sockets.sockets) {
          if (
            socket.data.roomCode ===
              code &&
            socket.data.userId ===
              userId
          ) {
            socket.emit(
              'room:kicked',
            )

            socket.leave(code)
            socket.disconnect(
              true,
            )

            console.log(
              `${socketId} was kicked from room ${code}`,
            )
          }
        }

        io.to(code).emit(
          'room:updated',
          room,
        )

        return res.status(200).json(
          room,
        )
      },
    )

    /*
     * DISCONNECT
     *
     * Do not remove the user here.
     */
    socket.on(
      'disconnect',
      () => {
        console.log(
          `Socket disconnected: ${socket.id}`,
        )
      },
    )
  },
)

httpServer.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `Server running on port ${PORT}`,
    )
    console.log(
      `Also accessible on your LAN at http://<your-laptop-IP>:${PORT}`,
    )
  },
)