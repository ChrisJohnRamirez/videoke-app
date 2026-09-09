import type { RoomUser } from './user.js'
import type { SongQueue } from './queue.js'

export type StripPrize = {
  id: string
  icon: string
  name: string
}

export type StripSettings = {
  enabled: boolean
  prizes: StripPrize[]
  usedPrizeIds: string[]
}



export type PlaybackState = {
  isPlaying: boolean
  currentTime: number
  updatedAt: number
}

export type Room = {
  id: string
  code: string
  hostId: string
  users: RoomUser[]
  queue: SongQueue
  playback: PlaybackState,
  strip: StripSettings
}