import React, { useState, useRef, useEffect } from 'react';
import { Wifi, Upload, Plus, Trash2, Map, Activity, Info, Loader2, Radio, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FloorPlan, defaultFloorPlans, defaultAnalyses } from './lib/defaultPlans';
import { RouterNode, AnalysisResult, analyzeFloorPlan } from './lib/gemini';
import { drawHeatmap } from './lib/heatmap';

const HeatmapOverlay = ({ routers, visible, imageUrl, widthMeters }: { routers: RouterNode[], visible: boolean, imageUrl: string, widthMeters?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImageElement(img);
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (canvasRef.current) {
      drawHeatmap(canvasRef.current, imageElement, routers, widthMeters);
    }
  }, [routers, imageElement, widthMeters]);

  return (
    <canvas 
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-500 ${visible ? 'opacity-90' : 'opacity-0'}`}
      style={{ mixBlendMode: 'normal', filter: 'blur(3px)' }}
    />
  );
};

export default function App() {
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan>(defaultFloorPlans[0]);
  const [routers, setRouters] = useState<RouterNode[]>(defaultAnalyses['1'].routers);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(defaultAnalyses['1']);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [newRouterType, setNewRouterType] = useState<'standard' | 'high-power' | 'mesh'>('standard');
  const [containerWidth, setContainerWidth] = useState(800);
  const [aspectRatio, setAspectRatio] = useState(4/3);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const getDynamicScale = () => {
    if (!selectedPlan.widthMeters || containerWidth === 0) return null;
    
    // Calculate how many pixels represent 1 meter at current zoom
    const visualWidth = containerWidth * transform.scale;
    const pixelsPerMeter = visualWidth / selectedPlan.widthMeters;
    
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

  const handleSelectPlan = (plan: FloorPlan) => {
    setSelectedPlan(plan);
    if (plan.type === 'default') {
      const analysis = defaultAnalyses[plan.id];
      setAnalysisResult(analysis);
      setRouters(analysis.routers);
    } else {
      setAnalysisResult(null);
      setRouters([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const newPlan: FloorPlan = {
        id: 'uploaded-' + Date.now(),
        name: file.name,
        imageUrl: base64,
        type: 'uploaded'
      };
      setSelectedPlan(newPlan);
      setIsAnalyzing(true);
      setAnalysisResult(null);
      setRouters([]);

      try {
        const base64Data = base64.split(',')[1];
        const result = await analyzeFloorPlan(base64Data, file.type);
        const routersWithIds = result.routers.map((r: any, i: number) => ({ ...r, id: `r${Date.now()}-${i}` }));
        setAnalysisResult({ ...result, routers: routersWithIds });
        setRouters(routersWithIds);
      } catch (error) {
        console.error(error);
        const fallback = {
          recommendedCount: 1,
          routers: [{id: `r${Date.now()}`, x: 50, y: 50}],
          explanation: '分析失败，请手动调整路由器位置。'
        };
        setAnalysisResult(fallback);
        setRouters(fallback.routers);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setRouters(prev => prev.map(r => r.id === draggingId ? { ...r, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : r));
    } else if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: prev.x + (e.clientX - panStart.x),
        y: prev.y + (e.clientY - panStart.y)
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!draggingId) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDraggingId(null);
    setIsPanning(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleAdjust = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => {
      const newScale = Math.max(0.5, Math.min(5, prev.scale * scaleAdjust));
      return { ...prev, scale: newScale };
    });
  };

  const addRouter = () => {
    setRouters(prev => [...prev, { id: `r${Date.now()}`, x: 50, y: 50, type: newRouterType }]);
  };

  const updateRouterType = (id: string, type: 'standard' | 'high-power' | 'mesh') => {
    setRouters(prev => prev.map(r => r.id === id ? { ...r, type } : r));
  };

  const removeRouter = (id: string) => {
    setRouters(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-800 overflow-hidden font-sans relative">
      {/* Background blur decorative elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#0085D0]/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#0085D0]/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Left Sidebar: Floor Plans */}
      <div className="w-80 flex flex-col border-r border-white/60 bg-white/40 backdrop-blur-[30px] shadow-[4px_0_24px_0_rgba(0,133,208,0.05)] z-10">
        <div className="p-6 border-b border-white/60">
          <h1 className="text-2xl font-bold text-[#0085D0] flex items-center gap-2">
            <Wifi className="w-7 h-7" />
            智绘WiFi
          </h1>
          <p className="text-xs text-slate-500 mt-1">信号覆盖分析专家</p>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <label className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#0085D0] hover:bg-[#0070b0] text-white rounded-xl cursor-pointer transition-colors shadow-md mb-6">
            <Upload className="w-5 h-5" />
            <span className="font-medium">上传户型图</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>

          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">默认户型</h2>
          <div className="flex flex-col gap-2">
            {defaultFloorPlans.map(plan => (
              <button
                key={plan.id}
                onClick={() => handleSelectPlan(plan)}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                  selectedPlan.id === plan.id 
                    ? 'bg-white/80 shadow-[0_4px_12px_rgba(0,133,208,0.1)] border border-white/80 text-[#0085D0]' 
                    : 'hover:bg-white/50 text-slate-600 border border-transparent'
                }`}
              >
                <Map className={`w-5 h-5 ${selectedPlan.id === plan.id ? 'text-[#0085D0]' : 'text-slate-400'}`} />
                <span className="font-medium text-sm">{plan.name}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 px-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">物理尺寸设定</h2>
            <div className="flex flex-col gap-4 bg-white/40 backdrop-blur-[20px] p-4 rounded-xl border border-white/60 shadow-[0_4px_16px_rgba(0,133,208,0.04)]">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">宽度 (米)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="1"
                    value={selectedPlan.widthMeters ? Number(selectedPlan.widthMeters.toFixed(1)) : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        setSelectedPlan({ ...selectedPlan, widthMeters: val });
                      }
                    }}
                    className="w-full bg-white/60 border border-white/80 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0085D0]/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">长度 (米)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="1"
                    value={selectedPlan.widthMeters ? Number((selectedPlan.widthMeters / aspectRatio).toFixed(1)) : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        setSelectedPlan({ ...selectedPlan, widthMeters: val * aspectRatio });
                      }
                    }}
                    className="w-full bg-white/60 border border-white/80 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0085D0]/50"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                * 提示：修改宽度或长度会自动等比例缩放。系统已根据图片比例给出默认猜测值。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Canvas Area */}
      <div className="flex-1 flex flex-col relative z-10">
        <div className="p-4 flex justify-between items-center border-b border-white/60 bg-white/40 backdrop-blur-[30px] shadow-[0_4px_24px_0_rgba(0,133,208,0.02)]">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                showHeatmap ? 'bg-[#0085D0]/10 text-[#0085D0] border border-[#0085D0]/20 shadow-[0_0_10px_rgba(0,133,208,0.1)]' : 'bg-white/50 text-slate-600 hover:bg-white/80 border border-white/60'
              }`}
            >
              <Activity className="w-4 h-4" />
              热力图 {showHeatmap ? '开' : '关'}
            </button>
            <button 
              onClick={addRouter}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-white/50 text-slate-600 hover:bg-white/80 border border-white/60 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              添加路由器
            </button>
            <select 
              value={newRouterType}
              onChange={(e) => setNewRouterType(e.target.value as any)}
              className="bg-white/50 border border-white/60 text-slate-600 text-sm rounded-xl focus:ring-[#0085D0] focus:border-[#0085D0] block p-2 shadow-sm backdrop-blur-md outline-none"
            >
              <option value="standard">标准路由</option>
              <option value="high-power">穿墙路由</option>
              <option value="mesh">Mesh节点</option>
            </select>
            <div className="text-xs text-slate-500 hidden md:block max-w-xs">
              {newRouterType === 'standard' && '适合单间或无阻挡小空间，覆盖约 14 米。'}
              {newRouterType === 'high-power' && '增强穿透力，适合多墙体，覆盖约 20 米。'}
              {newRouterType === 'mesh' && '多台组网，大户型无缝漫游，单节点覆盖约 10 米。'}
            </div>
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              滚轮缩放 / 拖拽平移
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 flex items-center justify-center overflow-hidden relative">
          <div className="w-full h-full bg-white/30 backdrop-blur-[30px] border border-white/60 rounded-3xl shadow-[0_8px_32px_0_rgba(0,133,208,0.08)] p-4 flex items-center justify-center overflow-hidden relative">
            
            {/* Canvas Container */}
            <div 
              ref={containerRef}
              className="relative shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-white/80 touch-none bg-white/80 backdrop-blur-md origin-top-left rounded-xl overflow-hidden"
              style={{ 
                width: '100%', 
                maxWidth: '100%',
                maxHeight: '100%',
                aspectRatio: aspectRatio,
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                cursor: isPanning ? 'grabbing' : 'grab'
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
            >
              <img 
                src={selectedPlan.imageUrl} 
                alt="Floor Plan"
                className="block w-full h-full object-fill pointer-events-none" 
                draggable={false}
                onLoad={(e) => {
                  const { naturalWidth, naturalHeight } = e.currentTarget;
                  if (naturalHeight > 0) {
                    setAspectRatio(naturalWidth / naturalHeight);
                  }
                }}
              />
              
              {/* Boundary Dimensions */}
              {selectedPlan.widthMeters && (
                <>
                  {/* Top Width Label */}
                  <div className="absolute top-0 left-0 w-full flex items-start justify-center pt-2 pointer-events-none z-30">
                    <div className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-[#0085D0] shadow-sm border border-[#0085D0]/20">
                      宽 {selectedPlan.widthMeters.toFixed(1)} 米
                    </div>
                    <div className="absolute top-4 left-0 right-0 h-[1px] bg-[#0085D0]/40 -z-10"></div>
                    <div className="absolute top-2 left-0 w-[1px] h-4 bg-[#0085D0]/60"></div>
                    <div className="absolute top-2 right-0 w-[1px] h-4 bg-[#0085D0]/60"></div>
                  </div>
                  
                  {/* Left Height Label */}
                  <div className="absolute top-0 left-0 h-full flex flex-col items-start justify-center pl-2 pointer-events-none z-30">
                    <div className="bg-white/90 backdrop-blur-md px-1 py-3 rounded-full text-xs font-bold text-[#0085D0] shadow-sm border border-[#0085D0]/20" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                      长 {(selectedPlan.widthMeters / aspectRatio).toFixed(1)} 米
                    </div>
                    <div className="absolute top-0 bottom-0 left-4 w-[1px] bg-[#0085D0]/40 -z-10"></div>
                    <div className="absolute top-0 left-2 w-4 h-[1px] bg-[#0085D0]/60"></div>
                    <div className="absolute bottom-0 left-2 w-4 h-[1px] bg-[#0085D0]/60"></div>
                  </div>
                </>
              )}

              <HeatmapOverlay routers={routers} visible={showHeatmap} imageUrl={selectedPlan.imageUrl} widthMeters={selectedPlan.widthMeters} />
              
              {routers.map(router => (
                <div 
                  key={router.id}
                  className="absolute w-8 h-8 -ml-4 -mt-4 cursor-grab active:cursor-grabbing z-20 group"
                  style={{ left: `${router.x}%`, top: `${router.y}%` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDraggingId(router.id);
                  }}
                >
                  <div className={`w-full h-full rounded-full shadow-[0_0_15px_rgba(0,133,208,0.8)] flex items-center justify-center text-white relative z-10 ${
                    router.type === 'high-power' ? 'bg-red-500' : router.type === 'mesh' ? 'bg-green-500' : 'bg-[#0085D0]'
                  }`}>
                    {router.type === 'high-power' ? <Radio className="w-4 h-4" /> : router.type === 'mesh' ? <Network className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                  </div>
                  {/* Pulsing ring */}
                  <div className={`absolute inset-0 rounded-full animate-ping opacity-50 ${
                    router.type === 'high-power' ? 'bg-red-500' : router.type === 'mesh' ? 'bg-green-500' : 'bg-[#0085D0]'
                  }`} />
                  
                  {/* Delete button (visible on hover) */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeRouter(router.id); }}
                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-30"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>

                  {/* Type selector (visible on hover) */}
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity z-30 flex flex-col gap-1 w-24">
                    <button onClick={(e) => { e.stopPropagation(); updateRouterType(router.id, 'standard'); }} className="text-xs hover:bg-slate-100 p-1 rounded">标准</button>
                    <button onClick={(e) => { e.stopPropagation(); updateRouterType(router.id, 'high-power'); }} className="text-xs hover:bg-slate-100 p-1 rounded">穿墙</button>
                    <button onClick={(e) => { e.stopPropagation(); updateRouterType(router.id, 'mesh'); }} className="text-xs hover:bg-slate-100 p-1 rounded">Mesh</button>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Heatmap Legend */}
          {showHeatmap && (
            <div className="absolute bottom-10 right-10 bg-white/60 backdrop-blur-[30px] p-4 rounded-2xl shadow-[0_8px_24px_rgba(0,133,208,0.1)] border border-white/80 z-20">
              <div className="text-xs font-semibold text-slate-600 mb-3">信号强度</div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><span className="text-xs text-slate-500">极强 (无缝覆盖)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400"></div><span className="text-xs text-slate-500">良好 (流畅视频)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-400"></div><span className="text-xs text-slate-500">一般 (网页浏览)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-400"></div><span className="text-xs text-slate-500">较弱 (可能卡顿)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div><span className="text-xs text-slate-500">极弱 (经常断线)</span></div>
              </div>
            </div>
          )}
          
          {/* Scale Indicator */}
          {dynamicScale && (
             <div className="absolute bottom-10 left-10 z-20 flex flex-col items-center pointer-events-none">
                <div className="text-xs font-bold text-[#0085D0] mb-1.5 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-sm border border-[#0085D0]/20">
                  {dynamicScale.label}
                </div>
                <div className="h-1 bg-[#0085D0]/80 relative rounded-full" style={{ width: `${dynamicScale.width}px` }}>
                  <div className="absolute -top-1.5 -left-0.5 w-1 h-4 bg-[#0085D0] rounded-full"></div>
                  <div className="absolute -top-1.5 -right-0.5 w-1 h-4 bg-[#0085D0] rounded-full"></div>
                </div>
             </div>
          )}
        </div>
      </div>

      {/* Right Sidebar: Analysis */}
      <div className="w-80 border-l border-white/60 bg-white/40 backdrop-blur-[30px] shadow-[-4px_0_24px_0_rgba(0,133,208,0.05)] z-10 flex flex-col">
        <div className="p-6 border-b border-white/60">
          <h2 className="text-lg font-bold text-slate-800">智能分析报告</h2>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-[#0085D0]" />
              <p>AI正在分析户型结构...</p>
            </div>
          ) : analysisResult ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-white/80 shadow-[0_4px_16px_rgba(0,133,208,0.04)]">
                <div className="text-sm text-slate-500 mb-1">推荐路由器数量</div>
                <div className="text-3xl font-bold text-[#0085D0] flex items-baseline gap-1">
                  {analysisResult.recommendedCount} <span className="text-sm font-normal text-slate-500">台</span>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-white/80 shadow-[0_4px_16px_rgba(0,133,208,0.04)]">
                <div className="text-sm text-slate-500 mb-2">部署方案解析</div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {analysisResult.explanation}
                </p>
              </div>

              <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-white/80 shadow-[0_4px_16px_rgba(0,133,208,0.04)]">
                <div className="text-sm text-slate-500 mb-3">节点坐标 (当前)</div>
                <div className="space-y-2">
                  {routers.map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between text-sm bg-white/50 p-2 rounded-xl border border-white/60 shadow-sm">
                      <span className="font-medium text-slate-700 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#0085D0]" />
                        节点 {i + 1}
                      </span>
                      <span className="text-slate-500 font-mono">
                        X: {Math.round(r.x)}% Y: {Math.round(r.y)}%
                      </span>
                    </div>
                  ))}
                  {routers.length === 0 && (
                    <div className="text-sm text-slate-400 text-center py-2">暂无路由器节点</div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <Info className="w-8 h-8" />
              <p>请选择或上传户型图</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
