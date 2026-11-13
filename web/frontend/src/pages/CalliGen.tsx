import { useState, useRef, useEffect } from 'react'
import DrawingCanvas from '../components/DrawingCanvas'
import PreviewPanel from '../components/PreviewPanel'
import Toolbar from '../components/Toolbar'

// 🆕 定义类型
type CanvasMethods = {
  getCanvasImage: (includeReference?: boolean) => Promise<string | null>;
  getCompositeImage: () => Promise<string | null>;
}

const CalliGen = () => {
  const [canvasData, setCanvasData] = useState<string | null>(null)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentTool, setCurrentTool] = useState('brush')
  const [, setMode] = useState<'draw' | 'bg'>('draw')
  
  // 🆕 使用类型别名，明确指定可为null
  const drawingCanvasRef = useRef<CanvasMethods | null>(null);

  // 🆕 添加调试 - 监听状态变化
  console.log('🔍 CalliGen 状态:', {
    canvasData: canvasData ? `有数据 (${canvasData.length} 字符)` : '无数据',
    hasContent: !!canvasData,
    currentTool,
    isGenerating
  });

  // 🆕 修改AI生成函数
  const handleGenerateFont = async (style: string) => {
    console.log('🚀 handleGenerateFont 被调用！风格:', style);
    
    if (!canvasData && !drawingCanvasRef.current) {
      console.warn('❌ 没有画布数据且没有canvas引用')
      return
    }

    setIsGenerating(true)
    setGeneratedImage(null)
    
    try {
      console.log('开始AI生成，风格:', style)
      console.log('当前工具:', currentTool)
      
      // 🎯 关键修改：根据工具选择不同的图片获取方式
      let imageToSend: string | null = null;
      
      if (currentTool === 'template') {
        console.log('Template模式：合并reference layers + drawing canvas')
        // Template模式：获取合并后的图片
        imageToSend = await drawingCanvasRef.current?.getCompositeImage() || null;
      } else {
        console.log('其他模式：只使用drawing canvas')
        // 其他模式：优先使用canvas方法，fallback到canvasData
        if (drawingCanvasRef.current) {
          imageToSend = await drawingCanvasRef.current.getCanvasImage(false);
        }
        if (!imageToSend) {
          imageToSend = canvasData;
        }
      }
      
      if (!imageToSend) {
        throw new Error('无法获取图片数据');
      }
      
      console.log('发送的图片数据大小:', imageToSend.length);
      
      const response = await fetch('/api/generate-font', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageToSend,
          style: style,
          mode: currentTool === 'template' ? 'template' : 'drawing'
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('AI生成成功')
        setGeneratedImage(result.generatedImageUrl)
      } else {
        const errorData = await response.json()
        console.error('生成失败:', errorData.error)
        alert(`生成失败: ${errorData.error}`)
      }
    } catch (error) {
      console.error('AI生成错误:', error)
      alert('生成失败，请检查网络连接和后端服务')
    } finally {
      setIsGenerating(false)
    }
  }

  // 🆕 处理Canvas方法引用
  const handleCanvasMethodsReady = (methods: CanvasMethods) => {
    console.log('✅ Canvas 方法已就绪');
    drawingCanvasRef.current = methods;
  }

  // 🆕 增强的Canvas变化处理
  const handleCanvasChange = (dataUrl: string) => {
    console.log('🎨 Canvas 数据变化:', dataUrl ? `有数据 (${dataUrl.length} 字符)` : '无数据');
    setCanvasData(dataUrl);
    
    // 🔥 如果没有数据但有canvas引用，尝试强制获取
    if (!dataUrl && drawingCanvasRef.current) {
      console.log('🔄 尝试从canvas引用获取数据...');
      drawingCanvasRef.current.getCanvasImage(false).then(result => {
        if (result && result !== dataUrl) {
          console.log('✅ 从canvas引用获取到数据:', result.length);
          setCanvasData(result);
        }
      }).catch(err => {
        console.warn('获取canvas数据失败:', err);
      });
    }
  }

  // 🆕 在组件挂载后尝试获取初始数据
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!canvasData && drawingCanvasRef.current) {
        console.log('🔄 组件挂载后尝试获取初始canvas数据...');
        drawingCanvasRef.current.getCanvasImage(false).then(result => {
          if (result) {
            console.log('✅ 获取到初始canvas数据:', result.length);
            setCanvasData(result);
          }
        }).catch(err => {
          console.warn('获取初始canvas数据失败:', err);
        });
      }
    }, 1000); // 1秒后尝试获取

    return () => clearTimeout(timer);
  }, [canvasData]);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* 左侧工具栏 */}
      <div className="border-r border-gray-200">
        <Toolbar 
          onToolChange={setCurrentTool}
        />
      </div>

      {/* 中间画板区域 */}
      <div className="flex-1 border-r border-gray-200 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h2 className="text-3xl font-bold text-gray-900">Sketch</h2>
            <div className="h-8 w-px bg-gray-300"></div>
            <p className="text-gray-600 text-base">Draw your sketch on this panel</p>
            {/* 🆕 显示当前模式 */}
            <span className={`px-2 py-1 text-xs rounded-full ${
              currentTool === 'template' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {currentTool === 'template' ? 'Template Mode' : 'Drawing Mode'}
            </span>
            {/* 🆕 调试信息 */}
            <span className={`px-2 py-1 text-xs rounded-full ${
              canvasData ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {canvasData ? '✅ 有数据' : '❌ 无数据'}
            </span>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <DrawingCanvas 
            onCanvasChange={handleCanvasChange} // 🆕 使用增强的处理函数
            currentTool={currentTool}
            onModeChange={setMode}
            onCanvasMethodsReady={handleCanvasMethodsReady}
          />
        </div>
      </div>

      {/* 右侧预览面板 */}
      <div className="w-1/2 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h2 className="text-3xl font-bold text-gray-900">CalliGen</h2>
            <div className="h-8 w-px bg-gray-300"></div>
            <p className="text-gray-600 text-base">Get your CalliGen font on this panel</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <PreviewPanel 
            generatedImage={generatedImage} 
            isGenerating={isGenerating}
            hasContent={!!canvasData || !!drawingCanvasRef.current} // 🆕 双重检查
            onGenerateFont={(style) => {
              console.log('🎯 PreviewPanel 调用生成函数:', style);
              handleGenerateFont(style);
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default CalliGen
