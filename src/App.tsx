import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CreateRoom from './pages/CreateRoom'
import Home from './pages/Home'
import JoinRoom from './pages/JoinRoom'
import Room from './pages/Room'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateRoom />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/room/:roomCode" element={<Room />} />
        <Route path="/join/:roomCode" element={<JoinRoom />}
/>
      </Routes>
    </BrowserRouter>
  )
}

export default App