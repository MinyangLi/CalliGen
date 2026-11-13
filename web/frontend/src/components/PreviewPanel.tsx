import { useState } from 'react'

interface PreviewPanelProps {
  generatedImage: string | null
  isGenerating: boolean
  hasContent?: boolean
  onGenerateFont?: (style: string) => void
}

const PreviewPanel = ({ 
  generatedImage, 
  isGenerating, 
  hasContent = false,
  onGenerateFont
}: PreviewPanelProps) => {
  const [selectedStyle, setSelectedStyle] = useState('汉仪瘦金书简')
  
  const styles = [
    { name: '汉仪瘦金书简', description: 'Slim Gold Script style with elegant and refined strokes.' },
    { name: '方正隶书简体', description: 'Bold and powerful Li style with strong strokes, emphasizing structure and clarity.' },

    { name: '方正硬笔行书简体', description: 'Hard-pen style mimicking ballpoint or fountain pen writing with consistent stroke width.' },

    { name: '鼎猎珠海体', description: 'Decorative seal script style inspired by ancient bronze inscriptions.' },
    { name: '演示秋鸿楷', description: 'Demonstration style inspired by the elegant strokes of autumn swallows.' }

  ]

  const currentStyleDescription = styles.find(s => s.name === selectedStyle)?.description || ''

  const handleGenerateClick = () => {
    if (hasContent && onGenerateFont) {
      onGenerateFont(selectedStyle)
    }
  }

  const handleDownload = () => {
    if (generatedImage) {
      const link = document.createElement('a')
      link.href = generatedImage
      link.download = `calligraphy-${selectedStyle}-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-start p-6 pb-8">
      {/* Calli Style 选择器 */}
      <div className="w-[500px] mb-4 flex-shrink-0">
        <div className="text-sm font-medium text-gray-700 mb-3">
          <span>Calli Style:</span>
          <span className="text-xs font-normal text-gray-500 ml-2">| Select the style that you want to generate.</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {styles.map((style) => (
            <button
              key={style.name}
              onClick={() => setSelectedStyle(style.name)}
              className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors ${
                selectedStyle === style.name
                  ? 'border-primary bg-primary text-white hover:bg-primary/90'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-primary hover:text-primary'
              }`}
            >
              {style.name}
            </button>
          ))}
        </div>
        {/* 风格描述 */}
        {currentStyleDescription && (
          <div className="mt-2 h-10 flex items-center">
            <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded w-full">
              {currentStyleDescription}
            </div>
          </div>
        )}
      </div>

      {/* 画布容器 - 固定大小 */}
      <div className="w-[500px] h-[500px] flex items-center justify-center flex-shrink-0">
        {isGenerating ? (
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-600 font-medium">Connecting to HPC and generating your calligraphy...</p>
            <p className="text-xs text-gray-500">This may take 2-3 minutes</p>
          </div>
        ) : generatedImage ? (
          <div className="w-full max-w-2xl space-y-4">
            <img
              src={generatedImage}
              alt="Generated Calligraphy"
              className="w-full border-2 border-primary rounded-lg shadow-lg"
            />
            {/* 🆕 修改：只保留Download按钮，居中显示，减少间距 */}
            <div className="flex justify-center pt-2">
              <button 
                onClick={handleDownload}
                className="px-8 py-2 bg-primary text-white rounded-full hover:bg-secondary transition-colors font-medium"
              >
                📥 Download
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border-2 border-primary p-8 w-full h-full flex items-center justify-center">
            <div className="text-center space-y-1">
              <div className="mx-auto w-64 h-64 relative flex items-center justify-center">
                <img 
                  src="/images/default-preview.png" 
                  alt="Calligraphy Preview" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-800">
                  Ready to Generate
                </h3>
                <p className="text-gray-600">
                  No fonts will be generated until you finish the Callisketch on the Sketch Panel.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate Fonts 按钮 - 🆕 调整间距避免重叠 */}
      <div className="w-[500px] mt-6 mb-4 flex-shrink-0">
        <button 
          onClick={handleGenerateClick}
          disabled={!hasContent || isGenerating}
          className={`w-full py-3 rounded-full text-base font-semibold flex items-center justify-center space-x-2 transition-colors ${
            hasContent && !isGenerating
              ? 'bg-secondary text-white hover:bg-primary cursor-pointer' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <span>✨</span>
          <span>{isGenerating ? 'Generating...' : 'Generate Fonts'}</span>
        </button>
      </div>
    </div>
  )
}

export default PreviewPanel