import { useNavigate } from 'react-router-dom'

const Home = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-b from-white to-beige">
      <div className="text-center space-y-8 px-4">
        <h1 className="text-6xl md:text-7xl font-bold text-gray-900">
          Create Your Unique
        </h1>
        <h2 className="text-6xl md:text-7xl font-bold text-gray-900">
          Calligraphy Style
        </h2>
        
        <button
          onClick={() => navigate('/calligen')}
          className="mt-12 px-16 py-4 bg-primary text-white text-xl font-semibold rounded-full hover:bg-secondary transition-colors duration-300 shadow-lg"
        >
          Generate Your Font Now
        </button>
      </div>
    </div>
  )
}

export default Home
