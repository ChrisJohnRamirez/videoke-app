import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  useNavigate,
  useParams,
} from 'react-router-dom'

import { io } from 'socket.io-client'
import YouTube from 'react-youtube'
import { QRCodeCanvas } from 'qrcode.react'

import type { Room as RoomType } from '../types/room'
import type { RoomUser } from '../types/user'
import type { YouTubeSearchResult } from '../types/song'
import { API_URL } from '../lib/config'

import kantahanWordmark from "../assets/branding/kantahan-wordmark.png"

type StripPrize = {
  id: string
  icon: string
  name: string
}

function Room() {
  const { roomCode } = useParams()
  const navigate = useNavigate()

  const [room, setRoom] =
    useState<RoomType | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [showAddSong, setShowAddSong] =
    useState(false)

  const [searchQuery, setSearchQuery] =
    useState('')

  const [searchResults, setSearchResults] =
    useState<YouTubeSearchResult[]>([])

  const [searching, setSearching] =
    useState(false)

  const [addingSong, setAddingSong] =
    useState(false)

  const [skippingSong, setSkippingSong] =
    useState(false)

  const [searchError, setSearchError] =
    useState('')

  const [showShareRoom, setShowShareRoom] =
    useState(false)

  const [copied, setCopied] =
    useState(false)

  /*
   * AUTOMATIC STRIP
   */
  const [showStrip, setShowStrip] =
    useState(false)

  const [stripPrize, setStripPrize] =
    useState<StripPrize | null>(null)

  const [stripSpinning, setStripSpinning] =
    useState(false)

  const [showWinningHighlight, setShowWinningHighlight] =
    useState(false)

  const [stripPosition, setStripPosition] =
    useState(0)

  /*
   * Used when a new song arrives while
   * the Strip is still visible.
   */
  const pendingAutoPlayRef =
    useRef(false)

  /*
   * Keeps the latest room available to
   * Socket.IO callbacks.
   *
   * This prevents stale React closures.
   */
  const roomRef =
    useRef<RoomType | null>(null)

  const currentSongRef =
    useRef<
      RoomType['queue']['songs'][number] | null
    >(null)

  const latestPlaybackRef =
    useRef<
      RoomType['playback'] | null
    >(null)

  /*
   * Prevent starting playback while
   * the Strip is visible.
   */
  const stripActiveRef =
    useRef(false)

  const playerRef = useRef<{
    playVideo: () => void
    pauseVideo: () => void
    seekTo: (
      seconds: number,
      allowSeekAhead: boolean,
    ) => void
    mute: () => void
    unMute: () => void
    getCurrentTime: () => number
  } | null>(null)

  /*
   * Host-only video container. Keeping the fullscreen
   * element outside the YouTube iframe means changing
   * songs does not intentionally exit fullscreen.
   */
  const hostVideoContainerRef =
    useRef<HTMLDivElement | null>(null)

  const socketRef =
    useRef<ReturnType<typeof io> | null>(null)

  /*
   * BUG #2 FIX
   *
   * Estimated offset between this
   * device's clock and the server's
   * clock, in milliseconds.
   *
   * getServerNow() + offset ≈ server's
   * Date.now() at this instant.
   *
   * Without this, elapsed-time math
   * compared server timestamps against
   * a possibly-different local clock,
   * causing a consistent drift (not
   * just network jitter).
   */
  const clockOffsetRef =
    useRef<number>(0)

  const getServerNow = () =>
    Date.now() +
    clockOffsetRef.current

  const isApplyingRemoteChange =
    useRef(false)

  const heartbeatRef =
    useRef<number | null>(null)

  const syncTimeoutRef =
    useRef<number | null>(null)

  const endedSongRef =
    useRef<string | null>(null)

  const startedSongRef =
    useRef<string | null>(null)



  /*
   * Prevent multiple Strip animations
   * from running at the same time.
   */
  const stripTimeoutRef =
    useRef<number | null>(null)

  /*
   * BUG FIX: the reel's "winning" card
   * position was computed using a
   * hardcoded pixel offset (260) that
   * assumed one specific viewport width.
   *
   * On a narrower or wider browser
   * window / screen, the viewport's
   * actual center is a different pixel,
   * so a DIFFERENT card visually lands
   * under the pointer than on other
   * screens — even though the real
   * prize (the data) is identical
   * everywhere.
   *
   * We measure the real viewport width
   * via this ref instead of assuming one.
   */
  const stripViewportRef =
    useRef<HTMLDivElement | null>(null)

  /*
   * Ref to the pointer/arrow marker
   * itself, so we can measure its
   * EXACT real position on screen
   * instead of assuming it sits at
   * viewportWidth / 2.
   *
   * This removes any dependency on
   * box-model details (borders,
   * padding, etc.) between the pointer
   * and the viewport — we just measure
   * both directly and compute the
   * pixel-exact difference.
   */
  const stripPointerRef =
    useRef<HTMLDivElement | null>(null)

  /*
   * Ref to the WINNING card itself.
   *
   * Instead of computing its position
   * analytically (index * assumed card
   * width), we measure where it ACTUALLY
   * rendered. This removes any dependency
   * on assumed card width/gap values,
   * which can silently drift from reality
   * due to browser zoom, font-size
   * scaling, or future style tweaks —
   * and since the winning card is 85
   * cards deep, even a 1px assumption
   * error compounds into a large visible
   * miss.
   */
  const stripWinningCardRef =
    useRef<HTMLDivElement | null>(null)

  /*
   * CURRENT USER
   */
  const userId =
    localStorage.getItem(
      'kantahan_user_id',
    )

  const currentUser =
    room?.users.find(
      (user) =>
        user.id === userId,
    )

  const isHost =
    currentUser?.role === 'host'

  const isAdmin =
    currentUser?.role === 'admin'

  /*
   * CONTROLLER
   *
   * Host AND Admin both get to drive
   * playback: play/pause, autoplay,
   * and pressing Next.
   */
  const isController =
    isHost || isAdmin

  const isHostRef = useRef(isHost)

    useEffect(() => {
      isHostRef.current = isHost
    }, [isHost])

  const isAdminRef = useRef(isAdmin)

    useEffect(() => {
      isAdminRef.current = isAdmin
    }, [isAdmin])

  const isControllerRef =
    useRef(isController)

    useEffect(() => {
      isControllerRef.current =
        isController
    }, [isController])

  /*
   * ADVANCE TO NEXT SONG
   *
   * Actually starts playback of the new
   * current song. Runs once:
   *
   * - There IS a next song queued.
   * - We are the Host or an Admin —
   *   only a controller drives the
   *   shared YouTube playback state.
   * - `room:updated` already told us
   *   a new song is pending
   *   (pendingAutoPlayRef).
   *
   * Called either after the Strip
   * finishes (if it ran), or right
   * away when the server says there's
   * no Strip to show at all — see the
   * `queue:advance` handler below.
   */
  const advanceToNextSongIfPending =
    () => {
      /*
       * IMPORTANT: use roomRef instead
       * of `room` — `room` could be a
       * stale React state value.
       */
      const latestRoom =
        roomRef.current

      const nextSong =
        latestRoom?.queue.songs[0]

      if (!nextSong) {
        console.log(
          'No next song to advance to.',
        )

        pendingAutoPlayRef.current =
          false

        return
      }

      /*
       * Only a controller (Host or
       * Admin) drives YouTube.
       */
      if (
        !isControllerRef.current
      ) {
        return
      }

      /*
       * If the new song hasn't been
       * detected yet, wait.
       */
      if (
        !pendingAutoPlayRef.current
      ) {
        console.log(
          'Next song is not pending yet:',
          nextSong.title,
        )

        return
      }

      pendingAutoPlayRef.current =
        false

      console.log(
        'Starting next song:',
        nextSong.title,
      )

      startedSongRef.current =
        nextSong.id

      endedSongRef.current =
        null

      /*
       * Start the next video.
       */
      const startNextSong =
        () => {
          const player =
            playerRef.current

          if (!player) {
            console.log(
              'Player is not ready yet.',
            )

            /*
             * Keep this pending.
             * handlePlayerReady() will
             * start it when the player
             * becomes available.
             */
            pendingAutoPlayRef.current =
              true

            return
          }

          /*
           * BUG FIX: browsers block
           * programmatic UNMUTED
           * autoplay unless it happens
           * as a direct result of a
           * user click. Mute first to
           * guarantee it starts, then
           * unmute shortly after.
           */
          player.mute()

          player.seekTo(
            0,
            true,
          )

          player.playVideo()

          socketRef.current?.emit(
            'playback:play',
            {
              roomCode,
              currentTime: 0,
            },
          )

          if (
            isControllerRef.current
          ) {
            window.setTimeout(
              () => {
                playerRef.current?.unMute()
              },
              500,
            )
          }
        }

      /*
       * Small delay so React and the
       * YouTube iframe can finish
       * switching to the new video.
       */
      window.setTimeout(
        startNextSong,
        300,
      )
    }

  /*
   * SOCKET CONNECTION
   */
  useEffect(() => {
    if (!roomCode) {
      return
    }

    const socket =
      io(API_URL)

    socketRef.current = socket

    const fetchRoom = async () => {
      try {
        const response =
          await fetch(
            `${API_URL}/rooms/${roomCode}`,
          )

        if (!response.ok) {
          throw new Error(
            'Room not found',
          )
        }

        const data: RoomType =
          await response.json()

        roomRef.current = data

        currentSongRef.current =
          data.queue.songs[0] ?? null

        latestPlaybackRef.current =
          data.playback

        setRoom(data)
      } catch {
        setError(
          'Unable to find this room.',
        )
      } finally {
        setLoading(false)
      }
    }

    /*
     * BUG #2 FIX: measure clock offset
     * relative to the server, using a
     * round trip.
     *
     * offset = (serverTime + roundTrip / 2) - now
     *
     * We add half the round trip to
     * account for the time the request
     * took to reach the server.
     */
    const syncClock = () => {
      const sentAt = Date.now()

      socket.emit(
        'time:sync',
        sentAt,
        (serverTime: number) => {
          const receivedAt =
            Date.now()

          const roundTrip =
            receivedAt - sentAt

          clockOffsetRef.current =
            serverTime +
            roundTrip / 2 -
            receivedAt
        },
      )
    }

    socket.on('connect', () => {
      syncClock()

      const userId =
        localStorage.getItem(
          'kantahan_user_id',
        )

      if (!userId) {
        setError(
          'Unable to identify your user account.',
        )

        setLoading(false)

        return
      }

      socket.emit(
        'room:join',
        {
          roomCode,
          userId,
        },
      )
    })

    /*
     * ROOM UPDATED
     */
    socket.on(
      'room:updated',
      (updatedRoom: RoomType) => {
        const previousRoom =
          roomRef.current

        const previousSongId =
          previousRoom?.queue.songs[0]?.id ??
          null

        const nextSong =
          updatedRoom.queue.songs[0] ??
          null

        const nextSongId =
          nextSong?.id ??
          null

        const songChanged =
          previousSongId !== nextSongId

        roomRef.current =
          updatedRoom

        currentSongRef.current =
          nextSong

        latestPlaybackRef.current =
          updatedRoom.playback

        setRoom(updatedRoom)
        setLoading(false)

        /*
         * A new song entered position 0.
         */
        if (
          songChanged &&
          nextSong &&
          isControllerRef.current
        ) {
          console.log(
            'New current song:',
            nextSong.title,
          )

          startedSongRef.current =
            null

          endedSongRef.current =
            null

          /*
           * The song should start after
           * the Strip finishes.
           */
          pendingAutoPlayRef.current =
            true
        }
      },
    )

    /*
     * ROOM ERROR
     */
    socket.on(
      'room:error',
      (message: string) => {
        setError(message)
        setLoading(false)
      },
    )

    /*
     * KICKED
     */
    socket.on(
      'room:kicked',
      () => {
        socket.disconnect()
        socketRef.current = null

        navigate('/')
      },
    )

    /*
     * AUTOMATIC STRIP PRIZE
     *
     * The server sends the same prize
     * to every connected client.
     */
    socket.on(
      'strip:prize-selected',
      (prize: StripPrize) => {
        if (!prize) {
          return
        }

        console.log(
          'Strip prize received:',
          prize,
        )

        /*
         * Stop previous Strip timer.
         */
        if (
          stripTimeoutRef.current !== null
        ) {
          window.clearTimeout(
            stripTimeoutRef.current,
          )

          stripTimeoutRef.current =
            null
        }

        stripActiveRef.current =
          true

        setStripPrize(prize)
        setShowStrip(true)
        setStripSpinning(false)
        setShowWinningHighlight(false)
        setStripPosition(0)

        /*
         * ------------------------------------------------
         * STRIP POSITION
         * ------------------------------------------------
         *
         * Every client uses exactly the same
         * winning card.
         *
         * We deliberately do NOT use Math.random()
         * here because that would cause Host and
         * Joiners to stop at different cards.
         *
         * The winning card is index 85.
         *
         * We render 100 cards, allowing the Strip
         * to make several visual cycles before
         * landing on the same card.
         */

        const winningIndex = 85

        /*
         * Current card:
         *
         * w-36 = 144px
         * gap-3 = 12px
         *
         * Therefore:
         *
         * 144 + 12 = 156px
         */
        const itemWidth = 144
        const gap = 12
        const step =
          itemWidth + gap

        /*
         * Start from zero.
         */
        setStripPosition(0)

        /*
         * Wait for the initial position
         * to render before applying the
         * transition.
         *
         * This also ensures the viewport
         * element actually exists in the
         * DOM so we can measure its real
         * width (see BUG FIX note above).
         */
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            /*
             * PIXEL-PERFECT FIX (v2):
             *
             * Rather than trusting
             * winningIndex * step (which
             * assumes an exact card width
             * and gap that can silently
             * drift from what actually
             * renders — browser zoom,
             * font-size scaling, future
             * style tweaks — measure
             * where the winning card
             * ACTUALLY rendered, at its
             * natural position (position
             * is still 0 here, untouched
             * by any transform), and
             * measure exactly where the
             * pointer sits. Then compute
             * the exact shift needed to
             * bring the card's center to
             * the pointer's position.
             *
             * This is immune to any
             * card-size/gap assumption
             * being wrong, which matters
             * a lot here since the
             * winning card is 85 cards
             * deep — even a 1px-per-card
             * error would compound into
             * a huge visible miss.
             */
            const viewportEl =
              stripViewportRef.current

            const pointerEl =
              stripPointerRef.current

            const winningCardEl =
              stripWinningCardRef.current

            let finalPosition: number

            if (
              viewportEl &&
              pointerEl &&
              winningCardEl
            ) {
              const viewportRect =
                viewportEl.getBoundingClientRect()

              const pointerRect =
                pointerEl.getBoundingClientRect()

              const cardRect =
                winningCardEl.getBoundingClientRect()

              const pointerX =
                pointerRect.left +
                pointerRect.width /
                  2 -
                viewportRect.left

              const cardCenterX =
                cardRect.left +
                cardRect.width / 2 -
                viewportRect.left

              finalPosition =
                cardCenterX - pointerX
            } else {
              /*
               * Fallback if refs
               * somehow aren't ready —
               * best-effort analytical
               * estimate.
               */
              const viewportWidth =
                viewportEl?.clientWidth ??
                700

              const centerOffset =
                viewportWidth / 2 -
                itemWidth / 2

              finalPosition =
                winningIndex * step -
                centerOffset
            }

            setStripSpinning(true)

            setStripPosition(
              finalPosition,
            )

            /*
             * SPIN DURATION
             *
             * 5 seconds.
             */
            stripTimeoutRef.current =
              window.setTimeout(() => {
                /*
                 * STOP
                 */
                setStripSpinning(false)

                /*
                 * NOW reveal the winning card.
                 */
                setShowWinningHighlight(
                  true,
                )

                console.log(
                  'Strip stopped. Winning prize:',
                  prize.name,
                )

                /*
                 * Keep result visible for
                 * 5 seconds.
                 */
                stripTimeoutRef.current =
                  window.setTimeout(() => {
                    setShowStrip(false)
                    setStripPrize(null)
                    setShowWinningHighlight(
                      false,
                    )
                    setStripPosition(0)

                    stripActiveRef.current =
                      false

                    stripTimeoutRef.current =
                      null

                    advanceToNextSongIfPending()
                  }, 5000)
              }, 5000)
          })
        })
      },
    )

    /*
     * QUEUE ADVANCE (NO STRIP)
     *
     * Sent right after `room:updated`
     * when a song was removed with no
     * Strip prize to show — the Strip
     * is disabled, has no prizes
     * configured, or the Host/Admin
     * pressed Next manually.
     *
     * `room:updated` already flipped
     * pendingAutoPlayRef, so we can
     * start the next song right away
     * instead of waiting on a Strip
     * animation that isn't coming.
     */
    socket.on(
      'queue:advance',
      () => {
        advanceToNextSongIfPending()
      },
    )

    /*
     * FULL PLAYBACK SYNC
     */
    socket.on(
      'playback:sync',
      (
        playback: RoomType['playback'],
      ) => {
        latestPlaybackRef.current =
          playback

        setRoom(
          (currentRoom) => {
            if (!currentRoom) {
              return currentRoom
            }

            const updatedRoom = {
              ...currentRoom,
              playback,
            }

            roomRef.current =
              updatedRoom

            return updatedRoom
          },
        )

        const player =
          playerRef.current

        if (!player) {
          return
        }

        isApplyingRemoteChange.current =
          true

        const elapsed =
          playback.isPlaying
            ? (getServerNow() -
                playback.updatedAt) /
              1000
            : 0

        const targetTime =
          playback.currentTime +
          elapsed

        const currentTime =
          player.getCurrentTime()

        const difference =
          Math.abs(
            currentTime -
              targetTime,
          )

        if (
          difference > 0.25
        ) {
          player.seekTo(
            targetTime,
            true,
          )
        }

        if (
          playback.isPlaying
        ) {
          /*
           * BUG FIX: this runs for BOTH
           * Host and Joiner (it's the
           * periodic heartbeat sync).
           *
           * It was calling mute()
           * unconditionally with no Host
           * check, and never unmuting —
           * so the Host's audio was
           * getting silently killed every
           * time a sync arrived.
           *
           * Only plain Joiners should
           * stay muted; the Host and any
           * Admin keep sound.
           */
          if (!isControllerRef.current) {
            player.mute()
          }

          player.playVideo()
        } else {
          player.pauseVideo()
        }

        window.setTimeout(() => {
          isApplyingRemoteChange.current =
            false
        }, 100)
      },
    )

    /*
     * PLAY
     */
    socket.on(
      'playback:play',
      (
        playback: RoomType['playback'],
      ) => {
        latestPlaybackRef.current =
          playback

        setRoom(
          (currentRoom) => {
            if (!currentRoom) {
              return currentRoom
            }

            const updatedRoom = {
              ...currentRoom,
              playback,
            }

            roomRef.current =
              updatedRoom

            return updatedRoom
          },
        )

        const player =
          playerRef.current

        /*
         * Player may not be ready yet.
         *
         * handlePlayerReady() will use
         * latestPlaybackRef when it becomes ready.
         */
        if (!player) {
          return
        }

        isApplyingRemoteChange.current =
          true

        /*
         * Calculate how much time passed
         * since the Host sent the event.
         */
        const elapsed =
          (getServerNow() -
            playback.updatedAt) /
          1000

        const targetTime =
          playback.currentTime +
          elapsed

        /*
         * Immediately seek to the correct
         * timestamp before playing.
         *
         * This removes most of the Joiner
         * playback delay.
         */
        player.seekTo(
          targetTime,
          true,
        )

        if (
          !isControllerRef.current
        ) {
          player.mute()
        }

        player.playVideo()

        window.setTimeout(() => {
          isApplyingRemoteChange.current =
            false
        }, 100)
      },
    )

    /*
     * PAUSE
     */
    socket.on(
      'playback:pause',
      (
        playback: RoomType['playback'],
      ) => {
        latestPlaybackRef.current =
          playback

        setRoom(
          (currentRoom) => {
            if (!currentRoom) {
              return currentRoom
            }

            const updatedRoom = {
              ...currentRoom,
              playback,
            }

            roomRef.current =
              updatedRoom

            return updatedRoom
          },
        )

        const player =
          playerRef.current

        if (!player) {
          return
        }

        isApplyingRemoteChange.current =
          true

        player.seekTo(
          playback.currentTime,
          true,
        )

        player.pauseVideo()

        window.setTimeout(() => {
          isApplyingRemoteChange.current =
            false
        }, 100)
      },
    )

    /*
     * SEEK
     */
    socket.on(
      'playback:seek',
      (
        playback: RoomType['playback'],
      ) => {
        latestPlaybackRef.current =
          playback

        setRoom(
          (currentRoom) => {
            if (!currentRoom) {
              return currentRoom
            }

            const updatedRoom = {
              ...currentRoom,
              playback,
            }

            roomRef.current =
              updatedRoom

            return updatedRoom
          },
        )

        const player =
          playerRef.current

        if (!player) {
          return
        }

        isApplyingRemoteChange.current =
          true

        const elapsed =
          playback.isPlaying
            ? (getServerNow() -
                playback.updatedAt) /
              1000
            : 0

        const targetTime =
          playback.currentTime +
          elapsed

        player.seekTo(
          targetTime,
          true,
        )

        window.setTimeout(() => {
          isApplyingRemoteChange.current =
            false
        }, 100)
      },
    )

    fetchRoom()

    return () => {
      if (
        heartbeatRef.current !== null
      ) {
        window.clearInterval(
          heartbeatRef.current,
        )

        heartbeatRef.current = null
      }

      if (
        syncTimeoutRef.current !== null
      ) {
        window.clearTimeout(
          syncTimeoutRef.current,
        )

        syncTimeoutRef.current = null
      }

      if (
        stripTimeoutRef.current !== null
      ) {
        window.clearTimeout(
          stripTimeoutRef.current,
        )

        stripTimeoutRef.current = null
      }

      stripActiveRef.current =
        false

      socket.disconnect()

      socketRef.current = null
    }
  }, [
    roomCode,
    navigate,
  ])

  /*
   * SEARCH YOUTUBE
   */
  const handleSearch =
    async () => {
      const query =
        searchQuery.trim()

      if (!query) {
        return
      }

      setSearching(true)
      setSearchError('')
      setSearchResults([])

      try {
        const searchTerm =
          query
            .toLowerCase()
            .includes('karaoke')
            ? query
            : `${query} karaoke`

        const response =
          await fetch(
            `${API_URL}/youtube/search?q=${encodeURIComponent(
              searchTerm,
            )}`,
          )

        if (!response.ok) {
          throw new Error(
            'YouTube search failed',
          )
        }

        const data: YouTubeSearchResult[] =
          await response.json()

        setSearchResults(data)
      } catch {
        setSearchError(
          'Unable to search YouTube. Please try again.',
        )
      } finally {
        setSearching(false)
      }
    }

  /*
   * SHARE ROOM
   */
  const joinLink =
    roomCode
      ? `${window.location.origin}/join/${roomCode}`
      : ''

  const handleCopyRoomLink =
    async () => {
      if (!joinLink) {
        return
      }

      try {
        await navigator.clipboard.writeText(
          joinLink,
        )

        setCopied(true)

        window.setTimeout(() => {
          setCopied(false)
        }, 2000)
      } catch (error) {
        console.error(
          'Unable to copy room link:',
          error,
        )
      }
    }

  const handleShareRoom =
    async () => {
      if (!joinLink) {
        return
      }

      if (navigator.share) {
        try {
          await navigator.share({
            title:
              'Join my KantaHan room',
            text: `Join my KantaHan videoke room: ${roomCode}`,
            url: joinLink,
          })
        } catch (error) {
          console.log(
            'Share cancelled.',
            error,
          )
        }

        return
      }

      await handleCopyRoomLink()
    }

  /*
   * LEAVE ROOM
   */
  const handleLeaveRoom =
    async () => {
      if (!roomCode) {
        return
      }

      const userId =
        localStorage.getItem(
          'kantahan_user_id',
        )

      if (!userId) {
        navigate('/')
        return
      }

      try {
        const response =
          await fetch(
            `${API_URL}/rooms/${roomCode}/leave`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                userId,
              }),
            },
          )

        if (!response.ok) {
          throw new Error(
            'Failed to leave room',
          )
        }

        socketRef.current?.disconnect()
        socketRef.current = null

        navigate('/')
      } catch (error) {
        console.error(
          'Failed to leave room:',
          error,
        )

        setError(
          'Unable to leave the room. Please try again.',
        )
      }
    }

  /*
   * ADD SONG
   */
  const handleAddSong =
    async (
      song: YouTubeSearchResult,
    ) => {
      if (!roomCode) {
        return
      }

      setAddingSong(true)

      try {
        const userId =
          localStorage.getItem(
            'kantahan_user_id',
          )

        const currentUser =
          room?.users.find(
            (user) =>
              user.id === userId,
          )

        const response =
          await fetch(
            `${API_URL}/rooms/${roomCode}/queue`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                videoId:
                  song.videoId,
                title:
                  song.title,
                addedBy:
                  currentUser?.name ||
                  'Unknown',
                addedById:
                  userId,
              }),
            },
          )

        if (!response.ok) {
          const data =
            await response.json()

          if (
            response.status === 409
          ) {
            throw new Error(
              data.message ||
                'This song is already in the queue.',
            )
          }

          throw new Error(
            data.message ||
              'Failed to add song',
          )
        }

        setSearchQuery('')
        setSearchResults([])
        setShowAddSong(false)
      } catch (error) {
        console.error(error)

        setSearchError(
          error instanceof Error
            ? error.message
            : 'Unable to add song to the queue.',
        )
      } finally {
        setAddingSong(false)
      }
    }

  /*
   * CONTROLLER PLAYBACK HEARTBEAT
   *
   * Host or Admin.
   */
  useEffect(() => {
    if (
      !room ||
      !roomCode ||
      !isController
    ) {
      return
    }

    if (
      heartbeatRef.current !== null
    ) {
      window.clearInterval(
        heartbeatRef.current,
      )
    }

    heartbeatRef.current =
      window.setInterval(() => {
        const player =
          playerRef.current

        if (!player) {
          return
        }

        const latestRoom =
          roomRef.current

        if (!latestRoom) {
          return
        }

        if (
          !latestRoom.playback
            .isPlaying
        ) {
          return
        }

        const currentTime =
          player.getCurrentTime()

        socketRef.current?.emit(
          'playback:heartbeat',
          {
            roomCode,
            currentTime,
            isPlaying: true,
          },
        )
      }, 1000)

    return () => {
      if (
        heartbeatRef.current !== null
      ) {
        window.clearInterval(
          heartbeatRef.current,
        )

        heartbeatRef.current = null
      }
    }
  }, [
    room?.playback.isPlaying,
    roomCode,
    isController,
  ])

  /*
   * LOADING
   */
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink font-body text-cream">
        <p className="flex items-center gap-3 font-display text-lg">
          <span className="animate-pulse">
            🎤
          </span>
          Loading room...
        </p>
      </main>
    )
  }

  /*
   * ERROR
   */
  if (error || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-6 font-body text-cream">
        <p className="text-center text-muted">
          {error ||
            'Room not found.'}
        </p>
      </main>
    )
  }

  const currentSong =
    room.queue.songs[0]

  /*
   * YOUTUBE READY
   */
  const handlePlayerReady = (
    event: {
      target: {
        playVideo: () => void
        pauseVideo: () => void
        seekTo: (
          seconds: number,
          allowSeekAhead: boolean,
        ) => void
        mute: () => void
        unMute: () => void
        getCurrentTime: () => number
      }
    },
  ) => {
    playerRef.current =
      event.target

    const latestRoom =
      roomRef.current

    const latestPlayback =
      latestPlaybackRef.current ||
      latestRoom?.playback

    const latestSong =
      currentSongRef.current

    if (
      !latestRoom ||
      !latestPlayback
    ) {
      return
    }

    /*
     * Never start playback while
     * the Strip is active.
     */
    if (
      stripActiveRef.current
    ) {
      console.log(
        'Player ready while Strip is active.',
      )

      return
    }

    const elapsed =
      latestPlayback.isPlaying
        ? (getServerNow() -
            latestPlayback.updatedAt) /
          1000
        : 0

    const targetTime =
      latestPlayback.currentTime +
      elapsed

    if (
      latestPlayback.isPlaying
    ) {
      /*
       * IMPORTANT (Bug #1 fix):
       *
       * A freshly-ready player is still
       * UNSTARTED/CUED. Calling seekTo()
       * before the video has actually
       * started playing can leave the
       * YouTube iframe stuck on a black
       * frame — the seek has nothing
       * buffered yet to jump to.
       *
       * Start playback FIRST, then seek
       * to the target time shortly after,
       * once the player has something
       * to seek within.
       */
      if (!isControllerRef.current) {
        event.target.mute()
      }

      event.target.playVideo()

      window.setTimeout(() => {
        const player =
          playerRef.current

        if (!player) {
          return
        }

        if (
          Math.abs(
            player.getCurrentTime() -
              targetTime,
          ) > 0.15
        ) {
          player.seekTo(
            targetTime,
            true,
          )
        }
      }, 300)
    } else if (
      isControllerRef.current &&
      latestSong &&
      pendingAutoPlayRef.current
    ) {
      /*
       * A controller (Host or Admin)
       * has a new song waiting.
       */
      pendingAutoPlayRef.current =
        false

      startedSongRef.current =
        latestSong.id

      endedSongRef.current =
        null

      /*
       * BUG FIX: same autoplay-policy
       * issue as startNextSong() — an
       * unmuted programmatic playVideo()
       * call (not triggered by a click)
       * can be silently blocked by the
       * browser. This is the exact path
       * that runs when a Joiner adds a
       * song to a previously-empty
       * queue: the controller's player
       * mounts fresh here and tries to
       * play unmuted, and can get
       * blocked — while a plain
       * Joiner's own player is muted
       * and plays fine.
       *
       * Mute first to guarantee it
       * starts, then unmute shortly
       * after for the controller.
       */
      event.target.mute()

      event.target.seekTo(
        0,
        true,
      )

      event.target.playVideo()

      socketRef.current?.emit(
        'playback:play',
        {
          roomCode,
          currentTime: 0,
        },
      )

      if (isControllerRef.current) {
        window.setTimeout(() => {
          playerRef.current?.unMute()
        }, 500)
      }
    } else {
      event.target.pauseVideo()
    }

    /*
     * One more synchronization check
     * shortly after the player becomes
     * ready.
     */
    if (
      syncTimeoutRef.current !== null
    ) {
      window.clearTimeout(
        syncTimeoutRef.current,
      )
    }

    syncTimeoutRef.current =
      window.setTimeout(() => {
        const player =
          playerRef.current

        const latestPlayback =
          latestPlaybackRef.current

        if (
          !player ||
          !latestPlayback
        ) {
          return
        }

        const latestElapsed =
          latestPlayback.isPlaying
            ? (getServerNow() -
                latestPlayback.updatedAt) /
              1000
            : 0

        const latestTargetTime =
          latestPlayback.currentTime +
          latestElapsed

        const currentTime =
          player.getCurrentTime()

        if (
          Math.abs(
            currentTime -
              latestTargetTime,
          ) > 0.25
        ) {
          isApplyingRemoteChange.current =
            true

          player.seekTo(
            latestTargetTime,
            true,
          )

          window.setTimeout(() => {
            isApplyingRemoteChange.current =
              false
          }, 100)
        }
      }, 300)
  }

  /*
   * CONTROLLER PRESSES PLAY
   *
   * Host or Admin.
   */
  const handlePlayerPlay = (
    event: {
      target: {
        getCurrentTime: () => number
      }
    },
  ) => {
    const latestSong =
      currentSongRef.current

    /*
     * This means the song genuinely started.
     */
    if (latestSong) {
      startedSongRef.current =
        latestSong.id

      endedSongRef.current =
        null
    }

    if (
      !roomCode ||
      !isControllerRef.current ||
      isApplyingRemoteChange.current
    ) {
      return
    }

    const currentTime =
      event.target.getCurrentTime()

    socketRef.current?.emit(
      'playback:play',
      {
        roomCode,
        currentTime,
      },
    )
  }

  /*
   * CONTROLLER PRESSES PAUSE
   *
   * Host or Admin.
   */
  const handlePlayerPause = (
    event: {
      target: {
        getCurrentTime: () => number
      }
    },
  ) => {
    if (
      !roomCode ||
      !isControllerRef.current ||
      isApplyingRemoteChange.current
    ) {
      return
    }

    const currentTime =
      event.target.getCurrentTime()

    socketRef.current?.emit(
      'playback:pause',
      {
        roomCode,
        currentTime,
      },
    )
  }

  /*
   * SONG ENDS
   *
   * Server will:
   *
   * 1. Verify song.
   * 2. Select Strip prize (only if
   *    the Strip is enabled and has
   *    prizes configured).
   * 3. Broadcast the Strip prize, OR
   *    tell clients to advance right
   *    away if there's no prize to
   *    show.
   * 4. Remove current song.
   * 5. Move to next song.
   */
  const handlePlayerEnd =
    async () => {
      if (
        !roomCode ||
        !isControllerRef.current
      ) {
        return
      }

      const latestSong =
        currentSongRef.current

      if (!latestSong) {
        return
      }

      const endedSongId =
        latestSong.id

      /*
       * Safety check #1:
       * song must have genuinely started.
       */
      if (
        startedSongRef.current !==
        endedSongId
      ) {
        console.log(
          'Ignoring onEnd because song never actually started:',
          endedSongId,
        )

        return
      }

      /*
       * Safety check #2:
       * prevent duplicate onEnd.
       */
      if (
        endedSongRef.current ===
        endedSongId
      ) {
        console.log(
          'Ignoring duplicate onEnd:',
          endedSongId,
        )

        return
      }

      endedSongRef.current =
        endedSongId

      console.log(
        'Song actually ended. Removing:',
        endedSongId,
      )

      try {
        const response =
          await fetch(
            `${API_URL}/rooms/${roomCode}/queue/current`,
            {
              method: 'DELETE',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                songId:
                  endedSongId,
              }),
            },
          )

        if (
          response.status === 409
        ) {
          console.log(
            'Song was already removed by another request.',
          )

          return
        }

        if (!response.ok) {
          throw new Error(
            'Failed to move to next song',
          )
        }

        /*
         * The server has:
         *
         * - selected Strip prize
         * - emitted strip:prize-selected
         * - removed current song
         * - reset playback
         *
         * room:updated will update
         * roomRef/currentSongRef.
         */
        startedSongRef.current =
          null
      } catch (error) {
        console.error(
          'Failed to move to next song:',
          error,
        )

        endedSongRef.current =
          null
      }
    }

  /*
   * KICK USER
   *
   * Host or Admin (server enforces
   * who can kick whom).
   */
  const handleKickUser =
    async (
      targetUserId: string,
    ) => {
      if (!roomCode) {
        return
      }

      const requesterId =
        localStorage.getItem(
          'kantahan_user_id',
        )

      if (!requesterId) {
        return
      }

      try {
        const response =
          await fetch(
            `${API_URL}/rooms/${roomCode}/kick/${targetUserId}`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                requesterId,
              }),
            },
          )

        if (!response.ok) {
          const data =
            await response.json()

          throw new Error(
            data.message ||
              'Unable to kick user',
          )
        }
      } catch (error) {
        console.error(
          'Unable to kick user:',
          error,
        )

        setError(
          'Unable to kick user. Please try again.',
        )
      }
    }

  /*
   * PROMOTE / DEMOTE ADMIN
   *
   * Host only (server enforces this).
   */
  const handleSetAdmin =
    async (
      targetUserId: string,
      makeAdmin: boolean,
    ) => {
      if (!roomCode) {
        return
      }

      const requesterId =
        localStorage.getItem(
          'kantahan_user_id',
        )

      if (!requesterId) {
        return
      }

      try {
        const response =
          await fetch(
            `${API_URL}/rooms/${roomCode}/admin/${targetUserId}`,
            {
              method: makeAdmin
                ? 'POST'
                : 'DELETE',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                requesterId,
              }),
            },
          )

        if (!response.ok) {
          const data =
            await response.json()

          throw new Error(
            data.message ||
              'Unable to update admin status',
          )
        }
      } catch (error) {
        console.error(
          'Unable to update admin status:',
          error,
        )

        setError(
          'Unable to update admin status. Please try again.',
        )
      }
    }

  /*
   * KEEP THE HOST VIDEO IN FULLSCREEN
   *
   * This is called from the Host's Next button,
   * which is a user gesture and therefore allowed
   * by browser fullscreen policy.
   */
  const ensureHostFullscreen = () => {
    if (!isHost) {
      return
    }

    const container =
      hostVideoContainerRef.current

    if (!container) {
      return
    }

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {
        // Fullscreen can be denied by the browser.
      })
    }
  }

  /*
   * NEXT SONG (MANUAL SKIP)
   *
   * Host or Admin. Always skips the
   * Strip prize, even if it's enabled —
   * the server only awards a prize
   * when a song finishes on its own.
   */
  const handleNextSong =
    async () => {
      ensureHostFullscreen()

      if (
        !roomCode ||
        !isController
      ) {
        return
      }

      const latestSong =
        currentSongRef.current

      if (!latestSong) {
        return
      }

      const requesterId =
        localStorage.getItem(
          'kantahan_user_id',
        )

      if (!requesterId) {
        return
      }

      setSkippingSong(true)

      try {
        const response =
          await fetch(
            `${API_URL}/rooms/${roomCode}/queue/next`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                requesterId,
                songId:
                  latestSong.id,
              }),
            },
          )

        if (
          response.status === 409
        ) {
          console.log(
            'Song was already changed by another request.',
          )

          return
        }

        if (!response.ok) {
          throw new Error(
            'Failed to skip to the next song',
          )
        }
      } catch (error) {
        console.error(
          'Failed to skip to the next song:',
          error,
        )

        setError(
          'Unable to skip this song. Please try again.',
        )
      } finally {
        setSkippingSong(false)
      }
    }

  /*
   * REMOVE QUEUED SONG
   */
  const handleRemoveSong =
    async (
      songId: string,
    ) => {
      if (!roomCode) {
        return
      }

      const userId =
        localStorage.getItem(
          'kantahan_user_id',
        )

      if (!userId) {
        return
      }

      try {
        const response =
          await fetch(
            `${API_URL}/rooms/${roomCode}/queue/${songId}`,
            {
              method: 'DELETE',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                userId,
              }),
            },
          )

        if (!response.ok) {
          const data =
            await response.json()

          throw new Error(
            data.message ||
              'Unable to remove song',
          )
        }
      } catch (error) {
        console.error(
          'Unable to remove song:',
          error,
        )
      }
    }

  return (
    <main className="min-h-screen font-body text-cream">
      <header className="w-full border-b border-line/60 bg-ink-soft/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-5">
          <div className="font-display text-xl font-bold tracking-tight text-cream">
            <img src={kantahanWordmark} alt="Kantahan" className="h-auto w-[150px] max-w-[43vw] sm:w-[175px] md:w-[190px]" />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 sm:flex">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gold-soft">
                Room
              </span>
              <span className="font-mono text-sm font-bold tracking-[0.2em] text-gold">
                {room.code}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowShareRoom(true)
              }
              className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold text-cream transition-colors hover:border-pink/50 hover:bg-card-hover"
            >
              Share
            </button>

            <button
              type="button"
              onClick={
                handleLeaveRoom
              }
              className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-pink/40 hover:text-pink-soft"
            >
              Leave
            </button>
          </div>
        </div>


      </header>

      <div className="mx-auto w-full max-w-7xl min-w-0 px-3 py-5 sm:px-5 sm:py-8 lg:px-8">
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
          <div className="min-w-0">
            {currentSong && isHost && (
              <div ref={hostVideoContainerRef} className="relative aspect-video w-full overflow-hidden rounded-2xl border border-line bg-black shadow-[0_0_60px_-15px_rgba(255,61,138,0.25)]">
                <div className="relative h-full w-full">
                  <YouTube
                    key={currentSong.id}
                    videoId={currentSong.videoId}
                    className="h-full w-full"
                    iframeClassName="h-full w-full"
                    opts={{
                      width: '100%',
                      height: '100%',
                      playerVars: {
                        autoplay: 0,
                        modestbranding: 1,
                        rel: 0,
                        controls: 1,
                        disablekb: 0,
                        fs: 0,
                      },
                    }}
                    onReady={handlePlayerReady}
                    onPlay={handlePlayerPlay}
                    onPause={handlePlayerPause}
                    onEnd={handlePlayerEnd}
                  />

                  <div className="absolute right-2 top-2 z-20 flex gap-2 sm:right-3 sm:top-3">
                    <button type="button" onClick={ensureHostFullscreen} className="rounded-xl border border-white/20 bg-black/60 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/80" title="Fullscreen">
                      ⛶
                    </button>
                    <button type="button" onClick={handleNextSong} disabled={skippingSong} className="rounded-xl border border-white/20 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/80 disabled:opacity-50">
                      {skippingSong ? 'Skipping…' : '⏭ Next'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <section className="mt-5 min-w-0 px-1 sm:px-2">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-pink-soft">🎵 Now Playing</p>

              {currentSong ? (
                <>
                  <div className="mt-2 min-w-0 overflow-hidden whitespace-nowrap text-2xl font-bold leading-tight text-cream sm:text-3xl">
                    <div className={currentSong.title.length > 28 ? 'marquee-track' : 'block truncate'}>
                      <span>{currentSong.title}</span>
                      {currentSong.title.length > 28 && <span aria-hidden="true" className="ml-12">{currentSong.title}</span>}
                    </div>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted sm:text-base">{currentSong.addedBy}</p>
                  {(isHost || isAdmin) && (
                    <button type="button" onClick={handleNextSong} disabled={skippingSong} className="mt-4 w-full rounded-xl bg-pink px-4 py-3.5 font-display font-semibold text-ink shadow-[0_0_25px_-5px_rgba(255,61,138,0.5)] transition-transform hover:scale-[1.01] disabled:opacity-50 sm:w-auto sm:min-w-40">
                      {skippingSong ? 'Skipping…' : '⏭ Next'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-2 text-lg font-semibold text-cream">Walang kumakanta ngayon</p>
                  <p className="mt-1 max-w-md text-sm text-muted">Maghanap ng kanta para masimulan ang videoke night!</p>
                </>
              )}
            </section>

            <section className="mt-5 min-w-0">
              <button type="button" onClick={() => setShowAddSong(true)} className="w-full rounded-2xl border border-pink/70 bg-gradient-to-r from-pink to-fuchsia-600 px-5 py-4 font-display text-base font-semibold text-ink shadow-[0_0_30px_-8px_rgba(255,61,138,0.7)] transition-transform hover:scale-[1.005] sm:py-5 sm:text-lg">
                ＋ Add Song
              </button>

              {showAddSong && (
                <div className="mt-4 min-w-0 rounded-2xl border border-line bg-card p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold text-cream sm:text-xl">Add a Song</h2>
                    <button type="button" onClick={() => { setShowAddSong(false); setSearchQuery(''); setSearchResults([]); setSearchError('') }} className="shrink-0 text-sm text-muted hover:text-cream">Cancel</button>
                  </div>

                  <div className="mt-4 min-w-0">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                      <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleSearch() }} placeholder="Search for a karaoke song..." className="min-w-0 flex-1 rounded-xl border border-line bg-ink-soft px-4 py-3 text-cream placeholder:text-muted-soft focus:border-pink/50 focus:outline-none" />
                      <button type="button" onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="shrink-0 rounded-xl bg-gold px-5 py-3 font-semibold text-ink disabled:opacity-40">{searching ? '...' : 'Search'}</button>
                    </div>
                    {searchError && <p className="mt-3 text-sm text-pink-soft">{searchError}</p>}
                  </div>

                  <div className="mt-5 space-y-3">
                    {searchResults.map((song) => (
                      <div key={song.videoId} className="flex min-w-0 gap-3 rounded-xl border border-line bg-ink-soft p-3">
                        <img src={song.thumbnail} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover sm:h-20 sm:w-32" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-cream">{song.title}</p>
                          <button type="button" onClick={() => handleAddSong(song)} disabled={addingSong} className="mt-2 rounded-lg bg-pink px-3 py-2 text-sm font-semibold text-ink disabled:opacity-40">{addingSong ? 'Adding...' : 'Add to Queue'}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside className="min-w-0 rounded-2xl border border-line bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-cream">🎵 Song Queue</h2>
              <span className="shrink-0 rounded-full bg-line px-3 py-1 text-xs font-semibold text-cream">{room.queue.songs.length} songs</span>
            </div>

            <div className={`mt-4 min-w-0 pr-1 ${room.queue.songs.length > 3 ? 'max-h-72 overflow-y-auto overscroll-contain md:max-h-none md:overflow-visible' : ''}`}>
              {room.queue.songs.length === 0 ? (
                <p className="py-3 text-sm text-muted">Walang laman ang queue — mag-add ng kanta!</p>
              ) : (
                <div className="divide-y divide-line/70">
                  {room.queue.songs.map((song, index) => {
                    const canRemove = index !== 0 && (isHost || song.addedById === currentUser?.id)
                    const longTitle = song.title.length > 24
                    return (
                      <div key={song.id} className={`min-w-0 py-3 ${index === 0 ? 'rounded-xl border border-gold/40 bg-gold/10 px-3' : ''}`}>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${index === 0 ? 'bg-gold text-ink' : 'bg-line text-cream'}`}>{index + 1}</div>
                          <div className="min-w-0 flex-1">
                            {index === 0 && <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-gold-soft">Now Playing</p>}
                            {index === 1 && <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-pink-soft">Up Next</p>}
                            <div className="min-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold text-cream">
                              <div className={longTitle ? 'marquee-track' : 'block truncate'}>
                                <span>{song.title}</span>
                                {longTitle && <span aria-hidden="true" className="ml-10">{song.title}</span>}
                              </div>
                            </div>
                            <p className="truncate text-xs text-muted">{song.addedBy}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {index === 1 && (isHost || isAdmin) && <button type="button" onClick={handleNextSong} disabled={skippingSong} className="rounded-full bg-line px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-pink/30 disabled:opacity-50">Next</button>}
                            {canRemove && <button type="button" onClick={() => handleRemoveSong(song.id)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted hover:text-pink-soft">⋮</button>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>

        <section className="mt-5 rounded-2xl border border-line bg-card p-4 sm:mt-6 sm:p-5">
          <h2 className="font-display text-xl font-semibold text-cream">
            People in Room
          </h2>

          <div className="mt-6 space-y-3">
            {room.users.map(
              (user: RoomUser) => {
                const initials = user.name
                  .trim()
                  .slice(0, 2)
                  .toUpperCase()

                const canKick =
                  isHost
                    ? user.role !==
                      'host'
                    : isAdmin
                      ? user.role ===
                        'joiner'
                      : false

                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-xl border border-line bg-ink-soft px-3 py-2.5"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
                        user.role ===
                        'host'
                          ? 'bg-gold text-ink'
                          : user.role ===
                              'admin'
                            ? 'bg-pink/20 text-pink-soft'
                            : 'bg-cyan/20 text-cyan'
                      }`}
                    >
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-cream">
                        {user.name}
                      </p>

                      <p className="text-xs text-muted">
                        {user.role ===
                        'host'
                          ? '👑 Host'
                          : user.role ===
                              'admin'
                            ? '🛡️ Admin'
                            : 'Joiner'}
                      </p>
                    </div>

                    {isHost &&
                      user.role !==
                        'host' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSetAdmin(
                              user.id,
                              user.role !==
                                'admin',
                            )
                          }
                          className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-cyan"
                        >
                          {user.role ===
                          'admin'
                            ? 'Remove Admin'
                            : 'Make Admin'}
                        </button>
                      )}

                    {canKick && (
                      <button
                        type="button"
                        onClick={() =>
                          handleKickUser(
                            user.id,
                          )
                        }
                        className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-pink-soft"
                      >
                        Kick
                      </button>
                    )}
                  </div>
                )
              },
            )}
          </div>
        </section>
      </div>

      {showShareRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-cream shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-cream">
                Share Room
              </h2>

              <button
                type="button"
                onClick={() =>
                  setShowShareRoom(false)
                }
                className="rounded-lg px-3 py-2 text-sm text-muted hover:text-cream"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 flex justify-center">
              <div className="rounded-xl border-4 border-gold bg-white p-4">
                <QRCodeCanvas
                  value={joinLink}
                  size={220}
                  level="H"
                />
              </div>
            </div>

            <p className="mt-5 text-center text-sm text-muted">
              Scan this QR code to join the room.
            </p>

            <div className="mt-5 rounded-xl border border-gold/40 bg-gold/10 p-3">
              <p className="text-xs uppercase tracking-widest text-gold-soft">
                Room Code
              </p>

              <p className="mt-1 text-center font-mono text-2xl font-bold tracking-widest text-gold">
                {room.code}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-ink-soft p-3">
              <p className="text-xs text-muted">
                Join Link
              </p>

              <p className="mt-1 break-all text-sm text-cream">
                {joinLink}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={
                  handleCopyRoomLink
                }
                className="rounded-xl border border-line px-4 py-3 font-semibold text-cream hover:border-cyan/50"
              >
                {copied
                  ? 'Copied!'
                  : 'Copy Link'}
              </button>

              <button
                type="button"
                onClick={
                  handleShareRoom
                }
                className="rounded-xl bg-pink px-4 py-3 font-semibold text-ink"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {showStrip && stripPrize && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/85 px-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border border-gold/30 bg-card p-6 text-cream shadow-[0_0_80px_-20px_rgba(255,201,74,0.4)]">
            <div className="flex items-center justify-center">
              <h2 className="font-display text-2xl font-bold text-cream">
                🎰 KantaHan Strip
              </h2>
            </div>

            <p className="mt-2 text-center text-muted">
              Tapos na ang kanta! Tingnan
              natin ang panalo mo!
            </p>

            <div className="relative mt-10">
              /*
               * CENTER POINTER
               */
              <div
                ref={
                  stripPointerRef
                }
                className="pointer-events-none absolute left-1/2 top-[-18px] z-30 h-[calc(100%+36px)] w-1 -translate-x-1/2 bg-gold shadow-[0_0_12px_2px_rgba(255,201,74,0.8)]"
              />

              <div className="pointer-events-none absolute left-1/2 top-[-35px] z-40 -translate-x-1/2 text-3xl text-gold drop-shadow-[0_0_8px_rgba(255,201,74,0.7)]">
                ▼
              </div>

              /*
               * LEFT FADE
               */
              <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-24 bg-gradient-to-r from-card to-transparent" />

              /*
               * RIGHT FADE
               */
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-24 bg-gradient-to-l from-card to-transparent" />

              /*
               * STRIP VIEWPORT
               */
              <div
                ref={
                  stripViewportRef
                }
                id="kantahan-strip-viewport"
                className="overflow-hidden rounded-2xl border-4 border-gold/60 bg-ink-soft"
              >
                <div
                  className="flex w-max gap-3 py-8"
                  style={{
                    transform: `translateX(-${stripPosition}px)`,

                    transition:
                      stripSpinning
                        ? 'transform 5s cubic-bezier(0.12, 0.8, 0.15, 1)'
                        : 'none',
                  }}
                >
                  {(() => {
                    /*
                     * PRIZE POOL FIX:
                     *
                     * The reel used to cycle
                     * through a hardcoded, generic
                     * icon set that had nothing to
                     * do with the prizes configured
                     * for this room — only the
                     * single winning card ever
                     * showed a real, configured
                     * prize.
                     *
                     * Now the spinning reel itself
                     * cycles through the room's
                     * actual configured prizes, so
                     * all of them are visible while
                     * it spins.
                     */

                    /*
                     * ALREADY-WON PRIZES:
                     *
                     * The server already tracks
                     * usedPrizeIds so a prize can't
                     * repeat until every prize has
                     * been used once. The reel now
                     * respects that too, so a prize
                     * that already got won stops
                     * showing up until the pool
                     * resets.
                     */
                    const unusedPrizes =
                      room.strip.prizes.filter(
                        (prize) =>
                          !room.strip.usedPrizeIds.includes(
                            prize.id,
                          ),
                      )

                    const prizePool =
                      unusedPrizes.length >
                      0
                        ? unusedPrizes
                        : room.strip
                              .prizes
                              .length > 0
                          ? room.strip
                              .prizes
                          : [
                              {
                                id: 'placeholder',
                                icon: '🎁',
                                name: 'Prize',
                              },
                            ]

                    return Array.from(
                      {
                        /*
                         * 100 cards gives us
                         * enough distance for
                         * the animation.
                         */
                        length: 100,
                      },
                      (_, index) => {
                        /*
                         * EVERY CLIENT uses the
                         * SAME winning index.
                         */
                        const winningIndex =
                          85

                        const isWinning =
                          index ===
                          winningIndex

                        /*
                         * Only highlight after
                         * the Strip stops.
                         */
                        const shouldHighlight =
                          isWinning &&
                          showWinningHighlight

                        const poolPrize =
                          prizePool[
                            index %
                              prizePool.length
                          ]

                        return (
                          <div
                            key={index}
                            ref={
                              isWinning
                                ? stripWinningCardRef
                                : undefined
                            }
                            className={`
                              flex
                              h-28
                              w-36
                              shrink-0
                              flex-col
                              items-center
                              justify-center
                              rounded-xl
                              border-2
                              transition-all
                              duration-300
                              ${
                                shouldHighlight
                                  ? 'scale-105 border-gold bg-gold/20 shadow-[0_0_35px_-5px_rgba(255,201,74,0.8)] ring-4 ring-gold'
                                  : 'border-line bg-card'
                              }
                            `}
                          >
                            <span
                              className={`
                                text-5xl
                                ${
                                  shouldHighlight
                                    ? 'animate-pulse'
                                    : ''
                                }
                              `}
                            >
                              {isWinning
                                ? stripPrize.icon
                                : poolPrize.icon}
                            </span>

                            {isWinning && (
                              <span
                                className={`
                                  mt-1 text-xs font-bold text-gold-soft
                                  transition-opacity duration-300
                                  ${
                                    shouldHighlight
                                      ? 'opacity-100'
                                      : 'opacity-0'
                                  }
                                `}
                              >
                                {
                                  stripPrize.name
                                }
                              </span>
                            )}
                          </div>
                        )
                      },
                    )
                  })()}
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              {stripSpinning ? (
                <p className="font-display text-xl font-bold text-cyan">
                  🎰 Umiikot...
                </p>
              ) : showWinningHighlight ? (
                <div className="animate-pulse">
                  <p className="text-sm font-semibold uppercase tracking-widest text-gold-soft">
                    🎯 Panalo!
                  </p>

                  <p className="mt-2 font-display text-3xl font-black text-cream">
                    {stripPrize.icon}{' '}
                    {stripPrize.name}
                  </p>
                </div>
              ) : (
                <p className="font-display text-xl font-bold text-cyan">
                  🎰 Umiikot...
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Room