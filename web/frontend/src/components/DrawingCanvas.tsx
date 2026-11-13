import { useRef, useEffect, useState, useCallback } from 'react' // 🆕 添加 useCallback
import { searchCharacterInDatabase } from '../data/calligraphyDatabase'

interface Point {
  x: number
  y: number
}

interface PathPoint extends Point {
  controlPoint1?: Point
  controlPoint2?: Point
}

interface DrawingCanvasProps {
  onCanvasChange: (dataUrl: string) => void
  currentTool?: string
  onModeChange?: (mode: 'draw' | 'bg') => void
  onCanvasMethodsReady?: (methods: {
    getCanvasImage: (includeReference?: boolean) => Promise<string | null>; // 🆕 也改为异步
    getCompositeImage: () => Promise<string | null>;
  }) => void
}

// 参考图层接口
interface ReferenceLayer {
  id: number
  imageUrl: string
  x: number
  y: number
  width: number
  height: number
  opacity: number
  name: string
}



// 碑帖数据库 (每个书体下的碑帖)
const STELE_DATABASE: { [style: string]: Array<{ id: string, name: string, author: string }> } = {
  kai: [
    { id: 'jiuchengong', name: '九成宫', author: '欧阳询' },
    { id: 'duobao', name: '多宝塔', author: '颜真卿' },
    { id: 'xuanmi', name: '玄秘塔', author: '柳公权' },
    { id: 'yanta', name: '雁塔圣教序', author: '褚遂良' },
  ],
  xing: [
    { id: 'lantingxu', name: '兰亭序', author: '王羲之' },
    { id: 'jizhi', name: '祭侄文稿', author: '颜真卿' },
    { id: 'huangzhou', name: '黄州寒食帖', author: '苏轼' },
  ],
  cao: [
    { id: 'shiqitie', name: '十七帖', author: '王羲之' },
    { id: 'zizhi', name: '自叙帖', author: '怀素' },
  ],
  li: [
    { id: 'caoqanbei', name: '曹全碑', author: '汉' },
    { id: 'yiying', name: '乙瑛碑', author: '汉' },
  ],
  zhuan: [
    { id: 'shiguwen', name: '石鼓文', author: '先秦' },
    { id: 'taishan', name: '泰山刻石', author: '李斯' },
  ],
}

// 字形结果接口
interface CharacterResult {
  steleId: string
  steleName: string
  author: string
  imageUrl: string
  character: string
}

const DrawingCanvas = ({ onCanvasChange, currentTool = 'brush', onModeChange, onCanvasMethodsReady }: DrawingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null)
  const [templateImage, setTemplateImage] = useState<string | null>(null)
  const [templateOpacity, setTemplateOpacity] = useState(0.3)
  
  // 参考图相关状态 (支持多图层)
  const [referenceLayers, setReferenceLayers] = useState<ReferenceLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null)
  const [isImageEditMode, setIsImageEditMode] = useState(false) // 图片调整模式 vs 绘画模式
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [isResizingImage, setIsResizingImage] = useState(false)
  const [dragStartPos, setDragStartPos] = useState<Point | null>(null)
  const nextLayerId = useRef(1)

  // 初始化 Canvas 上下文与背景
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    setContext(ctx)

    // 设置初始尺寸（若未由外层控制）
    if (!canvas.width || !canvas.height) {
      canvas.width = 800
      canvas.height = 600
    }
    // 透明背景初始化并缓存
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    backgroundImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
  }, [])
  
  // 字符搜索相关状态
  const [selectedStyle] = useState<string>('kai') // 当前选择的书体
  const [inputChar, setInputChar] = useState<string>('') // 用户输入的字
  const [characterResults, setCharacterResults] = useState<CharacterResult[]>([]) // 搜索结果
  const [isSearching, setIsSearching] = useState(false) // 是否在搜索中
  
  // 路径工具相关状态
  const [pathPoints, setPathPoints] = useState<PathPoint[]>([])
  const [isPathMode, setIsPathMode] = useState(false)
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [isDraggingPoint, setIsDraggingPoint] = useState(false)
  const [isDraggingControl, setIsDraggingControl] = useState<'cp1' | 'cp2' | null>(null)
  const [isCreatingCurve, setIsCreatingCurve] = useState(false)
  const [hoveredControlPoint, setHoveredControlPoint] = useState<{pointIndex: number, type: 'cp1' | 'cp2'} | null>(null)
  const [hoveredCurveSegment, setHoveredCurveSegment] = useState<number | null>(null) // 悬浮的曲线段索引
  const [hoveredAnchor, setHoveredAnchor] = useState<number | null>(null) // 悬浮的锚点索引
  
  // 镜像模式：'symmetric' = 完全对称, 'angle' = 角度镜像, 'independent' = 独立控制
  const [mirrorMode, setMirrorMode] = useState<'symmetric' | 'angle' | 'independent'>('independent')
  // 合并后的选区子模式：矩形或套索
  const [selectionMode, setSelectionMode] = useState<'rect' | 'lasso'>('rect')
  
  // 画笔设置
  const [brushSize, setBrushSize] = useState(3)
  const [brushOpacity, setBrushOpacity] = useState(1)
  const [eraserSize, setEraserSize] = useState(20)
  const [currentColor, setCurrentColor] = useState('#000000')

  // 选区与变换相关状态
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<Point | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<Point | null>(null)
  const [lassoPath, setLassoPath] = useState<Point[]>([]) // 套索自由选区路径点
  const [selectedArea, setSelectedArea] = useState<ImageData | null>(null)
  const [selectionBounds, setSelectionBounds] = useState<{x: number, y: number, width: number, height: number} | null>(null)
  const [isTransforming, setIsTransforming] = useState(false)
  const [transformStart, setTransformStart] = useState<Point | null>(null)
  const [transformMode, setTransformMode] = useState<'move' | 'scale' | 'rotate' | null>(null)
  const [selectionRotation, setSelectionRotation] = useState(0)
  const [hasMovedSelection, setHasMovedSelection] = useState(false)
  const canvasStateBeforeSelection = useRef<ImageData | null>(null)
  const backgroundImageRef = useRef<ImageData | null>(null)

  // 交互辅助状态
  const [eraserCursorPos, setEraserCursorPos] = useState<Point | null>(null)
  const brushStrokeImage = useRef<ImageData | null>(null)
  const currentStrokePoints = useRef<Array<{x: number, y: number}>>([])
  
  // 在所有 useState 声明之后，找到类似这样的位置添加：
// const [eraserCursorPos, setEraserCursorPos] = useState<Point | null>(null)
// const brushStrokeImage = useRef<ImageData | null>(null)
// const currentStrokePoints = useRef<Array<{x: number, y: number}>>([])

// 🆕 添加这两个方法：

// 🆕 先定义 getCompositeImage 方法
const getCompositeImage = useCallback(async () => {
  if (!canvasRef.current) return null;

  const canvas = canvasRef.current;
  
  // 创建合并Canvas
  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = canvas.width;
  compositeCanvas.height = canvas.height;
  const compositeCtx = compositeCanvas.getContext('2d');
  
  if (!compositeCtx) return null;

  // 1. 白色背景
  compositeCtx.fillStyle = '#FFFFFF';
  compositeCtx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

  // 2. 绘制reference layers（从DOM中获取已加载的图片）
  for (const layer of referenceLayers) {
    try {
      // 从DOM中找到对应的img元素
      const imgElement = document.querySelector(`img[src="${layer.imageUrl}"]`) as HTMLImageElement;
      
      if (imgElement && imgElement.complete) {
        compositeCtx.globalAlpha = layer.opacity;
        compositeCtx.drawImage(
          imgElement,
          layer.x,
          layer.y, 
          layer.width,
          layer.height
        );
        compositeCtx.globalAlpha = 1.0;
      }
    } catch (error) {
      console.warn('绘制参考图片失败:', error);
    }
  }

  // 3. 绘制用户绘画内容
  compositeCtx.drawImage(canvas, 0, 0);

  return compositeCanvas.toDataURL('image/png');
}, [referenceLayers]);

// 🆕 然后定义 getCanvasImage 方法（现在可以引用上面的方法了）
const getCanvasImage = useCallback(async (includeReference = false) => {
  if (includeReference) {
    // 如果需要包含参考图层，调用合并方法（异步）
    return await getCompositeImage();
  }

  if (!canvasRef.current) return null;
  
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  // 创建导出Canvas
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportCtx = exportCanvas.getContext('2d');
  
  if (!exportCtx) return null;
  
  // 白色背景
  exportCtx.fillStyle = '#FFFFFF';
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  
  // 绘制用户绘画内容
  exportCtx.drawImage(canvas, 0, 0);
  
  return exportCanvas.toDataURL('image/png');
}, [getCompositeImage]); // 现在 getCompositeImage 已经定义了

