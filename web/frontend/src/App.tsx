import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import CalliGen from './pages/CalliGen'

function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/calligen" element={<CalliGen />} />
      </Routes>
    </div>
  )
}

export default App
