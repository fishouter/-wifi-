import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Hand, PenTool, Undo2, RotateCcw, Download, Play, Loader2, Check } from 'lucide-react';
import { editFloorPlanImage } from '../lib/gemini';

interface ImageEditorModalProps {
  initialImage: string;
  initialTitle?: string;
  widthMeters?: number;
  onClose: () => void;
  onApply: (newImage: string, newTitle?: string, newWidthMeters?: number) => void;
}

export function ImageEditorModal({ initialImage, initialTitle = '', widthMeters, onClose, onApply }: ImageEditorModalProps) {
  const [currentImage, setCurrentImage] = useState(initialImage);
  const [title, setTitle] = useState(initialTitle);
  const [currentWidthMeters, setCurrentWidthMeters] = useState(widthMeters);
  
  useEffect(() => {
    setCurrentImage(initialImage);
    setProcessedImage(null);
  }, [initialImage]);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [mode, setMode] = useState<'brush' | 'pan'>('brush');
  const [brushSize, setBrushSize] = useState(20);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [description, setDescription] = useState('');
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setProcessingTime(0);
      interval = setInterval(() => {
        setProcessingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);
  
  // Canvas state
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  
  // Load image and setup canvas
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      if (!containerRef.current || !canvasRef.current || !maskCanvasRef.current) return;
      
      setAspectRatio(img.width / img.height);
      setImageSize({ width: img.width, height: img.height });
      
      const container = containerRef.current;
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      
      // Calculate scale to fit container
      const scaleX = container.clientWidth / img.width;
      const scaleY = container.clientHeight / img.height;
      const newScale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave some margin
      
      setScale(newScale);
      setPan({
        x: (container.clientWidth - img.width * newScale) / 2,
        y: (container.clientHeight - img.height * newScale) / 2
      });
      
      // Set canvas dimensions to match image exactly
      canvas.width = img.width;
      canvas.height = img.height;
      maskCanvas.width = img.width;
      maskCanvas.height = img.height;
      
      // Draw image
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }
      
      // Clear mask and history
      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        setHistory([maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)]);
      }
    };
    img.src = currentImage;
  }, [currentImage]);

  const saveHistoryState = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (ctx) {
      setHistory(prev => [...prev, ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)]);
    }
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    
    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    const previousState = newHistory[newHistory.length - 1];
    
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(previousState, 0, 0);
      setHistory(newHistory);
    }
  };

  const handleReset = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      setHistory([ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)]);
    }
    setProcessedImage(null);
  };

  const getPointerPos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!maskCanvasRef.current) return { x: 0, y: 0 };
    const rect = maskCanvasRef.current.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode === 'pan') {
      setIsDragging(true);
      let clientX, clientY;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }
      setDragStart({ x: clientX - pan.x, y: clientY - pan.y });
    } else if (mode === 'brush') {
      setIsDrawing(true);
      const pos = getPointerPos(e);
      const ctx = maskCanvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      }
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDragging && mode === 'pan') {
      let clientX, clientY;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }
      setPan({
        x: clientX - dragStart.x,
        y: clientY - dragStart.y
      });
    } else if (isDrawing && mode === 'brush') {
      const pos = getPointerPos(e);
      const ctx = maskCanvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = 'rgba(255, 0, 0, 1)'; // Solid red for mask
        ctx.lineWidth = brushSize / scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }
  };

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
    if (isDrawing) {
      setIsDrawing(false);
      saveHistoryState();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newScale = Math.max(0.1, Math.min(scale * (1 + delta), 10));
      
      // Zoom towards mouse pointer
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const newPanX = mouseX - (mouseX - pan.x) * (newScale / scale);
        const newPanY = mouseY - (mouseY - pan.y) * (newScale / scale);
        
        setScale(newScale);
        setPan({ x: newPanX, y: newPanY });
      }
    }
  };

  const getDynamicScale = () => {
    if (!widthMeters || imageSize.width === 0) return null;
    
    // Calculate how many pixels represent 1 meter at current zoom
    const visualWidth = imageSize.width * scale;
    const pixelsPerMeter = visualWidth / widthMeters;
    
    // Target a scale bar width of roughly 100 pixels
    const targetMeters = 100 / pixelsPerMeter;
    
    // Find a nice round number for the scale label
    let scaleMeters = 1;
    if (targetMeters > 15) scaleMeters = 20;
    else if (targetMeters > 7.5) scaleMeters = 10;
    else if (targetMeters > 3.5) scaleMeters = 5;
    else if (targetMeters > 1.5) scaleMeters = 2;
    else if (targetMeters > 0.75) scaleMeters = 1;
    else scaleMeters = 0.5;

    const scalePixels = scaleMeters * pixelsPerMeter;
    return { width: scalePixels, label: `${scaleMeters} 米` };
  };

  const dynamicScale = getDynamicScale();

  const handleProcess = async () => {
    if (!description.trim()) {
      alert('请输入修改要求');
      return;
    }

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    // Check if mask is empty
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data.buffer);
    const hasMask = pixelBuffer.some(color => color !== 0);

    if (!hasMask) {
      alert('请先使用画笔涂抹需要修改的区域');
      return;
    }

    setIsProcessing(true);
    try {
      // Create a combined image with the red mask drawn on top
      const combinedCanvas = document.createElement('canvas');
      combinedCanvas.width = canvasRef.current!.width;
      combinedCanvas.height = canvasRef.current!.height;
      const combinedCtx = combinedCanvas.getContext('2d');
      if (combinedCtx) {
        // Draw original image
        combinedCtx.drawImage(canvasRef.current!, 0, 0);
        // Draw mask on top
        combinedCtx.drawImage(maskCanvas, 0, 0);
      }

      const combinedDataUrl = combinedCanvas.toDataURL('image/png');
      const mimeType = currentImage.match(/data:(.*?);base64/)?.[1] || 'image/png';
      
      // Determine closest supported aspect ratio for Gemini
      let apiAspectRatio = "1:1";
      if (aspectRatio > 1.5) apiAspectRatio = "16:9";
      else if (aspectRatio > 1.1) apiAspectRatio = "4:3";
      else if (aspectRatio > 0.8) apiAspectRatio = "1:1";
      else if (aspectRatio > 0.6) apiAspectRatio = "3:4";
      else apiAspectRatio = "9:16";

      const result = await editFloorPlanImage(
        description,
        combinedDataUrl,
        mimeType,
        apiAspectRatio
      );
      
      setProcessedImage(result.imageUrl);
      if (result.widthMeters) {
        setCurrentWidthMeters(result.widthMeters);
      }
    } catch (error: any) {
      alert('处理失败: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (processedImage) {
      setCurrentImage(processedImage);
      setProcessedImage(null);
      // Reset mask
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas) {
        const ctx = maskCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
          setHistory([ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)]);
        }
      }
    }
  };

  const handleDownload = () => {
    const targetImage = processedImage || currentImage;
    const a = document.createElement('a');
    a.href = targetImage;
    a.download = `floorplan_edited_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col font-sans h-[100dvh]">
      {/* Header */}
      <div className="h-14 shrink-0 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4 text-slate-800">
        <h2 className="font-bold text-lg">AI 局部重绘</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleDownload}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"
            title="下载图片"
          >
            <Download className="w-5 h-5" />
          </button>
          <button 
            onClick={() => {
              if (processedImage) {
                onApply(processedImage, title, currentWidthMeters);
              } else {
                onApply(currentImage, title, currentWidthMeters);
              }
              onClose();
            }}
            className="px-4 py-1.5 bg-[#0085D0] hover:bg-[#0070b0] text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            完成并返回
          </button>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-600 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Canvas Area */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-slate-100 cursor-crosshair min-h-0"
          onWheel={handleWheel}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          <div 
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              position: 'absolute',
              top: 0,
              left: 0,
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
              backgroundColor: 'white'
            }}
          >
            <canvas ref={canvasRef} className="block pointer-events-none" />
            {processedImage && (
              <img src={processedImage} alt="Processed" className="absolute inset-0 w-full h-full pointer-events-none" />
            )}
            <canvas 
              ref={maskCanvasRef} 
              className={`absolute inset-0 block ${mode === 'pan' || processedImage ? 'pointer-events-none' : ''} ${isProcessing ? 'animate-pulse drop-shadow-[0_0_15px_rgba(0,133,208,0.8)]' : ''}`} 
              style={{ opacity: processedImage ? 0 : 0.5 }}
            />
          </div>

          {/* Loading Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]"></div>
              
              {/* Scanning Line Animation */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="w-full h-1 bg-[#0085D0] shadow-[0_0_15px_#0085D0] absolute top-0 animate-[scan_2s_ease-in-out_infinite]"></div>
              </div>

              <div className="bg-white/90 backdrop-blur-md px-6 py-4 rounded-2xl shadow-2xl border border-[#0085D0]/20 flex flex-col items-center gap-3 z-30 transform scale-110">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 border-4 border-[#0085D0]/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-[#0085D0] rounded-full border-t-transparent animate-spin"></div>
                </div>
                <div className="flex flex-col items-center text-center">
                  <span className="text-base font-bold text-slate-800">AI 魔法修改中...</span>
                  <span className="text-sm text-slate-500 mt-1 font-mono">已耗时: {processingTime}s</span>
                </div>
              </div>
            </div>
          )}

          {/* Physical Dimensions & Scale */}
          {widthMeters && (
            <>
              {/* Top Width Label */}
              <div className="absolute top-0 left-0 w-full flex items-start justify-center pt-2 pointer-events-none z-20">
                <div className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-[#0085D0] shadow-sm border border-white/60">
                  宽 {widthMeters.toFixed(1)} 米
                </div>
              </div>
              
              {/* Left Height Label */}
              <div className="absolute top-0 left-0 h-full flex flex-col items-start justify-center pl-2 pointer-events-none z-20">
                <div className="bg-white/80 backdrop-blur-md px-1 py-3 rounded-full text-xs font-bold text-[#0085D0] shadow-sm border border-white/60" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                  长 {(widthMeters / aspectRatio).toFixed(1)} 米
                </div>
              </div>

              {/* Dynamic Scale */}
              {dynamicScale && (
                <div className="absolute bottom-6 left-6 z-20 flex flex-col items-center pointer-events-none">
                  <div className="text-xs font-bold text-[#0085D0] mb-1.5 bg-white/80 backdrop-blur-md px-3 py-1 rounded-lg shadow-sm border border-white/60">
                    {dynamicScale.label}
                  </div>
                  <div className="h-1 bg-[#0085D0]/80 relative rounded-full shadow-[0_0_8px_rgba(0,133,208,0.5)]" style={{ width: `${dynamicScale.width}px` }}>
                    <div className="absolute -top-1.5 -left-0.5 w-1 h-4 bg-[#0085D0] rounded-full shadow-sm"></div>
                    <div className="absolute -top-1.5 -right-0.5 w-1 h-4 bg-[#0085D0] rounded-full shadow-sm"></div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Sidebar - Prompt */}
        <div className="w-full md:w-80 shrink-0 bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col p-5 shadow-[-4px_0_15px_rgba(0,0,0,0.02)] z-10 overflow-y-auto">
          <label className="block text-sm font-bold text-slate-700 mb-2">户型图标题</label>
          <input 
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入户型图标题"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0085D0]/50 mb-4 shadow-inner"
          />

          <label className="block text-sm font-bold text-slate-700 mb-2">修改要求描述</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请描述您希望如何修改涂抹的区域... (例如：将选中的卧室改为书房)"
            className="w-full h-32 md:h-40 shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0085D0]/50 resize-none mb-6 shadow-inner"
            disabled={!!processedImage}
          />
          
          {processedImage ? (
            <div className="flex flex-col gap-3 mt-auto">
              <button 
                onClick={handleApply}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Check className="w-5 h-5" />
                应用当前效果
              </button>
              <button 
                onClick={() => setProcessedImage(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                放弃修改
              </button>
            </div>
          ) : (
            <div className="mt-auto text-sm text-slate-500 text-center">
              请在底部工具栏点击“开始处理”
            </div>
          )}
        </div>
      </div>

      {/* Bottom Toolbar */}
      <div className="h-16 shrink-0 bg-white border-t border-slate-200 flex items-center justify-center gap-4 sm:gap-8 px-4 sm:px-6 shadow-[0_-4px_15px_rgba(0,0,0,0.02)] z-10 overflow-x-auto">
        {/* Tools */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setMode('brush')}
            className={`p-2 rounded-lg transition-all ${mode === 'brush' ? 'bg-white text-[#0085D0] shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
            title="画笔工具"
          >
            <PenTool className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMode('pan')}
            className={`p-2 rounded-lg transition-all ${mode === 'pan' ? 'bg-white text-[#0085D0] shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
            title="抓手工具"
          >
            <Hand className="w-5 h-5" />
          </button>
        </div>

        <div className="w-px h-8 bg-slate-200 shrink-0"></div>

        {/* Brush Size */}
        <div className={`flex items-center gap-4 shrink-0 ${mode !== 'brush' ? 'opacity-50 pointer-events-none' : ''}`}>
          <span className="text-sm font-medium text-slate-600">画笔大小</span>
          <input 
            type="range" 
            min="5" 
            max="100" 
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-24 sm:w-32 accent-[#0085D0]"
          />
          <span className="text-sm font-medium text-slate-500 w-8">{brushSize}px</span>
        </div>

        <div className="w-px h-8 bg-slate-200 shrink-0"></div>

        {/* History */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUndo}
            disabled={history.length <= 1 || !!processedImage}
            className="p-2 text-slate-500 hover:text-[#0085D0] disabled:opacity-30 transition-colors rounded-lg hover:bg-slate-100"
            title="撤销"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleReset}
            disabled={!!processedImage && history.length <= 1}
            className="p-2 text-slate-500 hover:text-[#0085D0] disabled:opacity-30 transition-colors rounded-lg hover:bg-slate-100"
            title="重置"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        <div className="w-px h-8 bg-slate-200 shrink-0"></div>

        {/* Process Button */}
        <button 
          onClick={handleProcess}
          disabled={isProcessing || !description.trim() || !!processedImage}
          className="px-4 sm:px-6 py-2 bg-[#0085D0] hover:bg-[#0070b0] text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shrink-0"
        >
          <Play className="w-5 h-5" />
          开始处理
        </button>
      </div>
    </div>
  );
}
