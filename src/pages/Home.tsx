import kantahanLogo from "../assets/branding/kantahanLogo.png"

function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-10">
          <div id="kantahan-logo-container" className="flex justify-center">
            <img id="kantahan-logo" src={kantahanLogo} alt="Kantahan Karaoke" />
          </div>

          <p className="mt-3 text-lg">
            Family Videoke Together
          </p>
        </div>

        <div className="space-y-4 homeButtonsDiv">
          <a
            href="/create"
            className="block w-full py-4 rounded-xl font-semibold createRoomBtn"
          >
            Create Room
          </a>

          <a
            href="/join"
            className="block w-full py-4 rounded-xl font-semibold joinRoomBtn"
          >
            Join Room
          </a>
        </div>
      </div>
    </main>
  )
}

export default Home