import { useState } from 'react'
import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom'
import Header from '../components/Header'
import { API_URL } from '../lib/config'

function JoinRoom() {
  const navigate = useNavigate()
  const { roomCode: urlRoomCode } = useParams()
  const [name, setName] = useState(
    localStorage.getItem('kantahan_name') || '',
  )

  const [roomCode, setRoomCode] = useState(urlRoomCode?.toUpperCase() || '',)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const handleNameChange = (value: string) => {
    setName(value)
    localStorage.setItem('kantahan_name', value)
  }

  const handleJoinRoom = async () => {
    const trimmedName = name.trim()
    const trimmedRoomCode = roomCode.trim().toUpperCase()

    if (!trimmedName) {
      setError('Please enter your name.')
      return
    }

    if (!trimmedRoomCode) {
      setError('Please enter a room code.')
      return
    }

    setJoining(true)
    setError('')

    try {
      const response = await fetch(
          `${API_URL}/rooms/${trimmedRoomCode}/join`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: trimmedName,
          }),
        },
      )

      const data: unknown = await response.json()

      if (!response.ok) {
        if (
          typeof data === 'object' &&
          data !== null &&
          'message' in data &&
          typeof data.message === 'string'
        ) {
          throw new Error(data.message)
        }

        throw new Error('Failed to join room')
      }

      if (
        typeof data !== 'object' ||
        data === null ||
        !('userId' in data) ||
        typeof data.userId !== 'string' ||
        !('room' in data) ||
        typeof data.room !== 'object' ||
        data.room === null ||
        !('code' in data.room) ||
        typeof data.room.code !== 'string'
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

      navigate(`/room/${data.room.code}`)
    } catch (error) {
      console.error(error)

      setError(
        error instanceof Error
          ? error.message
          : 'Unable to join room.',
      )
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="min-h-screen">
      <Header title="Join Room" />

      <div className="flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="inline-block mb-10"
          >
            ← Back
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold">
              Join a Room
            </h1>

            <p className="mt-3">
              Enter your name and room code to
              join the videoke.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block mb-2 font-medium"
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
                className="w-full px-4 py-3 rounded-xl border"
              />
            </div>

            <div>
              <label
                htmlFor="room-code"
                className="block mb-2 font-medium"
              >
                Room Code
              </label>

              <input
                id="room-code"
                type="text"
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(
                    event.target.value.toUpperCase(),
                  )
                }
                placeholder="Enter room code"
                className="w-full px-4 py-3 rounded-xl border uppercase"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleJoinRoom}
              disabled={
                joining ||
                !name.trim() ||
                !roomCode.trim()
              }
              className="w-full py-4 rounded-xl font-semibold disabled:opacity-50"
            >
              {joining
                ? 'Joining...'
                : 'Join Room'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

export default JoinRoom