// 通知父组件方法已就绪
useEffect(() => {
  if (onCanvasMethodsReady) {
    onCanvasMethodsReady({
      getCanvasImage,
      getCompositeImage
    });
  }
}, [getCanvasImage, getCompositeImage, onCanvasMethodsReady]);
// 🆕 在刚才添加的方法之后，继续添加：



  // 根据当前工具调整路径编辑状态
  useEffect(() => {
    // 切换到 anchor 工具时，确保可以编辑当前路径
    if (currentTool === 'anchor' && pathPoints.length > 0) {
      setIsPathMode(false) // 不再是创建模式，而是编辑模式
    }
  }, [currentTool, pathPoints]) // eslint-disable-line react-hooks/exhaustive-deps

  // 监听 ESC 键完成当前路径（Figma/Illustrator 风格）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && currentTool === 'path') {
        // 如果正在绘制路径，完成当前路径并准备开始新路径
        if (isPathMode && pathPoints.length > 0) {
          // 将当前路径烘焙到画布（作为完成的路径）
          finishPath()
          // 保持在 path 工具，可以继续画新路径
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentTool, isPathMode, pathPoints]) // eslint-disable-line react-hooks/exhaustive-deps

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  // 计算点到贝塞尔曲线的最短距离（简化版本：采样检测）
  const distanceToSegment = (mousePos: Point, segmentIndex: number): number => {
    if (segmentIndex >= pathPoints.length - 1) return Infinity
    
    const p0 = pathPoints[segmentIndex]
    const p1 = pathPoints[segmentIndex + 1]
    
    if (!p0.controlPoint2 || !p1.controlPoint1) {
      // 直线段
      return distanceToLine(mousePos, p0, p1)
    }
    
    // 贝塞尔曲线：采样多个点计算最短距离
    let minDist = Infinity
    const samples = 20
    for (let i = 0; i <= samples; i++) {
      const t = i / samples
      const bezierPoint = getBezierPoint(t, p0, p0.controlPoint2, p1.controlPoint1, p1)
      const dist = Math.sqrt(
        Math.pow(bezierPoint.x - mousePos.x, 2) + 
        Math.pow(bezierPoint.y - mousePos.y, 2)
      )
      minDist = Math.min(minDist, dist)
    }
    return minDist
  }

  // 计算贝塞尔曲线上的点
  const getBezierPoint = (t: number, p0: Point, cp1: Point, cp2: Point, p1: Point): Point => {
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt
    const t2 = t * t
    const t3 = t2 * t
    
    return {
      x: mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p1.x,
      y: mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p1.y
    }
  }

  // 计算点到线段的距离
  const distanceToLine = (point: Point, lineStart: Point, lineEnd: Point): number => {
    const dx = lineEnd.x - lineStart.x
    const dy = lineEnd.y - lineStart.y
    const lengthSquared = dx * dx + dy * dy
    
    if (lengthSquared === 0) {
      return Math.sqrt(
        Math.pow(point.x - lineStart.x, 2) + 
        Math.pow(point.y - lineStart.y, 2)
      )
    }
    
    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared
    t = Math.max(0, Math.min(1, t))
    
    const projX = lineStart.x + t * dx
    const projY = lineStart.y + t * dy
    
    return Math.sqrt(
      Math.pow(point.x - projX, 2) + 
      Math.pow(point.y - projY, 2)
    )
  }

  // 选区工具辅助函数
  const getNormalizedBounds = (start: Point, end: Point) => {
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y)
    }
  }

  const getTransformHandle = (pos: Point, bounds: {x: number, y: number, width: number, height: number}, _rotation: number) => {
    const handleSize = 10
    const corners = [
      { x: bounds.x, y: bounds.y, type: 'nw' },
      { x: bounds.x + bounds.width, y: bounds.y, type: 'ne' },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height, type: 'se' },
      { x: bounds.x, y: bounds.y + bounds.height, type: 'sw' }
    ]

    // 检查角点（缩放）
    for (const corner of corners) {
      const dist = Math.sqrt(Math.pow(pos.x - corner.x, 2) + Math.pow(pos.y - corner.y, 2))
      if (dist < handleSize) return 'scale'
    }

    // 检查旋转控制点（顶部中心上方）
    const rotatePosX = bounds.x + bounds.width / 2
    const rotatePosY = bounds.y - 20
    const rotateDist = Math.sqrt(Math.pow(pos.x - rotatePosX, 2) + Math.pow(pos.y - rotatePosY, 2))
    if (rotateDist < handleSize) return 'rotate'

    return null
  }

  const isPointInSelection = (pos: Point, bounds: {x: number, y: number, width: number, height: number}, _rotation: number) => {
    // 简化版：不考虑旋转的矩形碰撞检测
    return pos.x >= bounds.x && pos.x <= bounds.x + bounds.width &&
           pos.y >= bounds.y && pos.y <= bounds.y + bounds.height
  }

  const handleTransform = (pos: Point) => {
    if (!transformStart || !selectionBounds || !transformMode || !context || !canvasRef.current) return

    // 如果是第一次移动，清空原位置的内容
    if (!hasMovedSelection) {
      // 恢复原始画布状态
      if (canvasStateBeforeSelection.current) {
        context.putImageData(canvasStateBeforeSelection.current, 0, 0)
      }
      // 清空选区原位置
      context.clearRect(selectionBounds.x, selectionBounds.y, selectionBounds.width, selectionBounds.height)
      // 保存清空后的状态
      canvasStateBeforeSelection.current = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
      setHasMovedSelection(true)
    }

    const dx = pos.x - transformStart.x
    const dy = pos.y - transformStart.y

    if (transformMode === 'move') {
      setSelectionBounds({
        ...selectionBounds,
        x: selectionBounds.x + dx,
        y: selectionBounds.y + dy
      })
      setTransformStart(pos)
      redrawCanvas()
    } else if (transformMode === 'scale') {
      const centerX = selectionBounds.x + selectionBounds.width / 2
      const centerY = selectionBounds.y + selectionBounds.height / 2
      const startDist = Math.sqrt(Math.pow(transformStart.x - centerX, 2) + Math.pow(transformStart.y - centerY, 2))
      const currentDist = Math.sqrt(Math.pow(pos.x - centerX, 2) + Math.pow(pos.y - centerY, 2))
      const scale = currentDist / (startDist || 1)

      setSelectionBounds({
        x: centerX - (selectionBounds.width * scale) / 2,
        y: centerY - (selectionBounds.height * scale) / 2,
        width: selectionBounds.width * scale,
        height: selectionBounds.height * scale
      })
      setTransformStart(pos)
      redrawCanvas()
    } else if (transformMode === 'rotate') {
      const centerX = selectionBounds.x + selectionBounds.width / 2
      const centerY = selectionBounds.y + selectionBounds.height / 2
      const angle = Math.atan2(pos.y - centerY, pos.x - centerX) - Math.atan2(transformStart.y - centerY, transformStart.x - centerX)
      setSelectionRotation(selectionRotation + angle)
      setTransformStart(pos)
      redrawCanvas()
    }
  }

  const applySelection = () => {
    if (!selectedArea || !selectionBounds || !context || !canvasRef.current) return

    // 创建临时画布用于变换
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = selectedArea.width
    tempCanvas.height = selectedArea.height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    tempCtx.putImageData(selectedArea, 0, 0)

    // 应用变换并绘制到主画布
    context.save()
    context.translate(selectionBounds.x + selectionBounds.width / 2, selectionBounds.y + selectionBounds.height / 2)
    context.rotate(selectionRotation)
    context.drawImage(tempCanvas, -selectionBounds.width / 2, -selectionBounds.height / 2, selectionBounds.width, selectionBounds.height)
    context.restore()

    // 更新背景缓存为最新画布，防止后续重绘恢复旧内容
    backgroundImageRef.current = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)

    // 关键：应用后完全清空所有选区相关状态
    setSelectedArea(null)
    setSelectionBounds(null)
    setSelectionRotation(0)
    setHasMovedSelection(false)
    canvasStateBeforeSelection.current = null
    setIsSelecting(false)
    setIsTransforming(false)
    setTransformStart(null)
    setTransformMode(null)
    setSelectionStart(null)
    setSelectionEnd(null)
    setLassoPath([])
    
    if (canvasRef.current) {
      onCanvasChange(canvasRef.current.toDataURL())
    }
    
    // 不在这里调用 redrawCanvas，因为状态还未清空，会渲染旧选区
  }

  // 路径工具：点击添加锚点并开始拖动创建曲线
  const handlePathClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e)
    
    // 如果点击在现有锚点附近，则不添加新点
    const clickedOnExisting = pathPoints.some(point => {
      const distance = Math.sqrt(Math.pow(point.x - pos.x, 2) + Math.pow(point.y - pos.y, 2))
      return distance < 10
    })
    
    if (clickedOnExisting) return
    
    // 如果是第一个点，保存当前画布作为背景（包含之前完成的曲线）
    if (pathPoints.length === 0 && canvasRef.current && context) {
      backgroundImageRef.current = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
    
    const newPoint: PathPoint = { 
      x: pos.x, 
      y: pos.y,
      controlPoint1: { x: pos.x, y: pos.y },
      controlPoint2: { x: pos.x, y: pos.y }
    }
    
    setPathPoints(prev => [...prev, newPoint])
    setIsPathMode(true)
    setIsCreatingCurve(true)
    setSelectedPoint(pathPoints.length) // 选中新创建的点
  }

  // 绘制路径和锚点（仅在编辑模式下显示辅助元素）
  const drawPath = (showControls = true) => {
    if (!context || pathPoints.length === 0) return

    // 绘制路径 - 每段分别绘制以支持悬浮高亮
    context.lineWidth = brushSize
    context.globalAlpha = brushOpacity
    context.lineCap = 'round'
    context.lineJoin = 'round'
    
    pathPoints.forEach((point, index) => {
      if (index === 0) return
      
      const prevPoint = pathPoints[index - 1]
      const isHovered = hoveredCurveSegment === index - 1
      
      // 如果悬浮，先绘制加粗的高亮底层
      if (isHovered && showControls) {
        context.strokeStyle = 'rgba(74, 144, 226, 0.3)'
        context.lineWidth = brushSize + 6
        context.beginPath()
        context.moveTo(prevPoint.x, prevPoint.y)
        
        if (prevPoint.controlPoint2 && point.controlPoint1) {
          context.bezierCurveTo(
            prevPoint.controlPoint2.x,
            prevPoint.controlPoint2.y,
            point.controlPoint1.x,
            point.controlPoint1.y,
            point.x,
            point.y
          )
        } else {
          context.lineTo(point.x, point.y)
        }
        context.stroke()
      }
      
      // 绘制正常的曲线
      context.strokeStyle = isHovered && showControls ? '#4A90E2' : currentColor
      context.lineWidth = brushSize
      context.beginPath()
      context.moveTo(prevPoint.x, prevPoint.y)
      
      if (prevPoint.controlPoint2 && point.controlPoint1) {
        context.bezierCurveTo(
          prevPoint.controlPoint2.x,
          prevPoint.controlPoint2.y,
          point.controlPoint1.x,
          point.controlPoint1.y,
          point.x,
          point.y
        )
      } else {
        context.lineTo(point.x, point.y)
      }
      context.stroke()
    })

    // 只在编辑模式下绘制锚点和控制点
    if (!showControls) return

    // 重置透明度以绘制锚点（确保锚点始终不透明）
    context.globalAlpha = 1

    // 绘制锚点
    pathPoints.forEach((point, index) => {
      // 判断该锚点是否应该显示
      const isInHoveredSegment = hoveredCurveSegment !== null && 
        (index === hoveredCurveSegment || index === hoveredCurveSegment + 1)
      const isHoveredAnchor = hoveredAnchor === index
      const shouldShowThisPoint = selectedPoint === index || isInHoveredSegment || isHoveredAnchor
      
      // 绘制锚点
      const isSelected = selectedPoint === index
      const isHighlighted = isInHoveredSegment || isSelected || isHoveredAnchor
      
      // 悬浮时高亮外圈
      if (isHoveredAnchor) {
        context.fillStyle = 'rgba(74, 144, 226, 0.3)'
        context.beginPath()
        context.arc(point.x, point.y, 10, 0, Math.PI * 2)
        context.fill()
      }
      
      context.fillStyle = isSelected ? '#FF6B6B' : (isHighlighted ? '#4A90E2' : '#4A90E2')
      context.beginPath()
      context.arc(point.x, point.y, isHighlighted ? 7 : 6, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = '#FFFFFF'
      context.lineWidth = 2
      context.stroke()

      // 绘制控制点和控制线（只在选中点、悬浮曲线段或悬浮锚点时显示）
      const shouldShowControls = (currentTool === 'anchor' || currentTool === 'path') && shouldShowThisPoint
      if (!shouldShowControls) return

      if (point.controlPoint1) {
        // 检查控制点是否与锚点重合（未被拖动）
        const isDefault = point.controlPoint1.x === point.x && point.controlPoint1.y === point.y
        if (!isDefault) {
          // 绘制控制线
          context.strokeStyle = '#999999'
          context.lineWidth = 1
          context.setLineDash([3, 3])
          context.beginPath()
          context.moveTo(point.x, point.y)
          context.lineTo(point.controlPoint1.x, point.controlPoint1.y)
          context.stroke()
          context.setLineDash([])

          // 绘制控制点，悬浮时高亮
          const isHovered = hoveredControlPoint?.pointIndex === index && hoveredControlPoint?.type === 'cp1'
          const isDragging = isDraggingControl === 'cp1' && selectedPoint === index
          
          if (isHovered || isDragging) {
            // 高亮效果：外圈光晕
            context.fillStyle = 'rgba(255, 165, 0, 0.3)'
            context.beginPath()
            context.arc(point.controlPoint1.x, point.controlPoint1.y, 8, 0, Math.PI * 2)
            context.fill()
          }
          
          context.fillStyle = isHovered || isDragging ? '#FF8C00' : '#FFA500'
          context.beginPath()
          context.arc(point.controlPoint1.x, point.controlPoint1.y, 5, 0, Math.PI * 2)
          context.fill()
          context.strokeStyle = '#FFFFFF'
          context.lineWidth = 1.5
          context.stroke()
        }
      }

      if (point.controlPoint2) {
        // 检查控制点是否与锚点重合（未被拖动）
        const isDefault = point.controlPoint2.x === point.x && point.controlPoint2.y === point.y
        if (!isDefault) {
          // 绘制控制线
          context.strokeStyle = '#999999'
          context.lineWidth = 1
          context.setLineDash([3, 3])
          context.beginPath()
          context.moveTo(point.x, point.y)
          context.lineTo(point.controlPoint2.x, point.controlPoint2.y)
          context.stroke()
          context.setLineDash([])

          // 绘制控制点，悬浮时高亮
          const isHovered = hoveredControlPoint?.pointIndex === index && hoveredControlPoint?.type === 'cp2'
          const isDragging = isDraggingControl === 'cp2' && selectedPoint === index
          
          if (isHovered || isDragging) {
            // 高亮效果：外圈光晕
            context.fillStyle = 'rgba(255, 165, 0, 0.3)'
            context.beginPath()
            context.arc(point.controlPoint2.x, point.controlPoint2.y, 8, 0, Math.PI * 2)
            context.fill()
          }
          
          context.fillStyle = isHovered || isDragging ? '#FF8C00' : '#FFA500'
          context.beginPath()
          context.arc(point.controlPoint2.x, point.controlPoint2.y, 5, 0, Math.PI * 2)
          context.fill()
          context.strokeStyle = '#FFFFFF'
          context.lineWidth = 1.5
          context.stroke()
        }
      }
    })
  }

  // 用于存储绘制路径之前的画布状态（已在顶部声明）

  const redrawCanvas = () => {
    if (!context || !canvasRef.current) return
    const canvas = canvasRef.current
    
    // 选区模式：使用保存的状态而不是清空画布
    if (currentTool === 'select' && canvasStateBeforeSelection.current) {
      context.putImageData(canvasStateBeforeSelection.current, 0, 0)
    } else {
      // 恢复背景（包含之前完成的所有曲线）
      if (backgroundImageRef.current) {
        context.putImageData(backgroundImageRef.current, 0, 0)
      } else {
        // 如果没有背景，清空为透明
        context.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
      
      // 重新绘制当前正在编辑的路径（只在编辑模式下显示辅助元素）
      // isPathMode=true: 正在绘制新路径
      // selectedPoint/hoveredCurveSegment: 正在编辑已有路径
      const isEditingPath = isPathMode || selectedPoint !== null || hoveredCurveSegment !== null
      const showControls = (currentTool === 'path' || currentTool === 'anchor') && isEditingPath
      drawPath(showControls)
      
      // 绘制选区工具的选区框和选中内容（严格只显示当前活动选区）
      if (currentTool === 'select') {
        const hasActiveSelection = !!selectedArea && !!selectionBounds
        const isDragging = isSelecting && selectionStart
        
        // 防御检查：确保 isSelecting 和 hasActiveSelection 不同时为 true
        if (hasActiveSelection && isDragging) {
          // 状态冲突，强制清除拖拽状态
          setIsSelecting(false)
          setSelectionStart(null)
          setSelectionEnd(null)
          setLassoPath([])
          return // 立即返回，不渲染任何内容
        }
        
        // 优先渲染已建立的选区（互斥）：只要存在已建立选区，就不渲染拖拽框
        if (hasActiveSelection) {
          // 绘制选中的内容
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = selectedArea!.width
          tempCanvas.height = selectedArea!.height
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx) {
            tempCtx.putImageData(selectedArea!, 0, 0)
            
            context.save()
            context.translate(selectionBounds!.x + selectionBounds!.width / 2, selectionBounds!.y + selectionBounds!.height / 2)
            context.rotate(selectionRotation)
            context.drawImage(tempCanvas, -selectionBounds!.width / 2, -selectionBounds!.height / 2, selectionBounds!.width, selectionBounds!.height)
            context.restore()
            
            // 绘制变换控制框与控制点
            context.save()
            context.strokeStyle = '#4A90E2'
            context.lineWidth = 2
            context.setLineDash([5, 5])
            context.strokeRect(selectionBounds!.x, selectionBounds!.y, selectionBounds!.width, selectionBounds!.height)
            context.setLineDash([])
            
            const handleSize = 8
            const corners = [
              { x: selectionBounds!.x, y: selectionBounds!.y },
              { x: selectionBounds!.x + selectionBounds!.width, y: selectionBounds!.y },
              { x: selectionBounds!.x + selectionBounds!.width, y: selectionBounds!.y + selectionBounds!.height },
              { x: selectionBounds!.x, y: selectionBounds!.y + selectionBounds!.height }
            ]
            context.fillStyle = '#FFFFFF'
            context.strokeStyle = '#4A90E2'
            context.lineWidth = 2
            corners.forEach(corner => {
              context.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize)
              context.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize)
            })
            
            const rotatePosX = selectionBounds!.x + selectionBounds!.width / 2
            const rotatePosY = selectionBounds!.y - 20
            context.beginPath()
            context.arc(rotatePosX, rotatePosY, 6, 0, Math.PI * 2)
            context.fill()
            context.stroke()
            context.beginPath()
            context.moveTo(selectionBounds!.x + selectionBounds!.width / 2, selectionBounds!.y)
            context.lineTo(rotatePosX, rotatePosY)
            context.stroke()
            context.restore()
          }
        } else if (isDragging) {
          // 绘制正在拖动的选区框或套索路径
          context.save()
          context.strokeStyle = '#4A90E2'
          context.lineWidth = 2
          context.setLineDash([5, 5])
          
          if (selectionMode === 'rect' && selectionEnd) {
            // 矩形选区
            const bounds = getNormalizedBounds(selectionStart, selectionEnd)
            context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
          } else if (selectionMode === 'lasso' && lassoPath.length > 1) {
            // 套索自由路径
            context.beginPath()
            context.moveTo(lassoPath[0].x, lassoPath[0].y)
            for (let i = 1; i < lassoPath.length; i++) {
              context.lineTo(lassoPath[i].x, lassoPath[i].y)
            }
            // 不闭合路径，显示为开放虚线
            context.stroke()
          }
          
          context.setLineDash([])
          context.restore()
        }
      }
  }

  // 普通画笔工具
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!context) return
    
    const pos = getMousePos(e)
    
    // 选区工具逻辑
    if (currentTool === 'select') {
      // 开始新的选区前，重置变换/悬浮状态，避免残留
      setIsTransforming(false)
      setTransformStart(null)
      setTransformMode(null)// 如果已有选区，检查是否点击了变换控制点
      if (selectionBounds && canvasRef.current) {
        const handle = getTransformHandle(pos, selectionBounds, selectionRotation)
        if (handle) {
          setIsTransforming(true)
          setTransformStart(pos)
          setTransformMode(handle as 'move' | 'scale' | 'rotate')
          return
        }
        
        // 检查是否点击在选区内部（移动）
        if (isPointInSelection(pos, selectionBounds, selectionRotation)) {
          setIsTransforming(true)
          setTransformStart(pos)
          setTransformMode('move')
          return
        }
        
        // 点击选区外，直接应用旧选区并返回（第一次点击）
        // 不要开始新选区，让用户再次点击才开始
        if (selectedArea) {
          applySelection()
          // 立即清除 isSelecting 状态，防止鼠标移动时触发 draw 中的重绘
          setIsSelecting(false)
          setSelectionStart(null)
          setSelectionEnd(null)
          setLassoPath([])
          return
        }
      }
      
      // 第二次点击：开始新选区（此时旧选区已被第一次点击应用并清空）
      // 完全清空所有选区相关状态（防御性，确保没有残留）
      setSelectedArea(null)
      setSelectionBounds(null)
      setSelectionRotation(0)
      setHasMovedSelection(false)
      canvasStateBeforeSelection.current = null
      setIsSelecting(false)
      setIsTransforming(false)
      setTransformStart(null)
      setTransformMode(null)
      setLassoPath([])
      
      // 开始新的选区
      // 重要：选区期间的基底应为“干净背景”，不要把任何之前的辅助虚框一起快照进去
      if (canvasRef.current && context) {
        const w = canvasRef.current.width
        const h = canvasRef.current.height
        // 关键修复：直接从当前画布获取最新快照（包含刚画的内容）
        canvasStateBeforeSelection.current = context.getImageData(0, 0, w, h)
        // 同步更新 backgroundImageRef
        backgroundImageRef.current = context.getImageData(0, 0, w, h)
      }
      setIsSelecting(true)
      setSelectionStart(pos)
      setSelectionEnd(pos)
      setLassoPath([pos]) // 初始化套索路径
      return
    }
    
    // 路径工具和锚点工具：检查是否点击控制点或锚点
    if (currentTool === 'path' || currentTool === 'anchor') {
      const pos = getMousePos(e)
      
      // 检查是否点击了控制点（热区：12像素）
      for (let i = 0; i < pathPoints.length; i++) {
        const point = pathPoints[i]
        if (point.controlPoint1) {
          const dist = Math.sqrt(Math.pow(point.controlPoint1.x - pos.x, 2) + Math.pow(point.controlPoint1.y - pos.y, 2))
          if (dist < 12) {
            setSelectedPoint(i)
            setIsDraggingControl('cp1')
            return
          }
        }
        if (point.controlPoint2) {
          const dist = Math.sqrt(Math.pow(point.controlPoint2.x - pos.x, 2) + Math.pow(point.controlPoint2.y - pos.y, 2))
          if (dist < 12) {
            setSelectedPoint(i)
            setIsDraggingControl('cp2')
            return
          }
        }
      }
      
      // 检查是否点击了锚点（热区：15像素，比控制点更大）
      const clickedPoint = pathPoints.findIndex(point => {
        const distance = Math.sqrt(Math.pow(point.x - pos.x, 2) + Math.pow(point.y - pos.y, 2))
        return distance < 15
      })
      if (clickedPoint !== -1) {
        setSelectedPoint(clickedPoint)
        setIsDraggingPoint(true)
        return
      }
      
      // 如果是 path 工具且没有点击任何已有点，则添加新点
      if (currentTool === 'path') {
        handlePathClick(e)
      }
      return
    }
    
    // Template 工具模式下禁用绘图功能
    if (currentTool === 'template') {
      return
    }
    
    // 其他工具的绘制
    setIsDrawing(true)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const startPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    
    // 画笔工具：保存背景并开始收集点
    if (currentTool === 'brush' && canvasRef.current) {
      brushStrokeImage.current = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
      currentStrokePoints.current = [startPoint]
    } else if (currentTool === 'eraser') {
      // 橡皮擦：设置擦除模式
      context.globalCompositeOperation = 'destination-out'
      context.strokeStyle = 'rgba(0,0,0,1)'
      context.lineWidth = eraserSize
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.beginPath()
      context.moveTo(startPoint.x, startPoint.y)
    } else {
      // 其他工具使用原来的方法
      context.beginPath()
      context.moveTo(startPoint.x, startPoint.y)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e)
    
    // 选区工具：绘制选区框或变换选区
    if (currentTool === 'select') {
      if (isSelecting && selectionStart) {
        if (selectionMode === 'rect') {
          setSelectionEnd(pos)
        } else if (selectionMode === 'lasso') {
          // 套索模式：持续收集鼠标轨迹点
          setLassoPath(prev => [...prev, pos])
        }
        redrawCanvas()
        return
      }
      
      if (isTransforming && transformStart && selectionBounds && selectedArea) {
        handleTransform(pos)
        return
      }
      
      // 更新悬浮的控制点
      if (selectionBounds) {
        }
      return
    }
    
    // 更新橡皮擦光标位置（用于显示预览圆圈）
    if (currentTool === 'eraser') {
      setEraserCursorPos(pos)
    } else {
      setEraserCursorPos(null)
    }
    
    // 检测鼠标是否悬浮在控制点、锚点或曲线上（仅在 anchor 工具或 path 工具时）
    if ((currentTool === 'anchor' || currentTool === 'path') && !isDraggingPoint && !isDraggingControl && !isCreatingCurve) {
      let foundHover = false
      
      // 优先检测锚点（最高优先级）- 热区18像素（增大以提高灵敏度）
      for (let i = 0; i < pathPoints.length; i++) {
        const point = pathPoints[i]
        const dist = Math.sqrt(Math.pow(point.x - pos.x, 2) + Math.pow(point.y - pos.y, 2))
        if (dist < 18) {
          if (hoveredAnchor !== i) {
            setHoveredAnchor(i)
            setHoveredControlPoint(null)
            setHoveredCurveSegment(null)
            redrawCanvas()
          }
          foundHover = true
          break
        }
      }
      
      // 如果没悬浮在锚点上，检测控制点 - 热区15像素（增大）
      if (!foundHover) {
        for (let i = 0; i < pathPoints.length; i++) {
          const point = pathPoints[i]
          
          // 检查 controlPoint1
          if (point.controlPoint1) {
            const dist = Math.sqrt(Math.pow(point.controlPoint1.x - pos.x, 2) + Math.pow(point.controlPoint1.y - pos.y, 2))
            if (dist < 15) {
              if (!hoveredControlPoint || hoveredControlPoint.pointIndex !== i || hoveredControlPoint.type !== 'cp1') {
                setHoveredControlPoint({ pointIndex: i, type: 'cp1' })
                setHoveredAnchor(null)
                setHoveredCurveSegment(null)
                redrawCanvas()
              }
              foundHover = true
              break
            }
          }
          
          // 检查 controlPoint2
          if (point.controlPoint2) {
            const dist = Math.sqrt(Math.pow(point.controlPoint2.x - pos.x, 2) + Math.pow(point.controlPoint2.y - pos.y, 2))
            if (dist < 15) {
              if (!hoveredControlPoint || hoveredControlPoint.pointIndex !== i || hoveredControlPoint.type !== 'cp2') {
                setHoveredControlPoint({ pointIndex: i, type: 'cp2' })
                setHoveredAnchor(null)
                setHoveredCurveSegment(null)
                redrawCanvas()
              }
              foundHover = true
              break
            }
          }
        }
      }
      
      // 如果没有悬浮在控制点上，检测曲线段 - 热区10像素
      if (!foundHover) {
        let closestSegment = -1
        let minDist = Infinity
        const hoverThreshold = 10 // 曲线悬浮检测阈值（增大以更容易触发）
        
        for (let i = 0; i < pathPoints.length - 1; i++) {
          const dist = distanceToSegment(pos, i)
          if (dist < hoverThreshold && dist < minDist) {
            minDist = dist
            closestSegment = i
          }
        }
        
        if (closestSegment !== -1) {
          if (hoveredCurveSegment !== closestSegment) {
            setHoveredCurveSegment(closestSegment)
            setHoveredControlPoint(null)
            redrawCanvas()
          }
          foundHover = true
        }
      }
      
      // 清除所有悬浮状态
      if (!foundHover && (hoveredControlPoint || hoveredCurveSegment !== null || hoveredAnchor !== null)) {
        setHoveredControlPoint(null)
        setHoveredCurveSegment(null)
        setHoveredAnchor(null)
        redrawCanvas()
      }
    }
    
    // 路径工具：拖动创建曲线控制点
    if (currentTool === 'path' && isCreatingCurve && selectedPoint !== null) {
      setPathPoints(prev => {
        const newPoints = [...prev]
        const point = newPoints[selectedPoint]
        
        // 计算从锚点到鼠标的向量
        const dx = pos.x - point.x
        const dy = pos.y - point.y
        
        // 设置控制点（两个控制点对称）
        point.controlPoint2 = { x: pos.x, y: pos.y }
        point.controlPoint1 = { x: point.x - dx, y: point.y - dy }
        
        return newPoints
      })
      redrawCanvas()
      return
    }
    
    // 拖动控制点（Path 工具和 Anchor 工具都支持）
      if ((currentTool === 'anchor' || currentTool === 'path') && isDraggingControl && selectedPoint !== null) {
        setPathPoints(prev => {
          const newPoints = [...prev]
          const point = newPoints[selectedPoint]
          
          if (isDraggingControl === 'cp1' && point.controlPoint1) {
            point.controlPoint1 = { x: pos.x, y: pos.y }
            
            // 根据镜像模式更新另一侧控制点
            if (point.controlPoint2 && mirrorMode !== 'independent') {
              const dx = pos.x - point.x
              const dy = pos.y - point.y
              
              if (mirrorMode === 'symmetric') {
                // 完全对称：长度和角度都镜像
                point.controlPoint2 = { x: point.x - dx, y: point.y - dy }
              } else if (mirrorMode === 'angle') {
                // 角度镜像：角度相反，但保持原长度
                const currentLen = Math.sqrt(
                  Math.pow(point.controlPoint2.x - point.x, 2) + 
                  Math.pow(point.controlPoint2.y - point.y, 2)
                )
                const newLen = Math.sqrt(dx * dx + dy * dy)
                const scale = currentLen / (newLen || 1)
                point.controlPoint2 = { x: point.x - dx * scale, y: point.y - dy * scale }
              }
            }
          } else if (isDraggingControl === 'cp2' && point.controlPoint2) {
            point.controlPoint2 = { x: pos.x, y: pos.y }
            
            // 根据镜像模式更新另一侧控制点
            if (point.controlPoint1 && mirrorMode !== 'independent') {
              const dx = pos.x - point.x
              const dy = pos.y - point.y
              
              if (mirrorMode === 'symmetric') {
                // 完全对称：长度和角度都镜像
                point.controlPoint1 = { x: point.x - dx, y: point.y - dy }
              } else if (mirrorMode === 'angle') {
                // 角度镜像：角度相反，但保持原长度
                const currentLen = Math.sqrt(
                  Math.pow(point.controlPoint1.x - point.x, 2) + 
                  Math.pow(point.controlPoint1.y - point.y, 2)
                )
                const newLen = Math.sqrt(dx * dx + dy * dy)
                const scale = currentLen / (newLen || 1)
                point.controlPoint1 = { x: point.x - dx * scale, y: point.y - dy * scale }
              }
            }
          }
          return newPoints
        })
        redrawCanvas()
        return
      }
    
    // 拖动锚点（Path 工具和 Anchor 工具都支持）
    if ((currentTool === 'anchor' || currentTool === 'path') && isDraggingPoint && selectedPoint !== null) {
      setPathPoints(prev => {
        const newPoints = [...prev]
        const point = newPoints[selectedPoint]
        const dx = pos.x - point.x
        const dy = pos.y - point.y
        
        // 移动锚点及其控制点
        point.x = pos.x
        point.y = pos.y
        if (point.controlPoint1) {
          point.controlPoint1.x += dx
          point.controlPoint1.y += dy
        }
        if (point.controlPoint2) {
          point.controlPoint2.x += dx
          point.controlPoint2.y += dy
        }
        
        return newPoints
      })
      redrawCanvas()
      return
    }

    if (!isDrawing || !context) return
    
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const currentPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    
    // 画笔工具：收集点并重绘整条路径
    if (currentTool === 'brush' && canvasRef.current) {
      currentStrokePoints.current.push(currentPoint)
      
      // 恢复背景
      if (brushStrokeImage.current) {
        context.putImageData(brushStrokeImage.current, 0, 0)
      }
      
      // 一次性绘制整条路径（避免透明度叠加）
      context.globalAlpha = brushOpacity
      context.strokeStyle = currentColor
      context.lineWidth = brushSize
      context.lineCap = 'round'
      context.lineJoin = 'round'
      
      context.beginPath()
      currentStrokePoints.current.forEach((point, index) => {
        if (index === 0) {
          context.moveTo(point.x, point.y)
        } else {
          context.lineTo(point.x, point.y)
        }
      })
      context.stroke()
      context.globalAlpha = 1
    } else if (currentTool === 'eraser') {
      // 橡皮擦：继续擦除路径
      context.lineTo(currentPoint.x, currentPoint.y)
      context.stroke()
    } else {
      // 其他工具使用原来的方法
      context.lineTo(currentPoint.x, currentPoint.y)
      context.stroke()
    }
  }

  const stopDrawing = () => {
    // 选区工具：完成选区绘制或变换
    if (currentTool === 'select') {
      if (isSelecting && selectionStart && canvasRef.current) {
        let bounds: {x: number, y: number, width: number, height: number} | null = null
        
        if (selectionMode === 'rect' && selectionEnd) {
          // 矩形模式
          bounds = getNormalizedBounds(selectionStart, selectionEnd)
        } else if (selectionMode === 'lasso' && lassoPath.length > 2) {
          // 套索模式：计算包围盒
          const xs = lassoPath.map(p => p.x)
          const ys = lassoPath.map(p => p.y)
          const minX = Math.min(...xs)
          const maxX = Math.max(...xs)
          const minY = Math.min(...ys)
          const maxY = Math.max(...ys)
          bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
        }
        
        if (bounds && bounds.width > 5 && bounds.height > 5) {
          // 先提取 imageData（在清除 lassoPath 之前）
          let imageData: ImageData
          if (selectionMode === 'rect') {
            // 矩形：直接提取
            imageData = context!.getImageData(bounds.x, bounds.y, bounds.width, bounds.height)
          } else {
            // 套索：使用 clip 提取闭合路径内像素
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = bounds.width
            tempCanvas.height = bounds.height
            const tempCtx = tempCanvas.getContext('2d')
            if (tempCtx) {
              // 绘制套索闭合路径作为裁剪区域
              tempCtx.beginPath()
              tempCtx.moveTo(lassoPath[0].x - bounds.x, lassoPath[0].y - bounds.y)
              for (let i = 1; i < lassoPath.length; i++) {
                tempCtx.lineTo(lassoPath[i].x - bounds.x, lassoPath[i].y - bounds.y)
              }
              tempCtx.closePath()
              tempCtx.clip()
              
              // 将包围盒内的原始像素绘制到临时画布（被 clip 裁剪）
              tempCtx.drawImage(canvasRef.current!, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height)
              imageData = tempCtx.getImageData(0, 0, bounds.width, bounds.height)
            } else {
              imageData = context!.getImageData(bounds.x, bounds.y, bounds.width, bounds.height)
            }
          }
          
          // 关键：先清空旧选区状态，再设置新选区（确保画布上只有一个选区）
          // 如果有旧选区，先将其应用到画布
          if (selectedArea && selectionBounds && context && canvasRef.current) {
            const tempCanvas2 = document.createElement('canvas')
            tempCanvas2.width = selectedArea.width
            tempCanvas2.height = selectedArea.height
            const tempCtx2 = tempCanvas2.getContext('2d')
            if (tempCtx2) {
              tempCtx2.putImageData(selectedArea, 0, 0)
              context.save()
              context.translate(selectionBounds.x + selectionBounds.width / 2, selectionBounds.y + selectionBounds.height / 2)
              context.rotate(selectionRotation)
              context.drawImage(tempCanvas2, -selectionBounds.width / 2, -selectionBounds.height / 2, selectionBounds.width, selectionBounds.height)
              context.restore()
              // 更新背景缓存
              backgroundImageRef.current = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
            }
          }
          
          // 批量设置所有状态：清除拖拽状态并设置新选区数据
          setIsSelecting(false)
          setSelectionStart(null)
          setSelectionEnd(null)
          setLassoPath([])
          setSelectedArea(imageData)
          setSelectionBounds(bounds)
          setSelectionRotation(0)
          setHasMovedSelection(false)// 延迟重绘，等待状态更新
          requestAnimationFrame(() => redrawCanvas())
          return

        }
        setIsSelecting(false)
        setSelectionStart(null)
        setSelectionEnd(null)
        setLassoPath([])
        redrawCanvas()
        return
      }
      
      if (isTransforming) {
        setIsTransforming(false)
        setTransformStart(null)
        setTransformMode(null)
        return
      }
    }
    
    if (currentTool === 'path' && isCreatingCurve) {
      setIsCreatingCurve(false)
      // 不更新 backgroundImageRef，保持背景只包含已完成的曲线
      // 当前正在编辑的路径会在 redrawCanvas 中重新绘制
      redrawCanvas()
      return
    }
    
    // Path 工具或 Anchor 工具：停止拖动
    if (currentTool === 'anchor' || currentTool === 'path') {
      setIsDraggingPoint(false)
      setIsDraggingControl(null)
      return
    }

    if (!isDrawing) return
    
    setIsDrawing(false)
    
    // 画笔工具：清理临时数据
    if (currentTool === 'brush') {
      currentStrokePoints.current = []
      brushStrokeImage.current = null
      // 将当前画布作为新的干净背景快照（不含任何选区辅助元素）
      if (canvasRef.current && context) {
        backgroundImageRef.current = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    } else if (currentTool === 'eraser') {
      // 橡皮擦：重置混合模式并更新背景缓存
      if (context) {
        context.globalCompositeOperation = 'source-over'
        if (canvasRef.current) {
          backgroundImageRef.current = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
        }
      }
    }
    
    if (canvasRef.current) {
      onCanvasChange(canvasRef.current.toDataURL())
    }
  }

  const clearCanvas = () => {
    if (!context || !canvasRef.current) return
    
    // 重置所有 context 属性
    context.globalAlpha = 1
    context.globalCompositeOperation = 'source-over'
    
    // 清空画布（透明）
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    
    // 清空所有状态（包括曲线和参考图片）
    setPathPoints([])
    setIsPathMode(false)
    setSelectedPoint(null)
    backgroundImageRef.current = null
    
    // 清空参考图层
    setReferenceLayers([])
    setSelectedLayerId(null)
    
    // 清空选区相关状态
    setSelectedArea(null)
    setSelectionBounds(null)
    setIsSelecting(false)
    setSelectionStart(null)
    setSelectionEnd(null)
    setLassoPath([])
    
    onCanvasChange('')
  }

  const finishPath = () => {
    if (!context || !canvasRef.current || pathPoints.length === 0) return
    
    // 清空画布重新绘制（移除辅助元素）
    const canvas = canvasRef.current
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    
    // 创建临时画布保存当前内容
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return
    
    // 保存背景（不包括当前路径的辅助元素）
    tempCtx.fillStyle = 'white'
    tempCtx.fillRect(0, 0, canvas.width, canvas.height)
    tempCtx.putImageData(imageData, 0, 0)
    
    // 清空画布
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // 恢复背景内容
    context.drawImage(tempCanvas, 0, 0)
    
    // 绘制最终路径（不显示辅助元素）
    context.strokeStyle = currentColor
    context.lineWidth = brushSize
    context.globalAlpha = brushOpacity
    context.beginPath()
    
    pathPoints.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y)
      } else {
        const prevPoint = pathPoints[index - 1]
        if (prevPoint.controlPoint2 && point.controlPoint1) {
          // 检查是否真的有曲线（控制点不在锚点上）
          const hasRealCurve = 
            (prevPoint.controlPoint2.x !== prevPoint.x || prevPoint.controlPoint2.y !== prevPoint.y) ||
            (point.controlPoint1.x !== point.x || point.controlPoint1.y !== point.y)
          
          if (hasRealCurve) {
            context.bezierCurveTo(
              prevPoint.controlPoint2.x,
              prevPoint.controlPoint2.y,
              point.controlPoint1.x,
              point.controlPoint1.y,
              point.x,
              point.y
            )
          } else {
            context.lineTo(point.x, point.y)
          }
        } else {
          context.lineTo(point.x, point.y)
        }
      }
    })
    context.stroke()
    
    // 重置 globalAlpha
    context.globalAlpha = 1
    
    // 保存烘焙后的画布作为新的背景（包含已完成的路径）
    backgroundImageRef.current = context.getImageData(0, 0, canvas.width, canvas.height)
    
    // 清空路径数据，准备绘制新路径
    setPathPoints([])
    setIsPathMode(false)
    setSelectedPoint(null)
    setIsCreatingCurve(false)
    setHoveredControlPoint(null)
    setHoveredCurveSegment(null)
    
    onCanvasChange(canvasRef.current.toDataURL())
  }

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Template 模式最多允许3张图片
    if (currentTool === 'template' && referenceLayers.length >= 3) {
      alert('最多只能添加3张参考图')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      
      if (!canvasRef.current) return
      const canvas = canvasRef.current
      
      // 计算图片初始大小 - 保持原始比例
      const img = new Image()
      img.onload = () => {
        // 计算缩放比例，确保图片适应画布（最大占60%）
        const scale = Math.min(
          (canvas.width * 0.6) / img.width,
          (canvas.height * 0.6) / img.height,
          1 // 不放大，最大保持原尺寸
        )
        const scaledWidth = img.width * scale
        const scaledHeight = img.height * scale
        const x = (canvas.width - scaledWidth) / 2
        const y = (canvas.height - scaledHeight) / 2
        
        // 添加到参考图层
        const newLayer: ReferenceLayer = {
          id: nextLayerId.current++,
          imageUrl,
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
          opacity: 1, // 完全不透明
          name: file.name || `上传图片${nextLayerId.current - 1}`
        }
        setReferenceLayers(prev => [...prev, newLayer])
        setSelectedLayerId(newLayer.id)
        
        // 切换到 BG 模式以便编辑
        onModeChange?.('bg')
        setIsImageEditMode(true)
      }
      img.src = imageUrl
    }
    reader.readAsDataURL(file)
  }

  const removeTemplate = () => {
    setTemplateImage(null)
  }

  // 处理参考图上传 (用于描红辅助)
  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 检查是否已达到最大图层数
    if (referenceLayers.length >= 3) {
      alert('最多只能添加3张参考图')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      const newLayer: ReferenceLayer = {
        id: nextLayerId.current++,
        imageUrl,
        x: 100,
        y: 100,
        width: 300,
        height: 300,
        opacity: 0.5,
        name: file.name || `参考图${nextLayerId.current - 1}`
      }
      setReferenceLayers(prev => [...prev, newLayer])
      setSelectedLayerId(newLayer.id)
    }
    reader.readAsDataURL(file)
  }

  // 搜索指定字符在各个碑帖中的写法
  const searchCharacter = async (char: string, style: string) => {
    if (!char || char.length !== 1) return
    
    setIsSearching(true)
    setCharacterResults([])
    
    // 从本地数据库搜索字符
    setTimeout(() => {
      const dbResults = searchCharacterInDatabase(char, style)
      
      if (dbResults.length > 0) {
        // 如果找到了本地数据，使用本地图片
        const results: CharacterResult[] = dbResults.map(item => ({
          steleId: item.steleId,
          steleName: item.steleName,
          author: item.author,
          imageUrl: item.imagePath,
          character: item.char,
        }))
        setCharacterResults(results)
      } else {
        // 如果没有找到，使用占位图片
        const steles = STELE_DATABASE[style] || []
        const results: CharacterResult[] = steles.map(stele => ({
          steleId: stele.id,
          steleName: stele.name,
          author: stele.author,
          // 临时使用占位图片
          imageUrl: `https://images.unsplash.com/photo-${Math.random() > 0.5 ? '1618365908648' : '1580911147683'}-ee495d76c998?w=200`,
          character: char,
        }))
        setCharacterResults(results)
      }
      
      setIsSearching(false)
    }, 300)
  }
  
  // 选择具体的字形作为参考图
  const selectCharacterImage = (result: CharacterResult) => {
    // 检查是否已达到最大图层数
    if (referenceLayers.length >= 3) {
      alert('最多只能添加3张参考图')
      return
    }

    const newLayer: ReferenceLayer = {
      id: nextLayerId.current++,
      imageUrl: result.imageUrl,
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      opacity: 0.5,
      name: `${result.steleName}-${result.character}`
    }
    setReferenceLayers(prev => [...prev, newLayer])
    setSelectedLayerId(newLayer.id)
  }

  const removeReferenceLayer = (id: number) => {
    setReferenceLayers(prev => prev.filter(layer => layer.id !== id))
    if (selectedLayerId === id) {
      setSelectedLayerId(null)
    }
  }

  const updateLayerOpacity = (id: number, opacity: number) => {
    setReferenceLayers(prev =>
      prev.map(layer =>
        layer.id === id ? { ...layer, opacity } : layer
      )
    )
  }

  const getCursorStyle = (): string => {
    // 拖动状态时显示移动光标
    if (isDraggingPoint || isDraggingControl) {
      return 'move'
    }
    
    // 悬浮在锚点或控制点上时显示移动光标（path/anchor 工具）
    if ((currentTool === 'path' || currentTool === 'anchor') && 
        (hoveredAnchor !== null || hoveredControlPoint !== null)) {
      return 'move'
    }
    
    switch (currentTool) {
      case 'brush':
        // 画笔图标 - 32x32，热点在笔尖
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' stroke='%23fff' stroke-width='1.2' d='M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'/%3E%3C/svg%3E") 4 28, crosshair`
      case 'path':
        // 钢笔图标 - 32x32，热点在笔尖左下角
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' stroke='%23fff' stroke-width='1.2' d='M12 19l7-7 3 3-7 7-3-3z'/%3E%3Cpath fill='%23000' stroke='%23fff' stroke-width='1.2' d='M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z'/%3E%3Ccircle cx='11' cy='11' r='2' fill='%23000' stroke='%23fff' stroke-width='1.2'/%3E%3C/svg%3E") 3 3, crosshair`
      case 'eraser':
        // 橡皮擦图标 - 40x40 (最大)
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24'%3E%3Cpath fill='%23ff6b6b' stroke='%23fff' stroke-width='1.5' d='M20 20H7L3 16l9-9 8 8-4 4z'/%3E%3Cpath stroke='%23fff' stroke-width='1.5' d='M7 16l5-5'/%3E%3C/svg%3E") 20 20, not-allowed`
      case 'anchor':
        // 锚点工具图标 - 32x32
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='%23000' stroke-width='2.5' d='M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3'/%3E%3Ccircle cx='12' cy='12' r='2.5' fill='%234a90e2' stroke='%23fff' stroke-width='1.5'/%3E%3C/svg%3E") 16 16, pointer`
      case 'transform':
        return 'move'
      case 'text':
        return 'text'
      case 'template':
        return 'copy'
      default:
        return 'default'
    }
  }

  const getToolName = () => {
    const toolNames: Record<string, string> = {
      brush: 'Brush',
      path: 'Pen Tool',
      eraser: 'Eraser',
      select: 'Selection',
      template: 'Template',
      anchor: 'Anchor Point',
      transform: 'Transform',
      text: 'Text',
      color: 'Color Picker'
    }
    return toolNames[currentTool] || 'Tool'
  }

  const getToolStatus = () => {
    if (currentTool === 'path' && isPathMode) {
      return `Drawing path (${pathPoints.length} points)`
    }
    if (currentTool === 'anchor' && selectedPoint !== null) {
      return `Editing point ${selectedPoint + 1}`
    }
    if (currentTool === 'select') {
      if (isSelecting) return 'Creating selection'
      if (selectedArea) return 'Transforming'
      return `Ready to select (${selectionMode === 'rect' ? 'Rect' : 'Lasso'})`
    }
    return 'Ready'
  }

  return (
    <div className="w-full h-full flex gap-4 p-6">
      {/* 左侧工具选项面板 - 固定宽度，可滚动 */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3 min-h-0">
        {/* 工具状态栏 - 固定在顶部 */}
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-lg px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
            <div className="font-semibold text-primary">{getToolName()}</div>
            <div className="text-sm text-gray-600">·</div>
            <div className="text-sm text-gray-700">{getToolStatus()}</div>
          </div>
        </div>

        {/* 工具选项面板 - 可滚动区域 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 overflow-y-auto flex-1 min-h-0">
        {currentTool === 'brush' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Color</label>
              <input
                type="color"
                value={currentColor}
                onChange={(e) => setCurrentColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-2 border-gray-300"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Brush Size</label>
              <span className="text-sm text-gray-600">{brushSize}px</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Opacity</label>
              <span className="text-sm text-gray-600">{Math.round(brushOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={brushOpacity * 100}
              onChange={(e) => setBrushOpacity(Number(e.target.value) / 100)}
              className="w-full"
            />
            
            {/* 字符搜索 - 参考图选择 */}
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="text-sm font-semibold text-gray-700 mb-2">Calligraphy Reference</div>
              <div className="space-y-3">
                {/* 书体选择 */}
                <div>
                  <div className="text-xs text-gray-600 mb-2">Select Style:</div>
                  <div className="grid grid-cols-2 gap-2">
                    
                  </div>
                </div>
                
                {/* 字符输入 */}
                <div>
                  <div className="text-xs text-gray-600 mb-2">Character:</div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={inputChar}
                      onChange={(e) => {
                        // 直接允许任意输入,不做限制
                        setInputChar(e.target.value)
                      }}
                      placeholder="e.g. 以 (max 3)"
                      className="flex-1 min-w-0 px-2 py-1.5 border-2 border-gray-300 rounded text-center text-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all"
                    />
                    <button
                      onClick={() => {
                        // 点击搜索时确保只有一个字符
                        const char = inputChar.slice(-1)
                        setInputChar(char)
                        searchCharacter(char, selectedStyle)
                      }}
                      disabled={!inputChar || isSearching}
                      className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium transition-colors flex-shrink-0"
                    >
                      {isSearching ? '⏳' : '🔍'}
                    </button>
                  </div>
                </div>
                
                {/* 搜索结果 */}
                {characterResults.length > 0 && (
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs font-semibold text-gray-600 mb-1.5">
                      Found {characterResults.length}:
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                      {characterResults.map((result, index) => (
                        <button
                          key={index}
                          onClick={() => selectCharacterImage(result)}
                          className="bg-white border border-gray-300 rounded hover:border-blue-500 hover:shadow-md transition-all p-1.5"
                        >
                          <img
                            src={result.imageUrl}
                            alt={`${result.steleName}-${result.character}`}
                            className="w-full h-24 object-contain rounded mb-0.5"
                          />
                          <div className="text-[10px] text-gray-700 font-medium truncate">{result.steleName}</div>
                          <div className="text-[9px] text-gray-500 truncate">{result.author}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 上传自定义图片 */}
                <div className="border-t border-gray-200 pt-2">
                  <label className="block w-full px-3 py-2 bg-white border-2 border-dashed border-gray-300 rounded hover:border-blue-500 transition-colors cursor-pointer text-center text-xs text-gray-600">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceUpload}
                      className="hidden"
                    />
                    📁 Or upload custom reference
                  </label>
                </div>

                {/* 图层列表 */}
                {referenceLayers.length > 0 && (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="text-xs font-semibold text-gray-700 mb-2">
                      Reference Layers ({referenceLayers.length}/3)
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {referenceLayers.map(layer => (
                        <div
                          key={layer.id}
                          className={`p-2 rounded border cursor-pointer ${
                            selectedLayerId === layer.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedLayerId(layer.id)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs font-medium truncate flex-1">
                              {layer.name}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeReferenceLayer(layer.id)
                              }}
                              className="text-red-500 hover:text-red-700 text-xs ml-2"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span>Opacity</span>
                            <span>{Math.round(layer.opacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={layer.opacity * 100}
                            onChange={(e) => {
                              e.stopPropagation()
                              updateLayerOpacity(layer.id, Number(e.target.value) / 100)
                            }}
                            className="w-full"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentTool === 'select' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Selection Mode</label>
              <div className="flex items-center gap-2 bg-gray-100 rounded px-1 py-1">
                <button
                  className={`px-3 py-1 rounded text-sm ${selectionMode === 'rect' ? 'bg-white border border-gray-300' : 'text-gray-600'}`}
                  onClick={() => setSelectionMode('rect')}
                >Rect</button>
                <button
                  className={`px-3 py-1 rounded text-sm ${selectionMode === 'lasso' ? 'bg-white border border-gray-300' : 'text-gray-600'}`}
                  onClick={() => setSelectionMode('lasso')}
                >Lasso</button>
              </div>
            </div>
            <div className="text-xs text-gray-500">Use tags to switch selection type.</div>
          </div>
        )}

        {currentTool === 'path' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Color</label>
              <input
                type="color"
                value={currentColor}
                onChange={(e) => setCurrentColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-2 border-gray-300"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Stroke Width</label>
              <span className="text-sm text-gray-600">{brushSize}px</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full"
            />
            
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">Handle Mirroring</div>
              <div className="flex items-center space-x-2">
                {/* 完全对称 */}
                <button 
                  onClick={() => setMirrorMode('symmetric')}
                  className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
                    mirrorMode === 'symmetric' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title="Symmetric: Equal length and angle"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>⟷</span>
                  </div>
                </button>
                
                {/* 角度镜像 */}
                <button 
                  onClick={() => setMirrorMode('angle')}
                  className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
                    mirrorMode === 'angle' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title="Angle mirror: Opposite angles, independent lengths"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>⤚⤙</span>
                  </div>
                </button>
                
                {/* 独立控制 */}
                <button 
                  onClick={() => setMirrorMode('independent')}
                  className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
                    mirrorMode === 'independent' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title="Independent: Full control"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>⤴⤵</span>
                  </div>
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {mirrorMode === 'symmetric' && '⟷ Symmetric: Both handles move together'}
                {mirrorMode === 'angle' && '⤚⤙ Angle Mirror: Opposite angles, different lengths'}
                {mirrorMode === 'independent' && '⤴⤵ Independent: Full control of each handle'}
              </div>
            </div>
            
            {/* 字符搜索 - 参考图选择 (与 Brush 工具共享) */}
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="text-sm font-semibold text-gray-700 mb-2">Calligraphy Reference</div>
              <div className="space-y-3">
                
                
                {/* 字符输入 */}
                <div>
                  <div className="text-xs text-gray-600 mb-2">Character:</div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={inputChar}
                      onChange={(e) => {
                        // 直接允许任意输入,不做限制
                        setInputChar(e.target.value)
                      }}
                      placeholder="e.g. 以 (max 3)"
                      className="flex-1 min-w-0 px-2 py-1.5 border-2 border-gray-300 rounded text-center text-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all"
                    />
                    <button
                      onClick={() => {
                        const char = inputChar.slice(-1)
                        setInputChar(char)
                        searchCharacter(char, selectedStyle)
                      }}
                      disabled={!inputChar || isSearching}
                      className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm flex-shrink-0"
                    >
                      {isSearching ? '⏳' : '🔍'}
                    </button>
                  </div>
                </div>
                
                {/* 搜索结果 */}
                {characterResults.length > 0 && (
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs font-semibold text-gray-600 mb-1.5">
                      Found {characterResults.length}:
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                      {characterResults.map((result, index) => (
                        <button
                          key={index}
                          onClick={() => selectCharacterImage(result)}
                          className="bg-white border border-gray-300 rounded hover:border-blue-500 hover:shadow-md transition-all p-1.5"
                        >
                          <img
                            src={result.imageUrl}
                            alt={`${result.steleName}-${result.character}`}
                            className="w-full h-24 object-contain rounded mb-0.5"
                          />
                          <div className="text-[10px] text-gray-700 font-medium truncate">{result.steleName}</div>
                          <div className="text-[9px] text-gray-500 truncate">{result.author}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 上传自定义图片 */}
                <div className="border-t border-gray-200 pt-2">
                  <label className="block w-full px-3 py-2 bg-white border-2 border-dashed border-gray-300 rounded hover:border-blue-500 transition-colors cursor-pointer text-center text-xs text-gray-600">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceUpload}
                      className="hidden"
                    />
                    📁 Or upload custom reference
                  </label>
                </div>

                {/* 图层列表 */}
                {referenceLayers.length > 0 && (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="text-xs font-semibold text-gray-700 mb-2">
                      Reference Layers ({referenceLayers.length}/3)
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {referenceLayers.map(layer => (
                        <div
                          key={layer.id}
                          className={`p-2 rounded border cursor-pointer ${
                            selectedLayerId === layer.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedLayerId(layer.id)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs font-medium truncate flex-1">
                              {layer.name}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeReferenceLayer(layer.id)
                              }}
                              className="text-red-500 hover:text-red-700 text-xs ml-2"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span>Opacity</span>
                            <span>{Math.round(layer.opacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={layer.opacity * 100}
                            onChange={(e) => {
                              e.stopPropagation()
                              updateLayerOpacity(layer.id, Number(e.target.value) / 100)
                            }}
                            className="w-full"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentTool === 'eraser' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Eraser Size</label>
              <span className="text-sm text-gray-600">{eraserSize}px</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={eraserSize}
              onChange={(e) => setEraserSize(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {currentTool === 'select' && selectionMode === 'rect' && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
              <div className="font-medium text-blue-800 mb-2">Rectangle Selection</div>
              <div className="space-y-1 text-xs">
                <div>• Drag to create a rectangular selection</div>
                <div>• Drag selected area to <span className="font-semibold">move</span></div>
                <div>• Drag corners to <span className="font-semibold">scale</span></div>
                <div>• Drag top circle to <span className="font-semibold">rotate</span></div>
                <div>• Click outside to apply selection</div>
              </div>
            </div>
            
            {selectedArea && selectionBounds && (
              <div className="bg-gray-50 p-3 rounded space-y-2">
                <div className="text-xs font-medium text-gray-700">Selection Info</div>
                <div className="text-xs text-gray-600">
                  Size: {Math.round(selectionBounds.width)} × {Math.round(selectionBounds.height)} px
                </div>
                <div className="text-xs text-gray-600">
                  Rotation: {Math.round(selectionRotation * 180 / Math.PI)}°
                </div>
                <button
                  onClick={applySelection}
                  className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  Apply Selection
                </button>
              </div>
            )}
          </div>
        )}

        {currentTool === 'select' && selectionMode === 'lasso' && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 bg-purple-50 p-3 rounded">
              <div className="font-medium text-purple-800 mb-2">Lasso Selection</div>
              <div className="space-y-1 text-xs">
                <div>• Draw freehand to create selection area</div>
                <div>• Selection automatically closes when released</div>
                <div>• Drag selected area to <span className="font-semibold">move</span></div>
                <div>• Drag corners to <span className="font-semibold">scale</span></div>
                <div>• Click outside to apply selection</div>
              </div>
            </div>
            
            {selectedArea && selectionBounds && (
              <div className="bg-gray-50 p-3 rounded space-y-2">
                <div className="text-xs font-medium text-gray-700">Selection Info</div>
                <div className="text-xs text-gray-600">
                  Size: {Math.round(selectionBounds.width)} × {Math.round(selectionBounds.height)} px
                </div>
                <div className="text-xs text-gray-600">
                  Rotation: {Math.round(selectionRotation * 180 / Math.PI)}°
                </div>
                <button
                  onClick={applySelection}
                  className="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors text-sm font-medium"
                >
                  Apply Selection
                </button>
              </div>
            )}
          </div>
        )}

        {currentTool === 'anchor' && (
          <div className="text-sm text-gray-600 bg-green-50 p-3 rounded">
            <div className="font-medium text-green-800 mb-1">Anchor Point Tool</div>
            Drag <span className="font-semibold text-blue-600">blue points</span> to move anchors
            <br />
            Drag <span className="font-semibold text-orange-600">orange points</span> to adjust curves
          </div>
        )}

        {currentTool === 'template' && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 mb-3">
              Upload reference images (max 3)
            </div>
            
            {/* 上传模板图片 */}
            <label className="block w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-colors cursor-pointer text-center text-sm font-semibold shadow-md">
              <input
                type="file"
                accept="image/*"
                onChange={handleTemplateUpload}
                className="hidden"
                disabled={referenceLayers.length >= 3}
              />
              📁 Upload Template/Sketch ({referenceLayers.length}/3)
            </label>
            
            {/* 参考图层管理 */}
            {referenceLayers.length > 0 && (
              <div className="border-t border-gray-200 pt-3 space-y-3">
                <div className="text-sm font-medium text-gray-700 mb-2">Reference Layers ({referenceLayers.length}/3)</div>
                {referenceLayers.map((layer) => (
                  <div key={layer.id} className="border-2 border-blue-300 rounded-lg p-3 bg-blue-50/30">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700 truncate">{layer.name}</span>
                      <button
                        onClick={() => {
                          setReferenceLayers(prev => prev.filter(l => l.id !== layer.id))
                          if (selectedLayerId === layer.id) {
                            setSelectedLayerId(null)
                          }
                        }}
                        className="text-red-500 hover:text-red-700 text-lg font-semibold ml-2"
                      >
                        ✕
                      </button>
                    </div>
                    {/* 每个图层的透明度调节 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-gray-700">Opacity</label>
                        <span className="text-sm text-gray-600">{Math.round(layer.opacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={layer.opacity * 100}
                        onChange={(e) => {
                          const newOpacity = Number(e.target.value) / 100
                          setReferenceLayers(prev => prev.map(l => 
                            l.id === layer.id ? { ...l, opacity: newOpacity } : l
                          ))
                        }}
                        className="w-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(currentTool === 'transform' || currentTool === 'text' || currentTool === 'color') && (
          <div className="text-sm text-gray-500 italic">
            Tool options coming soon...
          </div>
        )}
        </div>
      </div>

      {/* 右侧画布区域 - 固定位置，不受左侧滚动影响 */}
      <div className="flex-1 flex flex-col items-center justify-start pb-8">
        {/* 模式切换 Toggle Switch - 在画布上方，固定位置 */}
        <div className="w-[500px] mb-4 flex-shrink-0">
          <div className="text-sm font-medium text-gray-700 mb-2">Mode:</div>
          <button
            onClick={() => {
              // 选区工具和 template 工具期间禁止切换到图层编辑模式
              if (currentTool === 'select' || currentTool === 'template') return
              setIsImageEditMode(!isImageEditMode)
            }}
            className={`relative w-full h-10 rounded-full p-1 transition-colors duration-300 ${
              (currentTool === 'select' || currentTool === 'template') ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'
            }`}
            aria-disabled={(currentTool === 'select' || currentTool === 'template')}
          >
            {/* 蓝色滑块背景 - z-index 0 在最底层 */}
            <div
              className="absolute top-1 h-8 bg-blue-500 rounded-full shadow-md transition-all duration-300 ease-in-out"
              style={{
                left: (isImageEditMode || currentTool === 'template') ? 'calc(50% - 4px)' : '4px',
                width: 'calc(50% - 4px)',
                zIndex: 0
              }}
            />
            {/* 文字层 - z-index 10 在最上层 */}
            <div className="relative z-10 flex h-full items-center justify-between px-3 text-xs font-medium">
              <span className={`transition-colors ${(!isImageEditMode && currentTool !== 'template') ? 'text-white' : 'text-gray-600'}`}>
                🖌️ Draw (Edit Curves)
              </span>
              <span className={`transition-colors ${(isImageEditMode || currentTool === 'template') ? 'text-white' : 'text-gray-600'}`}>
                🖼️ BG (Edit Ref)
              </span>
            </div>
          </button>
          
          {/* 模式提示信息 - 固定高度避免画布移动 */}
          <div className="mt-2 h-10 flex items-center">
            {!isImageEditMode && currentTool === 'brush' && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded w-full">
                ✏️ Click and drag to draw. Adjust color, size & opacity in tool panel.
              </div>
            )}
            
            {!isImageEditMode && currentTool === 'eraser' && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded w-full">
                🧹 Click and drag to erase. Adjust eraser size in tool panel.
              </div>
            )}
            
            {!isImageEditMode && currentTool === 'path' && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded w-full">
                ✏️ Click to add points, drag to curve. <strong>Press ESC</strong> to finish.
              </div>
            )}
            
            {isImageEditMode && currentTool !== 'select' && (
              <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded w-full">
                🖼️ Drag to move, use corner to resize. Switch to Draw to edit curves.
              </div>
            )}
            {currentTool === 'select' && (
              <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded w-full">
                🔒 Selection active: background layers are locked.
              </div>
            )}
            {currentTool === 'template' && (
              <div className="text-xs text-purple-600 bg-purple-50 p-2 rounded w-full">
                📸 Template mode: Upload and edit reference images (max 3).
              </div>
            )}
          </div>
        </div>

        {/* 画布容器 - 固定大小 */}
        <div 
        className="relative w-[500px] h-[500px] rounded-lg flex-shrink-0"
        onMouseMove={(e) => {
          // 处理图层拖拽
          if (isDraggingImage && selectedLayerId !== null && dragStartPos) {
            const layer = referenceLayers.find(l => l.id === selectedLayerId)
            if (layer) {
              let newX = e.clientX - dragStartPos.x
              let newY = e.clientY - dragStartPos.y
              
              // 限制在画布边界内 (500x500)
              newX = Math.max(0, Math.min(newX, 500 - layer.width))
              newY = Math.max(0, Math.min(newY, 500 - layer.height))
              
              setReferenceLayers(prev =>
                prev.map(l => l.id === selectedLayerId ? { ...l, x: newX, y: newY } : l)
              )
            }
          }
          // 处理图层缩放
          else if (isResizingImage && selectedLayerId !== null && dragStartPos) {
            const layer = referenceLayers.find(l => l.id === selectedLayerId)
            if (layer) {
              const dx = e.clientX - dragStartPos.x
              const dy = e.clientY - dragStartPos.y
              // 限制最小尺寸和最大尺寸（不超出画布）
              const newWidth = Math.max(50, Math.min(layer.width + dx, 500 - layer.x))
              const newHeight = Math.max(50, Math.min(layer.height + dy, 500 - layer.y))
              setReferenceLayers(prev =>
                prev.map(l => l.id === selectedLayerId ? { ...l, width: newWidth, height: newHeight } : l)
              )
              setDragStartPos({ x: e.clientX, y: e.clientY })
            }
          }
        }}
        onMouseUp={() => {
          setIsDraggingImage(false)
          setIsResizingImage(false)
          setDragStartPos(null)
        }}
        onMouseLeave={() => {
          setIsDraggingImage(false)
          setIsResizingImage(false)
          setDragStartPos(null)
        }}
      >
        {/* 白色背景层 - 最底层 */}
        <div className="absolute inset-0 bg-white rounded-lg z-0" />
        
        {/* 参考图层 (用于描红辅助) - 支持多图层，在白色背景之上 */}
        {referenceLayers.map(layer => (
          <div
            key={layer.id}
            className="absolute z-10 overflow-hidden rounded-lg"
            style={{
              left: layer.x,
              top: layer.y,
              width: layer.width,
              height: layer.height,
              // 在图片编辑模式或 template 工具模式下可交互
              pointerEvents: (isImageEditMode || currentTool === 'template') && currentTool !== 'select' ? 'auto' : 'none',
              border: selectedLayerId === layer.id && (isImageEditMode || currentTool === 'template') ? '2px solid #3b82f6' : 'none',
              cursor: (isImageEditMode || currentTool === 'template') && currentTool !== 'select' ? 'move' : 'default'
            }}
            onMouseDown={(e) => {
              if ((isImageEditMode || currentTool === 'template') && currentTool !== 'select') {
                e.stopPropagation()
                setSelectedLayerId(layer.id)
                setIsDraggingImage(true)
                setDragStartPos({ x: e.clientX - layer.x, y: e.clientY - layer.y })
              }
            }}
          >
            <img
              src={layer.imageUrl}
              alt={layer.name}
              className="w-full h-full"
              style={{ 
                opacity: layer.opacity,
                objectFit: 'contain'
              }}
              draggable={false}
            />
            
            {/* 调整大小手柄 */}
            {(isImageEditMode || currentTool === 'template') && currentTool !== 'select' && selectedLayerId === layer.id && (
              <div 
                className="absolute -right-2 -bottom-2 w-4 h-4 bg-blue-500 rounded-full cursor-nwse-resize"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  setIsResizingImage(true)
                  setDragStartPos({ x: e.clientX, y: e.clientY })
                }}
              />
            )}
          </div>
        ))}
        
        {/* 绘图画布 - 在最顶层，显示绘制内容，背景色在画布上绘制 */}
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          className="border-2 border-primary rounded-lg absolute inset-0 z-20"
          style={{ cursor: getCursorStyle(), pointerEvents: isImageEditMode ? 'none' : 'auto' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
        
        {/* 底层模板图片 (旧功能,保留兼容) */}
        {templateImage && (
          <div className="absolute inset-0 z-0 overflow-hidden rounded-lg">
            <img
              src={templateImage}
              alt="Template"
              className="w-full h-full object-cover"
              style={{ 
                opacity: templateOpacity,
                width: '500px',
                height: '500px'
              }}
            />
            <div className="absolute top-2 right-2 flex items-center space-x-2 bg-white/90 rounded-lg p-2 shadow-lg z-20">
              <label className="text-xs text-gray-600">Opacity:</label>
              <input
                type="range"
                min="0"
                max="100"
                value={templateOpacity * 100}
                onChange={(e) => setTemplateOpacity(Number(e.target.value) / 100)}
                className="w-24"
              />
              <button
                onClick={removeTemplate}
                className="text-red-500 hover:text-red-700 text-xs font-semibold"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        {/* 橡皮擦尺寸预览圆圈 */}
        {currentTool === 'eraser' && eraserCursorPos && (
          <div
            className="absolute pointer-events-none z-20"
            style={{
              left: `${eraserCursorPos.x}px`,
              top: `${eraserCursorPos.y}px`,
              width: `${eraserSize * 2}px`,
              height: `${eraserSize * 2}px`,
              transform: 'translate(-50%, -50%)',
              border: '1px solid rgba(0, 0, 0, 0.5)',
              borderRadius: '50%',
            }}
          />
        )}
      </div>

      {/* 画布下方的操作按钮 - 固定位置 */}
      <div className="w-[500px] flex justify-between gap-2 mt-4 mb-4 flex-shrink-0">
        {/* Brush/Eraser 工具 - 3个按钮 */}
        {(currentTool === 'brush' || currentTool === 'eraser') && (
          <>
            <button
              onClick={() => {
                if (!context || !canvasRef.current) return
                context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
                setPathPoints([])
                backgroundImageRef.current = null
                onCanvasChange('')
              }}
              className="flex-1 py-2.5 bg-white border-2 border-orange-300 text-orange-600 rounded-full hover:bg-orange-50 hover:border-orange-400 transition-colors text-sm font-medium flex items-center justify-center space-x-1"
            >
              <span>✏️</span>
              <span>Clear Draft</span>
            </button>
            <button
              onClick={() => {
                setReferenceLayers([])
                setSelectedLayerId(null)
              }}
              className="flex-1 py-2.5 bg-white border-2 border-blue-300 text-blue-600 rounded-full hover:bg-blue-50 hover:border-blue-400 transition-colors text-sm font-medium flex items-center justify-center space-x-1"
            >
              <span>🖼️</span>
              <span>Clear Ref</span>
            </button>
            <button
              onClick={clearCanvas}
              className="flex-1 py-2.5 bg-white border-2 border-red-300 text-red-600 rounded-full hover:bg-red-50 hover:border-red-400 transition-colors text-sm font-medium flex items-center justify-center space-x-1"
            >
              <span>🗑️</span>
              <span>Clear All</span>
            </button>
          </>
        )}
        
        {/* Path 工具 - 2个按钮 */}
        {currentTool === 'path' && (
          <>
            <button
              onClick={() => {
                if (!context || !canvasRef.current) return
                context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
                setPathPoints([])
                setIsPathMode(false)
                setSelectedPoint(null)
                backgroundImageRef.current = null
                onCanvasChange('')
              }}
              className="flex-1 py-2.5 bg-white border-2 border-purple-300 text-purple-600 rounded-full hover:bg-purple-50 hover:border-purple-400 transition-colors text-sm font-medium flex items-center justify-center space-x-1"
            >
              <span>✂️</span>
              <span>Clear Curves</span>
            </button>
            <button
              onClick={() => {
                setReferenceLayers([])
                setSelectedLayerId(null)
              }}
              className="flex-1 py-2.5 bg-white border-2 border-blue-300 text-blue-600 rounded-full hover:bg-blue-50 hover:border-blue-400 transition-colors text-sm font-medium flex items-center justify-center space-x-1"
            >
              <span>🖼️</span>
              <span>Clear BG Ref</span>
            </button>
          </>
        )}
        
        {/* Template 工具 - 1个按钮 */}
        {currentTool === 'template' && (
          <button
            onClick={() => {
              setReferenceLayers([])
              setSelectedLayerId(null)
            }}
            className="flex-1 py-2.5 bg-white border-2 border-red-300 text-red-600 rounded-full hover:bg-red-50 hover:border-red-400 transition-colors text-sm font-medium flex items-center justify-center space-x-1.5"
          >
            <span>🗑️</span>
            <span>Clear All Ref Images</span>
          </button>
        )}
        
        {/* Select 工具 - 1个按钮 */}
        {currentTool === 'select' && (
          <button
            onClick={clearCanvas}
            className="flex-1 py-2.5 bg-white border-2 border-red-300 text-red-600 rounded-full hover:bg-red-50 hover:border-red-400 transition-colors text-sm font-medium flex items-center justify-center space-x-1.5"
          >
            <span>🗑️</span>
            <span>Clear All</span>
          </button>
        )}
        
        {/* Anchor 工具 - 显示完成路径按钮 */}
        {currentTool === 'anchor' && pathPoints.length > 0 && (
          <button
            onClick={finishPath}
            className="flex-1 py-2.5 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors text-sm font-semibold flex items-center justify-center space-x-1.5 shadow-lg"
          >
            <span>✓</span>
            <span>Apply Changes</span>
          </button>
        )}
      </div>
      </div>
    </div>
  )
}

export default DrawingCanvas
