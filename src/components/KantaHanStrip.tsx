
import {
  useEffect,
  useMemo,
  useState,
} from 'react'

type StripPrize = {
  id: string
  icon: string
  name: string
}

type KantaHanStripProps = {
  prize: StripPrize
  onComplete: () => void
}

function KantaHanStrip({
  prize,
  onComplete,
}: KantaHanStripProps) {
  const prizes = useMemo(
    () => [
      {
        id: 'slot-1',
        icon: '🎤',
        name: 'FREE SONG',
      },
      {
        id: 'slot-2',
        icon: '🎵',
        name: 'BONUS SONG',
      },
      {
        id: 'slot-3',
        icon: '⭐',
        name: 'STAR PRIZE',
      },
      {
        id: 'slot-4',
        icon: '🔥',
        name: 'HOT SONG',
      },
      {
        id: 'slot-5',
        icon: '🎶',
        name: 'SING AGAIN',
      },
    ],
    [],
  )

  /*
   * Build enough copies of the Strip
   * so the animation has a long runway.
   */
  const stripItems = useMemo(() => {
    const result: StripPrize[] = []

    for (let i = 0; i < 12; i++) {
      result.push(...prizes)
    }

    /*
     * Add the actual server-selected
     * prize to the end.
     */
    result.push(prize)

    return result
  }, [prizes, prize])

  const [position, setPosition] =
    useState(0)

  const [spinning, setSpinning] =
    useState(true)

  const [finished, setFinished] =
    useState(false)

  /*
   * START SPIN
   *
   * The Strip spins for 5 seconds.
   */
  useEffect(() => {
    const startTimer =
      window.setTimeout(() => {
        /*
         * Each card:
         *
         * 144px width
         * 12px gap
         *
         * Total = 156px
         */
        const cardWidth = 156

        const targetIndex =
          stripItems.length - 1

        const targetPosition =
          targetIndex * cardWidth

        /*
         * Offset the winning card
         * toward the center indicator.
         */
        const centerOffset = 250

        setPosition(
          Math.max(
            0,
            targetPosition -
              centerOffset,
          ),
        )
      }, 100)

    /*
     * Spin duration = 5 seconds.
     */
    const finishTimer =
      window.setTimeout(() => {
        setSpinning(false)
        setFinished(true)
      }, 5200)

    return () => {
      window.clearTimeout(
        startTimer,
      )

      window.clearTimeout(
        finishTimer,
      )
    }
  }, [stripItems.length])

  /*
   * KEEP THE WINNER VISIBLE
   *
   * After the 5-second spin finishes,
   * keep the result displayed for another
   * 5 seconds before closing.
   */
  useEffect(() => {
    if (!finished) {
      return
    }

    const closeTimer =
      window.setTimeout(() => {
        onComplete()
      }, 5000)

    return () => {
      window.clearTimeout(
        closeTimer,
      )
    }
  }, [
    finished,
    onComplete,
  ])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4">
      <div className="w-full max-w-5xl rounded-3xl bg-white p-6 text-black shadow-2xl">

        {/* Header */}
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            KantaHan
          </p>

          <h2 className="mt-1 text-3xl font-black">
            🎰 STRIP
          </h2>
        </div>

        {/* Strip */}
        <div className="relative mt-10">

          {/* Left fade */}
          <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-24 bg-gradient-to-r from-white to-transparent" />

          {/* Right fade */}
          <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-24 bg-gradient-to-l from-white to-transparent" />

          {/* Center indicator */}
          <div className="pointer-events-none absolute left-1/2 top-[-16px] z-40 h-[calc(100%+32px)] w-1 -translate-x-1/2 bg-black" />

          {/* Top pointer */}
          <div className="pointer-events-none absolute left-1/2 top-[-32px] z-50 -translate-x-1/2 text-3xl">
            ▼
          </div>

          {/* Strip viewport */}
          <div className="overflow-hidden rounded-2xl border-4 border-black bg-gray-100">

            {/* Moving strip */}
            <div
              className="flex w-max gap-3 py-8"
              style={{
                transform: `translateX(-${position}px)`,

                transition: spinning
                  ? 'transform 5s cubic-bezier(0.12, 0.8, 0.15, 1)'
                  : 'none',
              }}
            >
              {stripItems.map(
                (
                  item,
                  index,
                ) => {
                  const isWinner =
                    !spinning &&
                    index ===
                      stripItems.length -
                        1

                  return (
                    <div
                      key={`${item.id}-${index}`}
                      className={`
                        flex
                        h-32
                        w-36
                        shrink-0
                        flex-col
                        items-center
                        justify-center
                        rounded-2xl
                        border-2
                        border-black
                        bg-white
                        transition-all
                        duration-500
                        ${
                          isWinner
                            ? 'scale-105 ring-4 ring-yellow-400'
                            : ''
                        }
                      `}
                    >
                      <div className="text-5xl">
                        {item.icon}
                      </div>

                      <div className="mt-2 px-2 text-center text-xs font-bold">
                        {item.name}
                      </div>
                    </div>
                  )
                },
              )}
            </div>
          </div>
        </div>

        {/* Spinning state */}
        {!finished && (
          <div className="mt-8 text-center">
            <p className="text-xl font-bold">
              🎰 Spinning...
            </p>
          </div>
        )}

        {/* Winner */}
        {finished && (
          <div className="mt-8 text-center">

            <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
              Winner
            </p>

            <div className="mt-2 text-5xl">
              {prize.icon}
            </div>

            <h3 className="mt-2 text-3xl font-black">
              {prize.name}
            </h3>

            <div className="mt-6 text-sm text-gray-500">
              Next song starting...
            </div>

          </div>
        )}

      </div>
    </div>
  )
}

export default KantaHanStrip