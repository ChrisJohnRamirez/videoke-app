import type { Room } from './types/room.js'
import type { Song } from './types/song.js'

const rooms =
  new Map<string, Room>()

export function createRoom(
  name: string,
  strip?: {
    enabled?: boolean
    prizes?: {
      id: string
      icon: string
      name: string
    }[]
  },
) {
  const roomId =
    crypto.randomUUID()

  const userId =
    crypto.randomUUID()

  const code =
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()

  const room: Room = {
    id: roomId,

    code,

    hostId: userId,

    users: [
      {
        id: userId,
        name,
        role: 'host',
      },
    ],

    queue: {
      songs: [],
    },

    playback: {
      isPlaying: false,
      currentTime: 0,
      updatedAt: Date.now(),
    },

    strip: {
      enabled:
        strip?.enabled ?? false,

      prizes:
        strip?.prizes ?? [],

      usedPrizeIds: [],
    },
  }

  rooms.set(
    code,
    room,
  )

  return {
    room,
    userId,
  }
}

export function getRoom(
  code: string,
) {
  return rooms.get(
    code.toUpperCase(),
  )
}

export function joinRoom(
  code: string,
  name: string,
) {
  const room =
    rooms.get(
      code.toUpperCase(),
    )

  if (!room) {
    return null
  }

  const userId =
    crypto.randomUUID()

  room.users.push({
    id: userId,
    name,
    role: 'joiner',
  })

  return {
    room,
    userId,
  }
}

export function addSongToQueue(
  code: string,
  song: Song,
) {
  const room =
    rooms.get(
      code.toUpperCase(),
    )

  if (!room) {
    return null
  }

  /*
   * Prevent the exact same YouTube
   * video from being queued twice.
   */
  const alreadyQueued =
    room.queue.songs.some(
      (queuedSong) =>
        queuedSong.videoId ===
        song.videoId,
    )

  if (alreadyQueued) {
    return null
  }

  room.queue.songs.push(
    song,
  )

  return room
}

export function updatePlayback(
  code: string,
  isPlaying: boolean,
  currentTime: number,
) {
  const room =
    rooms.get(
      code.toUpperCase(),
    )

  if (!room) {
    return null
  }

  room.playback = {
    isPlaying,
    currentTime,
    updatedAt: Date.now(),
  }

  return room.playback
}

/*
 * AUTOMATIC STRIP PRIZE SELECTION
 *
 * This function is called by the server
 * when a song finishes.
 */
export function selectRandomStripPrize(
  code: string,
) {
  const room =
    rooms.get(
      code.toUpperCase(),
    )

  if (!room) {
    return null
  }

  /*
   * Strip disabled.
   */
  if (
    !room.strip.enabled
  ) {
    return null
  }

  /*
   * No prizes configured.
   */
  if (
    room.strip.prizes.length === 0
  ) {
    return null
  }

  /*
   * Find prizes that have not
   * been used yet.
   */
  let availablePrizes =
    room.strip.prizes.filter(
      (prize) =>
        !room.strip.usedPrizeIds.includes(
          prize.id,
        ),
    )

  /*
   * If every prize has already
   * been used, reset the list.
   */
  if (
    availablePrizes.length === 0
  ) {
    room.strip.usedPrizeIds = []

    availablePrizes =
      [...room.strip.prizes]
  }

  /*
   * Select a random prize.
   */
  const randomIndex =
    Math.floor(
      Math.random() *
        availablePrizes.length,
    )

  const selectedPrize =
    availablePrizes[
      randomIndex
    ]

  if (!selectedPrize) {
    return null
  }

  /*
   * Remember that this prize
   * has already been used.
   */
  room.strip.usedPrizeIds.push(
    selectedPrize.id,
  )

  return selectedPrize
}

export function leaveRoom(
  code: string,
  userId: string,
): Room | null {
  const room =
    rooms.get(
      code.toUpperCase(),
    )

  if (!room) {
    return null
  }

  room.users =
    room.users.filter(
      (user) =>
        user.id !== userId,
    )

  /*
   * If nobody is left,
   * delete the room.
   */
  if (
    room.users.length === 0
  ) {
    rooms.delete(
      code.toUpperCase(),
    )

    return null
  }

  /*
   * If the host left,
   * promote another user.
   */
  const hasHost =
    room.users.some(
      (user) =>
        user.role === 'host',
    )

  if (!hasHost) {
    const newHost =
      room.users[0]

    if (newHost) {
      newHost.role = 'host'
      room.hostId = newHost.id
    }
  }

  return room
}