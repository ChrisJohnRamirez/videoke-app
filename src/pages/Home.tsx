function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-10">
          <div className="text-5xl mb-4">🎤</div>

          <h1 className="text-4xl font-bold">
            KantaHan
          </h1>

          <p className="mt-3 text-lg">
            Family Videoke Together
          </p>
        </div>

        <div className="space-y-4">
          <a
            href="/create"
            className="block w-full py-4 rounded-xl font-semibold"
          >
            Create Room
          </a>

          <a
            href="/join"
            className="block w-full py-4 rounded-xl font-semibold"
          >
            Join Room
          </a>
        </div>
      </div>
    </main>
  )
}

export default Home