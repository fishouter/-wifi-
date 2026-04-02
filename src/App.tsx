import React, { useState, useRef, useEffect } from 'react';
import { Wifi, Upload, Plus, Trash2, Map, Activity, Info, Loader2, Radio, Network, Server, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
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

const LoadingOverlay = ({ isAnalyzing }: { isAnalyzing: boolean }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const messages = [
    "AI 正在深度分析户型结构...",
    "正在识别墙体与障碍物...",
    "正在计算最优信号覆盖模型...",
    "正在生成智能组网方案...",
    "预计需要 15-30 秒，请稍候..."
  ];

  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isAnalyzing, messages.length]);

  if (!isAnalyzing) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full border border-[#0085D0]/20">
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 border-4 border-[#0085D0]/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-[#0085D0] rounded-full border-t-transparent animate-spin"></div>
          <Wifi className="absolute inset-0 m-auto w-6 h-6 text-[#0085D0] animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">智能分析中</h3>
        <p className="text-sm text-slate-500 text-center h-5 transition-all duration-300">
          {messages[messageIndex]}
        </p>
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-6 overflow-hidden">
          <div className="h-full bg-[#0085D0] animate-progress rounded-full" style={{ width: '0%' }}></div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan>(defaultFloorPlans[0]);
  const [routers, setRouters] = useState<RouterNode[]>(defaultAnalyses['1'].routers);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(defaultAnalyses['1']);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [newRouterType, setNewRouterType] = useState<'standard' | 'high-power' | 'mesh' | 'ftto-main' | 'ftto-sub'>('standard');
  const [parentSize, setParentSize] = useState({ width: 800, height: 600 });
  const [aspectRatio, setAspectRatio] = useState(4/3);
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const analysisCache = useRef<Record<string, any>>({});

  const [scenario, setScenario] = useState<'home' | 'enterprise'>('home');
  const [modelType, setModelType] = useState<'gemini-flash' | 'gemini-pro' | 'qwen'>('gemini-flash');
  const [planTier, setPlanTier] = useState<'economical' | 'standard' | 'premium'>('standard');

  useEffect(() => {
    // When scenario changes, auto-select the first plan of that scenario
    const firstPlan = defaultFloorPlans.find(p => p.scenario === scenario);
    if (firstPlan && selectedPlan.scenario !== scenario) {
      handleSelectPlan(firstPlan);
    }
    setNewRouterType(scenario === 'enterprise' ? 'ftto-main' : 'standard');
  }, [scenario]);

  useEffect(() => {
    if (!parentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setParentSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(parentRef.current);
    return () => observer.disconnect();
  }, []);

  const fitWidth = parentSize.width / parentSize.height > aspectRatio 
    ? parentSize.height * aspectRatio 
    : parentSize.width;
  const fitHeight = parentSize.width / parentSize.height > aspectRatio 
    ? parentSize.height 
    : parentSize.width / aspectRatio;

  const [enterpriseName, setEnterpriseName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320); // Default 80 (w-80 = 320px)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'month' | 'quarter' | 'year'>('year');

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      const newWidth = window.innerWidth - e.clientX;
      setRightSidebarWidth(Math.max(320, Math.min(800, newWidth)));
    };
    const handleMouseUp = () => setIsResizingSidebar(false);

    if (isResizingSidebar) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar]);

  const getDynamicScale = () => {
    if (!selectedPlan.widthMeters || fitWidth === 0) return null;
    
    // Calculate how many pixels represent 1 meter at current zoom
    const visualWidth = fitWidth * transform.scale;
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
    setError(null);
    if (plan.type === 'default') {
      const analysis = defaultAnalyses[plan.id];
      setAnalysisResult(analysis);
      setRouters(analysis.routers);
    } else {
      setAnalysisResult(null);
      setRouters([]);
    }
  };

  const mainPrice = scenario === 'enterprise' ? 599 : 299;
  const subPrice = scenario === 'enterprise' ? 299 : 199;
  
  const cycleMultiplier = billingCycle === 'month' ? 1 : billingCycle === 'quarter' ? 3 : 12;
  const baseDiscount = scenario === 'enterprise' ? 100 : 50;
  const discount = billingCycle === 'month' ? 0 : billingCycle === 'quarter' ? baseDiscount * 3 + 50 : baseDiscount * 12 + 300;
  
  const mainRouters = routers.filter(r => ['standard', 'high-power', 'fttr-main', 'ftto-main'].includes(r.type || 'standard'));
  const subRouters = routers.filter(r => ['mesh', 'fttr-sub', 'ftto-sub'].includes(r.type || ''));
  const totalPrice = (mainRouters.length * mainPrice + subRouters.length * subPrice) * cycleMultiplier - discount;

  const handleAddRouterByType = (isMain: boolean) => {
    const newRouter: RouterNode = {
      id: `r${Date.now()}`,
      x: 50,
      y: 50,
      type: isMain 
        ? (scenario === 'enterprise' ? 'ftto-main' : 'standard')
        : (scenario === 'enterprise' ? 'ftto-sub' : 'mesh'),
      locationDescription: '手动新增节点'
    };
    setRouters([...routers, newRouter]);
  };

  const handleRemoveRouterByType = (isMain: boolean) => {
    if (isMain && scenario === 'enterprise' && mainRouters.length <= 1) {
      alert('企业模式下，起码要有一个主设备。');
      return;
    }

    const typesToRemove = isMain 
      ? ['standard', 'high-power', 'fttr-main', 'ftto-main']
      : ['mesh', 'fttr-sub', 'ftto-sub'];
    
    const reversed = [...routers].reverse();
    const index = reversed.findIndex(r => typesToRemove.includes(r.type || (isMain ? 'standard' : '')));
    if (index !== -1) {
      const actualIndex = routers.length - 1 - index;
      const newRouters = [...routers];
      newRouters.splice(actualIndex, 1);
      setRouters(newRouters);
    }
  };

  const convertSvgToPng = (svgUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 800;
        canvas.height = img.height || 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = svgUrl;
    });
  };

  const runAnalysis = async (imageUrl: string, mimeType: string, isRefine = false, overrideTier?: 'economical' | 'standard' | 'premium') => {
    const activeTier = overrideTier || planTier;
    setError(null);
    
    // Create a robust pseudo-hash for the image to ensure same images hit the cache
    const imageHash = `${imageUrl.length}_${imageUrl.substring(0, 50)}_${imageUrl.substring(Math.floor(imageUrl.length / 2), Math.floor(imageUrl.length / 2) + 50)}_${imageUrl.substring(imageUrl.length - 50)}`;
    const cacheKey = !isRefine ? `${imageHash}_${scenario}_${modelType}_${enterpriseName}_${selectedPlan.widthMeters}_${activeTier}_${mainPrice}_${subPrice}` : null;

    if (cacheKey && analysisCache.current[cacheKey]) {
      const cachedResult = analysisCache.current[cacheKey];
      setAnalysisResult(cachedResult);
      setRouters(cachedResult.routers);
      if (cachedResult.widthMeters) {
        setSelectedPlan(prev => ({ ...prev, widthMeters: cachedResult.widthMeters }));
      }
      return;
    }

    if (isRefine) {
      setIsRefining(true);
    } else {
      setIsAnalyzing(true);
      setAnalysisResult(null);
      setRouters([]);
    }

    try {
      let finalImageUrl = imageUrl;
      let finalMimeType = mimeType;

      if (mimeType === 'image/svg+xml' || imageUrl.startsWith('data:image/svg+xml')) {
        finalImageUrl = await convertSvgToPng(imageUrl);
        finalMimeType = 'image/jpeg';
      }

      const base64Data = finalImageUrl.split(',')[1] || finalImageUrl;
      const result = await analyzeFloorPlan(
        base64Data, 
        finalMimeType, 
        scenario, 
        modelType, 
        enterpriseName, 
        isRefine ? feedback : '', 
        isRefine ? analysisResult : null,
        selectedPlan.widthMeters,
        activeTier,
        mainPrice,
        subPrice
      );
      const routersWithIds = result.routers.map((r: any, i: number) => ({ ...r, id: `r${Date.now()}-${i}` }));
      
      const finalResult = { ...result, routers: routersWithIds };
      setAnalysisResult(finalResult);
      setRouters(routersWithIds);
      
      if (cacheKey) {
        analysisCache.current[cacheKey] = finalResult;
      }
      
      if (result.widthMeters) {
        setSelectedPlan(prev => ({ ...prev, widthMeters: result.widthMeters }));
      }
      if (isRefine) {
        setFeedback('');
      }
      
      // Auto adjust to 50% ratio
      setRightSidebarWidth(window.innerWidth / 2);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || String(error);
      setError(`分析失败: ${errorMessage.includes('timeout') ? '请求超时，请重试' : errorMessage}`);
      
      if (!isRefine) {
        const fallback = {
          recommendedCount: 1,
          equipment: '分析失败，请检查配置',
          routers: [{id: `r${Date.now()}`, x: 50, y: 50}],
          explanation: {
            priority: '分析失败',
            strategy: '请手动调整路由器位置。',
            summary: `错误信息: ${errorMessage}`
          }
        };
        setAnalysisResult(fallback);
        setRouters(fallback.routers);
      }
    } finally {
      setIsAnalyzing(false);
      setIsRefining(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      
      // Resize image to max 1024x1024 to speed up AI processing and avoid timeouts
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxSize = 1024;
        
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const resizedBase64 = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.8);
          
          const newPlan: FloorPlan = {
            id: 'uploaded-' + Date.now(),
            name: file.name,
            imageUrl: resizedBase64,
            type: 'uploaded',
            widthMeters: 10,
            scenario: scenario
          };
          setSelectedPlan(newPlan);
          await runAnalysis(resizedBase64, file.type === 'image/png' ? 'image/png' : 'image/jpeg');
        }
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handleReanalyze = () => {
    if (selectedPlan.imageUrl) {
      // For default SVGs, mimeType is image/svg+xml
      const mimeType = selectedPlan.imageUrl.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'image/jpeg';
      runAnalysis(selectedPlan.imageUrl, mimeType);
    }
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

  const updateRouterType = (id: string, type: 'standard' | 'high-power' | 'mesh' | 'fttr-main' | 'fttr-sub' | 'ftto-main' | 'ftto-sub') => {
    setRouters(prev => prev.map(r => r.id === id ? { ...r, type } : r));
  };

  const removeRouter = (id: string) => {
    setRouters(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] text-slate-800 overflow-hidden font-sans relative">
      <LoadingOverlay isAnalyzing={isAnalyzing} />
      {/* Background blur decorative elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#0085D0]/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#0085D0]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Floor Plans */}
        <div className="w-80 shrink-0 flex flex-col border-r border-white/60 bg-white/60 backdrop-blur-md shadow-[4px_0_24px_0_rgba(0,133,208,0.05)] z-10">
          <div className="p-6 border-b border-white/60 bg-white/40 backdrop-blur-md">
          <h1 className="text-2xl font-bold text-[#0085D0] flex items-center gap-2">
            <Wifi className="w-7 h-7" />
            新大陆智绘解决方案
          </h1>
          <p className="text-xs text-slate-500 mt-1">信号覆盖分析专家</p>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          {/* Analysis Settings */}
          <div className="mb-6 bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/80 shadow-[0_4px_16px_rgba(0,133,208,0.04)]">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-[#0085D0] rounded-full"></div>
              分析设置
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">场景模式</label>
                <div className="flex bg-white/80 rounded-xl p-1 border border-white/80 shadow-inner">
                  <button 
                    onClick={() => setScenario('home')}
                    className={`flex-1 text-xs font-medium py-2 rounded-lg transition-all ${scenario === 'home' ? 'bg-[#0085D0] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                  >
                    家庭模式
                  </button>
                  <button 
                    onClick={() => setScenario('enterprise')}
                    className={`flex-1 text-xs font-medium py-2 rounded-lg transition-all ${scenario === 'enterprise' ? 'bg-[#0085D0] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                  >
                    政企/园区
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">AI 模型</label>
                <select 
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value as 'gemini-flash' | 'gemini-pro' | 'qwen')}
                  className="w-full bg-white/80 border border-white/80 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0085D0]/50 shadow-sm appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                >
                  <option value="gemini-flash">Gemini 3 Flash (默认)</option>
                  <option value="gemini-pro">Gemini 3.1 Pro</option>
                  <option value="qwen">通义千问 (Qwen VL)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 px-2">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-[#0085D0] rounded-full"></div>
              默认户型
            </h2>
          <div className="flex flex-col gap-2">
            {defaultFloorPlans.filter(p => p.scenario === scenario).map(plan => (
              <button
                key={plan.id}
                onClick={() => handleSelectPlan(plan)}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                  selectedPlan.id === plan.id 
                    ? 'bg-white/80 shadow-[0_4px_12px_rgba(0,133,208,0.1)] border border-white/80 text-[#0085D0]' 
                    : 'hover:bg-white/60 text-slate-600 border border-transparent'
                }`}
              >
                <Map className={`w-5 h-5 ${selectedPlan.id === plan.id ? 'text-[#0085D0]' : 'text-slate-400'}`} />
                <span className="font-medium text-sm">{plan.name}</span>
              </button>
            ))}
          </div>
          </div>

          <div className="mt-8 px-2">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-[#0085D0] rounded-full"></div>
              物理尺寸设定
            </h2>
            <div className="flex flex-col gap-4 bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/80 shadow-[0_4px_16px_rgba(0,133,208,0.04)]">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-600 mb-2">宽度 (米)</label>
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
                    className="w-full bg-white/80 border border-white/80 rounded-xl px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0085D0]/50 shadow-inner"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-600 mb-2">长度 (米)</label>
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
                    className="w-full bg-white/80 border border-white/80 rounded-xl px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0085D0]/50 shadow-inner"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-600">面积 (平米)</label>
                    <div className="flex items-center gap-1 bg-white/80 px-3 py-1 rounded-lg border border-white/80 shadow-sm">
                      <input 
                        type="number" 
                        className="w-16 text-right text-sm font-bold text-[#0085D0] bg-transparent focus:outline-none"
                        value={selectedPlan.widthMeters ? Math.round(selectedPlan.widthMeters * (selectedPlan.widthMeters / aspectRatio)) : 0}
                        onChange={(e) => {
                          let val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > 0) {
                            const maxArea = scenario === 'home' ? 2000 : 100000;
                            if (val > maxArea) val = maxArea;
                            setSelectedPlan({ ...selectedPlan, widthMeters: Math.sqrt(val * aspectRatio) });
                          }
                        }}
                      />
                      <span className="text-xs font-medium text-slate-500">㎡</span>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min={scenario === 'home' ? 30 : 100}
                    max={scenario === 'home' ? 2000 : 100000}
                    step="10"
                    value={selectedPlan.widthMeters ? Number((selectedPlan.widthMeters * (selectedPlan.widthMeters / aspectRatio)).toFixed(1)) : 0}
                    onChange={(e) => {
                      let val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        const maxArea = scenario === 'home' ? 2000 : 100000;
                        if (val > maxArea) val = maxArea;
                        setSelectedPlan({ ...selectedPlan, widthMeters: Math.sqrt(val * aspectRatio) });
                      }
                    }}
                    className="w-full accent-[#0085D0] h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-2">
                    <span>{scenario === 'home' ? '30' : '100'}</span>
                    <span>最大可手动输入</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mt-2 bg-white/50 p-3 rounded-xl border border-white/60">
                * 提示：修改宽度、长度或面积会自动等比例缩放。上传图片时系统会自动尝试识别尺寸。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Canvas Area */}
      <div className="flex-1 flex flex-col relative z-10 min-w-0 overflow-hidden">
        <div className="p-4 flex justify-between items-center border-b border-white/60 bg-white/60 backdrop-blur-md shadow-[0_4px_24px_0_rgba(0,133,208,0.02)]">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                showHeatmap ? 'bg-[#0085D0]/10 text-[#0085D0] border border-[#0085D0]/20 shadow-inner' : 'bg-white/80 text-slate-600 hover:bg-white border border-white/60 shadow-sm'
              }`}
            >
              <Activity className="w-4 h-4" />
              热力图 {showHeatmap ? '开' : '关'}
            </button>
            <button 
              onClick={addRouter}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-white/80 text-slate-600 hover:bg-white border border-white/60 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              添加路由器
            </button>
            <select 
              value={newRouterType}
              onChange={(e) => setNewRouterType(e.target.value as any)}
              className="bg-white/80 border border-white/80 text-slate-700 text-sm rounded-xl focus:ring-[#0085D0] focus:border-[#0085D0] block px-4 py-2 shadow-sm backdrop-blur-md outline-none appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
            >
              {scenario === 'home' ? (
                <>
                  <option value="standard">标准路由</option>
                  <option value="high-power">穿墙路由</option>
                  <option value="mesh">Mesh节点</option>
                </>
              ) : (
                <>
                  <option value="ftto-main">FTTO 主网关</option>
                  <option value="ftto-sub">FTTO 从网关</option>
                  <option value="high-power">高密AP</option>
                </>
              )}
            </select>
            <div className="text-xs text-slate-500 hidden md:block max-w-xs">
              {scenario === 'home' ? (
                <>
                  {newRouterType === 'standard' && '适合单间或无阻挡小空间，覆盖约 14 米。'}
                  {newRouterType === 'high-power' && '增强穿透力，适合多墙体，覆盖约 20 米。'}
                  {newRouterType === 'mesh' && '多台组网，大户型无缝漫游，单节点覆盖约 10 米。'}
                </>
              ) : (
                <>
                  {newRouterType === 'ftto-main' && '企业级FTTO主网关，大带宽高并发。'}
                  {newRouterType === 'ftto-sub' && '企业级FTTO从网关/AP，无缝漫游。'}
                  {newRouterType === 'high-power' && '高密AP，适合大面积开阔空间。'}
                </>
              )}
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
          <div 
            ref={parentRef}
            className="w-full h-full bg-white/40 backdrop-blur-md border border-white/60 rounded-3xl shadow-[0_8px_32px_0_rgba(0,133,208,0.08)] p-4 flex items-center justify-center overflow-hidden relative"
          >
            
            {/* Canvas Container */}
            <div 
              ref={containerRef}
              className="relative shadow-[0_4px_24px_rgba(0,133,208,0.1)] border border-white/80 touch-none bg-white/80 backdrop-blur-md origin-center rounded-2xl overflow-hidden"
              style={{ 
                width: `${fitWidth}px`, 
                height: `${fitHeight}px`,
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
                    <div className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-[#0085D0] shadow-sm border border-white/60">
                      宽 {selectedPlan.widthMeters.toFixed(1)} 米
                    </div>
                    <div className="absolute top-4 left-0 right-0 h-[1px] bg-[#0085D0]/40 -z-10"></div>
                    <div className="absolute top-2 left-0 w-[1px] h-4 bg-[#0085D0]/60"></div>
                    <div className="absolute top-2 right-0 w-[1px] h-4 bg-[#0085D0]/60"></div>
                  </div>
                  
                  {/* Left Height Label */}
                  <div className="absolute top-0 left-0 h-full flex flex-col items-start justify-center pl-2 pointer-events-none z-30">
                    <div className="bg-white/80 backdrop-blur-md px-1 py-3 rounded-full text-xs font-bold text-[#0085D0] shadow-sm border border-white/60" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
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
                  <div className={`w-full h-full rounded-full flex items-center justify-center text-white relative z-10 ${
                    router.type?.includes('fttr') ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)]' :
                    router.type?.includes('ftto') ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]' :
                    router.type === 'high-power' ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.8)]' : 
                    router.type === 'mesh' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 
                    'bg-[#0085D0] shadow-[0_0_15px_rgba(0,133,208,0.8)]'
                  }`}>
                    {router.type?.includes('main') ? <Network className="w-5 h-5" /> :
                     router.type?.includes('sub') ? <Radio className="w-4 h-4" /> :
                     router.type === 'high-power' ? <Radio className="w-5 h-5" /> : 
                     router.type === 'mesh' ? <Network className="w-4 h-4" /> : 
                     <Wifi className="w-4 h-4" />}
                  </div>
                  
                  {/* Tooltip for Router Type */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md text-[#0085D0] text-[10px] font-bold px-2.5 py-1 rounded-md shadow-[0_2px_8px_rgba(0,133,208,0.15)] border border-white/80 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">
                    {router.type === 'fttr-main' ? 'FTTR 主路由' :
                     router.type === 'fttr-sub' ? 'FTTR 从路由' :
                     router.type === 'ftto-main' ? 'FTTO 主网关' :
                     router.type === 'ftto-sub' ? 'FTTO 从网关' :
                     router.type === 'high-power' ? (scenario === 'enterprise' ? '高密AP' : '穿墙路由') :
                     router.type === 'mesh' ? 'Mesh 节点' : '标准路由'}
                  </div>
                  {/* Pulsing ring */}
                  <div className={`absolute inset-0 rounded-full animate-ping opacity-30 ${
                    router.type?.includes('fttr') ? 'bg-purple-500' :
                    router.type?.includes('ftto') ? 'bg-indigo-500' :
                    router.type === 'high-power' ? 'bg-orange-500' : 
                    router.type === 'mesh' ? 'bg-emerald-500' : 
                    'bg-[#0085D0]'
                  }`} />
                  
                  {/* Delete button (visible on hover) */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeRouter(router.id); }}
                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-30"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>

                  {/* Type selector (visible on hover) */}
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md shadow-[0_4px_16px_rgba(0,133,208,0.15)] rounded-xl p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-30 flex flex-col gap-1 w-32 border border-white/60">
                    {scenario === 'home' ? (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); updateRouterType(router.id, 'standard'); }} className={`flex items-center gap-2 text-xs font-medium p-1.5 rounded-lg transition-colors ${router.type === 'standard' || !router.type ? 'bg-[#0085D0]/10 text-[#0085D0]' : 'text-slate-700 hover:bg-[#0085D0]/5 hover:text-[#0085D0]'}`}><Wifi className="w-3.5 h-3.5" />标准</button>
                        <button onClick={(e) => { e.stopPropagation(); updateRouterType(router.id, 'high-power'); }} className={`flex items-center gap-2 text-xs font-medium p-1.5 rounded-lg transition-colors ${router.type === 'high-power' ? 'bg-[#0085D0]/10 text-[#0085D0]' : 'text-slate-700 hover:bg-[#0085D0]/5 hover:text-[#0085D0]'}`}><Radio className="w-3.5 h-3.5" />穿墙</button>
                        <button onClick={(e) => { e.stopPropagation(); updateRouterType(router.id, 'mesh'); }} className={`flex items-center gap-2 text-xs font-medium p-1.5 rounded-lg transition-colors ${router.type === 'mesh' ? 'bg-[#0085D0]/10 text-[#0085D0]' : 'text-slate-700 hover:bg-[#0085D0]/5 hover:text-[#0085D0]'}`}><Network className="w-3.5 h-3.5" />Mesh</button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); updateRouterType(router.id, 'ftto-main'); }} className={`flex items-center gap-2 text-xs font-medium p-1.5 rounded-lg transition-colors ${router.type === 'ftto-main' ? 'bg-[#0085D0]/10 text-[#0085D0]' : 'text-slate-700 hover:bg-[#0085D0]/5 hover:text-[#0085D0]'}`}><Server className="w-3.5 h-3.5" />FTTO 主</button>
                        <button onClick={(e) => { e.stopPropagation(); updateRouterType(router.id, 'ftto-sub'); }} className={`flex items-center gap-2 text-xs font-medium p-1.5 rounded-lg transition-colors ${router.type === 'ftto-sub' ? 'bg-[#0085D0]/10 text-[#0085D0]' : 'text-slate-700 hover:bg-[#0085D0]/5 hover:text-[#0085D0]'}`}><Wifi className="w-3.5 h-3.5" />FTTO 从</button>
                        <button onClick={(e) => { e.stopPropagation(); updateRouterType(router.id, 'high-power'); }} className={`flex items-center gap-2 text-xs font-medium p-1.5 rounded-lg transition-colors ${router.type === 'high-power' ? 'bg-[#0085D0]/10 text-[#0085D0]' : 'text-slate-700 hover:bg-[#0085D0]/5 hover:text-[#0085D0]'}`}><Radio className="w-3.5 h-3.5" />高密AP</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Heatmap Legend */}
          {showHeatmap && (
            <div className="absolute bottom-10 right-10 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-[0_8px_24px_rgba(0,133,208,0.15)] border border-white/60 z-20">
              <div className="text-xs font-bold text-[#0085D0] mb-3 flex items-center gap-2">
                <div className="w-1 h-3 bg-[#0085D0] rounded-full"></div>
                信号强度
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div><span className="text-xs text-slate-600 font-medium">极强 (无缝覆盖)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]"></div><span className="text-xs text-slate-600 font-medium">良好 (流畅视频)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></div><span className="text-xs text-slate-600 font-medium">一般 (网页浏览)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div><span className="text-xs text-slate-600 font-medium">较弱 (可能卡顿)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div><span className="text-xs text-slate-600 font-medium">极弱 (经常断线)</span></div>
              </div>
            </div>
          )}
          
          {/* Scale Indicator */}
          {dynamicScale && (
             <div className="absolute bottom-10 left-10 z-20 flex flex-col items-center pointer-events-none">
                <div className="text-xs font-bold text-[#0085D0] mb-1.5 bg-white/80 backdrop-blur-md px-3 py-1 rounded-lg shadow-sm border border-white/60">
                  {dynamicScale.label}
                </div>
                <div className="h-1 bg-[#0085D0]/80 relative rounded-full shadow-[0_0_8px_rgba(0,133,208,0.5)]" style={{ width: `${dynamicScale.width}px` }}>
                  <div className="absolute -top-1.5 -left-0.5 w-1 h-4 bg-[#0085D0] rounded-full shadow-sm"></div>
                  <div className="absolute -top-1.5 -right-0.5 w-1 h-4 bg-[#0085D0] rounded-full shadow-sm"></div>
                </div>
             </div>
          )}
        </div>
      </div>

      {/* Resizer Handle */}
      <div 
        className="w-3 shrink-0 cursor-col-resize bg-transparent hover:bg-[#0085D0]/20 active:bg-[#0085D0]/40 transition-colors z-20 flex items-center justify-center group"
        onMouseDown={() => setIsResizingSidebar(true)}
      >
        <div className="h-12 w-1 bg-slate-300 rounded-full group-hover:bg-[#0085D0] transition-colors shadow-sm"></div>
      </div>

      {/* Right Sidebar: Analysis */}
      <div 
        className="shrink-0 border-l border-white/60 bg-white/60 backdrop-blur-md shadow-[-4px_0_24px_0_rgba(0,133,208,0.05)] z-10 flex flex-col overflow-hidden"
        style={{ width: `${rightSidebarWidth}px` }}
      >
        <div className="p-6 border-b border-white/60 bg-white/40 backdrop-blur-md">
          <h2 className="text-lg font-bold text-slate-800">智能化解决方案</h2>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 bg-red-50/80 backdrop-blur-md rounded-3xl border border-red-200 shadow-[0_8px_32px_0_rgba(239,68,68,0.08)] p-8">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
                <span className="text-red-500 text-2xl">!</span>
              </div>
              <p className="font-medium text-red-600 text-center">{error}</p>
              <button 
                onClick={() => {
                  setError(null);
                  if (selectedPlan.imageUrl) {
                    runAnalysis(selectedPlan.imageUrl, selectedPlan.imageUrl.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'image/jpeg', false);
                  }
                }}
                className="mt-4 px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors text-sm font-medium"
              >
                重试
              </button>
            </div>
          ) : analysisResult ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Plan Tier Selector */}
              <div className="flex bg-white/80 backdrop-blur-md rounded-xl p-1 border border-white/60 shadow-sm">
                <button 
                  onClick={() => {
                    setPlanTier('economical');
                    if (selectedPlan.imageUrl) {
                      runAnalysis(selectedPlan.imageUrl, selectedPlan.imageUrl.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'image/jpeg', false, 'economical');
                    }
                  }}
                  className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${planTier === 'economical' ? 'bg-[#0085D0] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                >
                  经济实惠型
                </button>
                <button 
                  onClick={() => {
                    setPlanTier('standard');
                    if (selectedPlan.imageUrl) {
                      runAnalysis(selectedPlan.imageUrl, selectedPlan.imageUrl.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'image/jpeg', false, 'standard');
                    }
                  }}
                  className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${planTier === 'standard' ? 'bg-[#0085D0] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                >
                  均衡标准型
                </button>
                <button 
                  onClick={() => {
                    setPlanTier('premium');
                    if (selectedPlan.imageUrl) {
                      runAnalysis(selectedPlan.imageUrl, selectedPlan.imageUrl.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'image/jpeg', false, 'premium');
                    }
                  }}
                  className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${planTier === 'premium' ? 'bg-[#0085D0] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                >
                  极致性能型
                </button>
              </div>

              <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl rounded-2xl p-5 border border-white/80 shadow-[0_8px_24px_rgba(0,133,208,0.08)] mb-6">
                <div className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#0085D0] rounded-full"></div>
                  解决方案综述
                </div>
                
                {/* Key Metrics Cards */}
                {analysisResult.solution?.keyMetrics && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {analysisResult.solution.keyMetrics.map((metric: any, idx: number) => (
                      <div key={idx} className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm flex flex-col">
                        <span className="text-xs text-slate-500 mb-1">{metric.label}</span>
                        <div className="flex items-end gap-2">
                          <span className="text-lg font-bold text-[#0085D0]">{metric.value}</span>
                          {metric.trend && (
                            <span className={`text-[10px] font-medium flex items-center ${metric.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                              {metric.trend === 'up' ? '↗' : '↘'} {metric.trendValue}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 mb-4">
                  <div className="text-4xl font-bold text-[#0085D0] leading-none">
                    {mainRouters.length}主{subRouters.length}从
                  </div>
                  <div className="text-sm font-medium text-slate-500 mb-1 ml-2">
                    预估总价: <span className="text-[#0085D0] font-bold text-lg">¥{Math.max(0, totalPrice)}</span>
                  </div>
                </div>
                {analysisResult.equipment && (
                  <div className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm mb-4">
                    <div className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">选型建议</div>
                    <div className="text-sm text-slate-700 leading-relaxed">{analysisResult.equipment}</div>
                  </div>
                )}

                {/* Competitor Advantage & Radar Chart */}
                {analysisResult.solution?.competitorAdvantage && (
                  <div className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm">
                    <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">方案优势对比</h4>
                    <p className="text-sm text-slate-700 leading-relaxed mb-2">{analysisResult.solution.competitorAdvantage}</p>
                    
                    {/* Radar Chart Visualization */}
                    {(analysisResult.solution as any).radarData && (analysisResult.solution as any).radarData.length > 0 && (
                      <div className="h-48 w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={(analysisResult.solution as any).radarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="本方案" dataKey="A" stroke="#0085D0" fill="#0085D0" fillOpacity={0.5} />
                            <Radar name="传统方案" dataKey="B" stroke="#94a3b8" fill="#cbd5e1" fillOpacity={0.5} />
                          </RadarChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-4 mt-1 text-[10px]">
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#0085D0]"></div>本方案</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#cbd5e1]"></div>传统方案</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-white/60 shadow-[0_4px_16px_rgba(0,133,208,0.04)]">
                <div className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#0085D0] rounded-full"></div>
                  部署方案解析
                </div>
                {typeof analysisResult.explanation === 'string' ? (
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {analysisResult.explanation}
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">规划重点</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysisResult.explanation.priority}</p>
                    </div>
                    <div className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">部署策略</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysisResult.explanation.strategy}</p>
                    </div>
                    <div className="bg-[#0085D0]/5 p-3 rounded-xl border border-[#0085D0]/10">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">方案总结</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysisResult.explanation.summary}</p>
                    </div>
                  </div>
                )}
              </div>

              {analysisResult.solution && (
                <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-white/60 shadow-[0_4px_16px_rgba(0,133,208,0.04)]">
                  <div className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <div className="w-1 h-4 bg-[#0085D0] rounded-full"></div>
                    综合解决方案
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">组网方案</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysisResult.solution.networkingPlan}</p>
                    </div>
                    
                    {routers.length > 0 && (
                      <div className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm">
                        <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">节点说明</h4>
                        <div className="space-y-2 mt-2">
                          {routers.map((router, index) => (
                            <div key={router.id} className="flex flex-col gap-1 border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700">节点 {index + 1}</span>
                                <span className="text-[10px] text-slate-500 bg-white/80 px-2 py-0.5 rounded-full border border-white/60">
                                  X: {Math.round(router.x)}% Y: {Math.round(router.y)}%
                                </span>
                              </div>
                              <div className="text-xs text-slate-600">
                                {router.locationDescription || '建议放置于此区域以保证覆盖。'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">套餐推荐</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysisResult.solution.packageRecommendation}</p>
                    </div>

                    {/* Interactive Pricing Calculator */}
                    <div className="bg-white/60 p-4 rounded-xl border border-white/80 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider">设备与资费明细</h4>
                        <div className="flex bg-white/80 rounded-lg p-0.5 border border-slate-200 shadow-inner">
                          <button onClick={() => setBillingCycle('month')} className={`text-[10px] px-2 py-1 rounded-md transition-all ${billingCycle === 'month' ? 'bg-[#0085D0] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>月付</button>
                          <button onClick={() => setBillingCycle('quarter')} className={`text-[10px] px-2 py-1 rounded-md transition-all ${billingCycle === 'quarter' ? 'bg-[#0085D0] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>季付</button>
                          <button onClick={() => setBillingCycle('year')} className={`text-[10px] px-2 py-1 rounded-md transition-all ${billingCycle === 'year' ? 'bg-[#0085D0] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>年付</button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">主路由 ({mainPrice}元/台)</span>
                            <span className="text-xs text-slate-500">{scenario === 'enterprise' ? 'FTTO 主网关' : '高性能主路由'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleRemoveRouterByType(true)} disabled={scenario === 'enterprise' ? mainRouters.length <= 1 : mainRouters.length === 0} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors">-</button>
                            <span className="text-sm font-bold w-4 text-center">{mainRouters.length}</span>
                            <button onClick={() => handleAddRouterByType(true)} className="w-6 h-6 rounded-full bg-[#0085D0]/10 flex items-center justify-center text-[#0085D0] hover:bg-[#0085D0]/20 transition-colors">+</button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">从路由 ({subPrice}元/台)</span>
                            <span className="text-xs text-slate-500">{scenario === 'enterprise' ? 'FTTO 从网关' : 'Mesh 扩展路由'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleRemoveRouterByType(false)} disabled={subRouters.length === 0} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors">-</button>
                            <span className="text-sm font-bold w-4 text-center">{subRouters.length}</span>
                            <button onClick={() => handleAddRouterByType(false)} className="w-6 h-6 rounded-full bg-[#0085D0]/10 flex items-center justify-center text-[#0085D0] hover:bg-[#0085D0]/20 transition-colors">+</button>
                          </div>
                        </div>

                        <div className="h-px w-full bg-slate-200 my-2"></div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">设备小计 ({billingCycle === 'month' ? '1个月' : billingCycle === 'quarter' ? '3个月' : '12个月'})</span>
                          <span className="font-medium">¥{(mainRouters.length * mainPrice + subRouters.length * subPrice) * cycleMultiplier}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">套餐优惠</span>
                          <span className="font-medium text-green-500">-¥{discount}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                          <span className="font-bold text-slate-800">总计预估</span>
                          <span className="font-bold text-lg text-[#0085D0]">¥{Math.max(0, totalPrice)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">资费说明</h4>
                      <p className="text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: analysisResult.solution.tariffDescription.replace(/\d+/g, '<span class="font-bold text-[#0085D0] bg-[#0085D0]/10 px-1 rounded">$&</span>') }}></p>
                    </div>

                    <div className="bg-[#0085D0]/5 p-3 rounded-xl border border-[#0085D0]/10">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">综合说明</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysisResult.solution.comprehensiveSolution}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 pb-6">
                <button onClick={() => alert('方案已保存')} className="flex-1 bg-white border border-[#0085D0] text-[#0085D0] py-2.5 rounded-xl font-medium hover:bg-[#0085D0]/5 transition-colors shadow-sm">保存方案</button>
                <button onClick={() => alert('已提交审核')} className="flex-1 bg-white border border-[#0085D0] text-[#0085D0] py-2.5 rounded-xl font-medium hover:bg-[#0085D0]/5 transition-colors shadow-sm">提交审核</button>
                <button onClick={() => alert('已甩单执行')} className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl font-medium hover:bg-amber-600 transition-colors shadow-md">甩单执行</button>
              </div>

            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_32px_0_rgba(0,133,208,0.08)] p-8">
              <Info className="w-10 h-10 text-slate-300" />
              <p className="font-medium">请选择或上传户型图开始分析</p>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Bottom Bar: Upload & Customer Requirements */}
      <div className="p-4 border-t border-white/60 bg-white/60 backdrop-blur-md shrink-0 z-20 flex items-center gap-4">
        <div className="flex-1 bg-white/80 backdrop-blur-md rounded-xl p-2 border border-white/60 shadow-sm flex items-center gap-2">
          <div className="pl-3 text-sm font-bold text-slate-800 whitespace-nowrap flex items-center gap-2">
            <div className="w-1 h-4 bg-[#0085D0] rounded-full"></div>
            客户诉求
          </div>
          <input 
            type="text" 
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="输入客户诉求，如：增加一个会议室节点，或上传图纸后直接输入诉求"
            className="flex-1 bg-transparent border-none px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && selectedPlan.imageUrl) {
                runAnalysis(selectedPlan.imageUrl, selectedPlan.imageUrl.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'image/jpeg', !!analysisResult);
              }
            }}
          />
          <button
            onClick={() => {
              if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                const recognition = new SpeechRecognition();
                recognition.lang = 'zh-CN';
                recognition.interimResults = true;
                recognition.maxAlternatives = 1;
                
                let baseFeedback = feedback;
                
                recognition.onresult = (event: any) => {
                  let currentTranscript = '';
                  for (let i = 0; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                  }
                  setFeedback(baseFeedback + (baseFeedback ? ' ' : '') + currentTranscript);
                };
                
                recognition.onerror = (event: any) => {
                  console.error('Speech recognition error', event.error);
                  alert('语音识别失败: ' + event.error);
                };
                
                recognition.start();
              } else {
                alert('您的浏览器不支持语音识别功能，请使用Chrome浏览器。');
              }
            }}
            className="bg-white/80 hover:bg-white text-[#0085D0] p-2.5 rounded-xl transition-all shadow-sm border border-white/80 flex items-center justify-center"
            title="语音输入"
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>

        <label className="flex-shrink-0 flex items-center justify-center gap-2 py-3 px-6 bg-white border border-[#0085D0] text-[#0085D0] hover:bg-[#0085D0]/5 rounded-xl cursor-pointer transition-colors shadow-sm">
          <Upload className="w-5 h-5" />
          <span className="font-medium">上传户型图</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </label>
        
        <button 
          onClick={() => {
            if (selectedPlan.imageUrl) {
              runAnalysis(selectedPlan.imageUrl, selectedPlan.imageUrl.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'image/jpeg', !!analysisResult);
            }
          }}
          disabled={isAnalyzing || isRefining || !selectedPlan.imageUrl}
          className="bg-[#0085D0] hover:bg-[#0070b0] text-white px-6 py-3 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium"
        >
          {isAnalyzing || isRefining ? <Loader2 className="w-5 h-5 animate-spin" /> : (analysisResult ? '重新分析' : '开始分析')}
        </button>
      </div>
    </div>
  );
}
