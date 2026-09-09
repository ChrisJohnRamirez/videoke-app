import { useState } from 'react'
import {
  Link,
  useNavigate,
} from 'react-router-dom'
import Header from '../components/Header'
import { API_URL, generateId } from '../lib/config'

type StripPrize = {
  id: string
  icon: string
  name: string
}

function CreateRoom() {
  const navigate = useNavigate()

  const [name, setName] = useState(
    localStorage.getItem('kantahan_name') || '',
  )

  const [creating, setCreating] =
    useState(false)

  const [error, setError] =
    useState('')

  const [stripEnabled, setStripEnabled] =
    useState(false)

  const [prizes, setPrizes] =
    useState<StripPrize[]>([
      {
        id: generateId(),
        icon: '🎤',
        name: 'Karaoke Star',
      },
      {
        id: generateId(),
        icon: '⭐',
        name: 'Super Singer',
      },
      {
        id: generateId(),
        icon: '🔥',
        name: 'Hot Mic',
      },
      {
        id: generateId(),
        icon: '🎵',
        name: 'Music Master',
      },
    ])

  const handleNameChange = (
    value: string,
  ) => {
    setName(value)

    localStorage.setItem(
      'kantahan_name',
      value,
    )
  }

  const handlePrizeChange = (
    prizeId: string,
    field: 'icon' | 'name',
    value: string,
  ) => {
    setPrizes((currentPrizes) =>
      currentPrizes.map((prize) =>
        prize.id === prizeId
          ? {
              ...prize,
              [field]: value,
            }
          : prize,
      ),
    )
  }

  const handleAddPrize = () => {
    setPrizes((currentPrizes) => [
      ...currentPrizes,
      {
        id: generateId(),
        icon: '🎁',
        name: 'New Prize',
      },
    ])
  }

  const handleRemovePrize = (
    prizeId: string,
  ) => {
    setPrizes((currentPrizes) =>
      currentPrizes.filter(
        (prize) =>
          prize.id !== prizeId,
      ),
    )
  }

  const handleCreateRoom = async () => {
    const trimmedName =
      name.trim()

    if (!trimmedName) {
      setError(
        'Please enter your name.',
      )
      return
    }

    if (
      stripEnabled &&
      prizes.length === 0
    ) {
      setError(
        'Please add at least one prize.',
      )
      return
    }

    const invalidPrize =
      prizes.some(
        (prize) =>
          !prize.name.trim() ||
          !prize.icon.trim(),
      )

    if (
      stripEnabled &&
      invalidPrize
    ) {
      setError(
        'Please make sure every prize has an icon and name.',
      )
      return
    }

    setCreating(true)
    setError('')

    try {
      const response =
        await fetch(
          `${API_URL}/rooms`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              name: trimmedName,

              strip: {
                enabled:
                  stripEnabled,

                prizes:
                  prizes.map(
                    (prize) => ({
                      id: prize.id,
                      icon:
                        prize.icon.trim(),
                      name:
                        prize.name.trim(),
                    }),
                  ),
              },
            }),
          },
        )

      const data: unknown =
        await response.json()

      if (!response.ok) {
        if (
          typeof data ===
            'object' &&
          data !== null &&
          'message' in data &&
          typeof data.message ===
            'string'
        ) {
          throw new Error(
            data.message,
          )
        }

        throw new Error(
          'Failed to create room',
        )
      }

      if (
        typeof data !==
          'object' ||
        data === null ||
        !('userId' in data) ||
        typeof data.userId !==
          'string' ||
        !('room' in data) ||
        typeof data.room !==
          'object' ||
        data.room === null ||
        !('code' in data.room) ||
        typeof data.room.code !==
          'string'
      ) {
        throw new Error(
          'Invalid response from server',
        )
      }

      localStorage.setItem(
        'kantahan_user_id',
        data.userId,
      )

      localStorage.setItem(
        'kantahan_name',
        trimmedName,
      )

      navigate(
        `/room/${data.room.code}`,
      )
    } catch (error) {
      console.error(error)

      setError(
        error instanceof Error
          ? error.message
          : 'Unable to create room.',
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="min-h-screen">
      <Header title="Create Room" />

      <div className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-10 inline-block"
          >
            ← Back
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold">
              Create a Room
            </h1>

            <p className="mt-3">
              Enter your name and customize
              your videoke room.
            </p>
          </div>

          <div className="space-y-6">

            {/* NAME */}
            <div>
              <label
                htmlFor="name"
                className="mb-2 block font-medium"
              >
                Your Name
              </label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) =>
                  handleNameChange(
                    event.target.value,
                  )
                }
                placeholder="Enter your name"
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            {/* STRIP SETTINGS */}
            <div className="rounded-2xl border p-5">

              <div className="flex items-center justify-between gap-4">

                <div>
                  <h2 className="font-semibold">
                    🎰 Prize Strip
                  </h2>

                  <p className="mt-1 text-sm opacity-60">
                    Randomly select a prize
                    after each song.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setStripEnabled(
                      (enabled) =>
                        !enabled,
                    )
                  }
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    stripEnabled
                      ? 'bg-fuchsia-500'
                      : 'bg-gray-400/40'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                      stripEnabled
                        ? 'left-6'
                        : 'left-1'
                    }`}
                  />
                </button>

              </div>

              {stripEnabled && (
                <div className="mt-6">

                  <div className="mb-3 flex items-center justify-between">

                    <h3 className="font-medium">
                      Prizes
                    </h3>

                    <button
                      type="button"
                      onClick={
                        handleAddPrize
                      }
                      className="rounded-lg border px-3 py-2 text-sm font-semibold"
                    >
                      + Add Prize
                    </button>

                  </div>

                  <div className="space-y-3">

                    {prizes.map(
                      (prize) => (
                        <div
                          key={
                            prize.id
                          }
                          className="flex gap-2"
                        >

                          <input
                            type="text"
                            value={
                              prize.icon
                            }
                            onChange={(
                              event,
                            ) =>
                              handlePrizeChange(
                                prize.id,
                                'icon',
                                event
                                  .target
                                  .value,
                              )
                            }
                            maxLength={4}
                            className="w-16 rounded-xl border px-3 py-3 text-center text-xl"
                          />

                          <input
                            type="text"
                            value={
                              prize.name
                            }
                            onChange={(
                              event,
                            ) =>
                              handlePrizeChange(
                                prize.id,
                                'name',
                                event
                                  .target
                                  .value,
                              )
                            }
                            placeholder="Prize name"
                            className="min-w-0 flex-1 rounded-xl border px-3 py-3"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              handleRemovePrize(
                                prize.id,
                              )
                            }
                            className="rounded-xl border px-3 text-lg"
                            title="Remove prize"
                          >
                            ×
                          </button>

                        </div>
                      ),
                    )}

                  </div>

                  {prizes.length ===
                    0 && (
                    <p className="mt-4 text-center text-sm opacity-50">
                      No prizes added yet.
                    </p>
                  )}

                </div>
              )}

            </div>

            {error && (
              <p className="text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={
                handleCreateRoom
              }
              disabled={
                creating ||
                !name.trim()
              }
              className="w-full rounded-xl py-4 font-semibold disabled:opacity-50"
            >
              {creating
                ? 'Creating...'
                : 'Create Room'}
            </button>

          </div>
        </div>
      </div>
    </main>
  )
}

export default CreateRoom