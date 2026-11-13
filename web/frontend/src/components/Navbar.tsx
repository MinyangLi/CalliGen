import { Link } from 'react-router-dom'

const Navbar = () => {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl">✒️</span>
              <span className="text-xl font-bold text-primary">CalliGen</span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-8">
            <Link 
              to="/calligen" 
              className="text-gray-700 hover:text-primary font-medium border-b-2 border-primary"
            >
              CalliGen
            </Link>
            <Link 
              to="/reference" 
              className="text-gray-700 hover:text-primary font-medium"
            >
              CalliReference
            </Link>
            <Link 
              to="/motion" 
              className="text-gray-700 hover:text-primary font-medium"
            >
              CalliMotion
            </Link>
            <Link 
              to="/verse" 
              className="text-gray-700 hover:text-primary font-medium"
            >
              CalliVerse
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-700 hover:text-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button className="p-2 text-gray-700 hover:text-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button className="p-2 text-gray-700 hover:text-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
