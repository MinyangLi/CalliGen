import { useState } from 'react'

interface ToolbarProps {
  onToolChange?: (tool: string) => void
}

const Toolbar = ({ onToolChange }: ToolbarProps) => {
  const [selectedTool, setSelectedTool] = useState('brush')

  const tools = [
    { 
      id: 'brush', 
      label: 'Brush - Draw freehand',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      )
    },
    { 
      id: 'eraser', 
      label: 'Eraser - Erase brush strokes',
      icon: (
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 20H7L3 16l9-9 8 8-4 4z"/>
          <path d="M7 16l5-5"/>
        </svg>
      )
    },
    { 
      id: 'select', 
      label: 'Selection - Rect/Lasso in settings',
      icon: (
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="5" width="14" height="14" strokeDasharray="4 2"/>
          <path d="M3 12 Q6 6, 12 6" strokeDasharray="4 2"/>
        </svg>
      )
    },
    { 
      id: 'path', 
      label: 'Path - Create vector paths with anchor points and curves',
      icon: (
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
          <path d="M2 2l7.586 7.586"/>
          <circle cx="11" cy="11" r="2"/>
        </svg>
      )
    },
    { 
      id: 'template', 
      label: 'Template - Place reference image',
      icon: (
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      )
    },
  ]

  const handleToolClick = (toolId: string) => {
    setSelectedTool(toolId)
    onToolChange?.(toolId)
  }

  return (
    <div className="relative w-20 h-full bg-gradient-to-b from-primary/10 to-secondary/10 border-r border-primary/20 py-6 flex flex-col items-center">
      <div className="space-y-3">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool.id)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
              selectedTool === tool.id
                ? 'bg-primary text-white shadow-lg scale-110'
                : 'bg-white text-gray-700 hover:bg-gray-100 hover:scale-105'
            }`}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>
    </div>
  )
}

export default Toolbar
