import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Wifi, Upload, Plus, Trash2, Map, Activity, Info, Loader2, Radio, Network, Server, Mic, RefreshCw, Play, Download, PenTool, Save, CheckCircle, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import Markdown from 'react-markdown';
import { FloorPlan, defaultFloorPlans as initialDefaultFloorPlans, defaultAnalyses } from './lib/defaultPlans';
import { RouterNode, AnalysisResult, analyzeFloorPlan, generateFloorPlanImage, editFloorPlanImage } from './lib/gemini';
import { ImageEditorModal } from './components/ImageEditorModal';
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
  const [elapsedTime, setElapsedTime] = useState(0);
  const messages = [
    "AI 正在深度分析户型结构...",
    "正在识别墙体与障碍物...",
    "正在计算最优信号覆盖模型...",
    "正在生成智能组网方案...",
    "正在优化设备选型与报价...",
    "正在生成最终报告，这可能需要一些时间...",
    "AI 正在进行最后的核对..."
  ];

  useEffect(() => {
    if (!isAnalyzing) {
      setElapsedTime(0);
      setMessageIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isAnalyzing]);

  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setMessageIndex(prev => Math.min(prev + 1, messages.length - 1));
    }, 6000);
    return () => clearInterval(interval);
  }, [isAnalyzing, messages.length]);

  if (!isAnalyzing) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full border border-[#0085D0]/20">
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 border-4 border-[#0085D0]/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-[#0085D0] rounded-full border-t-transparent animate-spin"></div>
          <Wifi className="absolute inset-0 m-auto w-6 h-6 text-[#0085D0] animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">智能分析中</h3>
        <div className="text-sm font-bold text-[#0085D0] mb-4 bg-[#0085D0]/10 px-3 py-1 rounded-full">已耗时: {elapsedTime} 秒</div>
        
        <div className="w-full flex flex-col gap-3 mt-2">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex items-center gap-3 text-sm transition-all duration-500 ${idx > messageIndex ? 'opacity-30' : 'opacity-100'}`}>
              {idx < messageIndex ? (
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] shrink-0">✓</div>
              ) : idx === messageIndex ? (
                <div className="w-4 h-4 rounded-full border-2 border-[#0085D0] border-t-transparent animate-spin shrink-0"></div>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0"></div>
              )}
              <span className={idx === messageIndex ? 'text-[#0085D0] font-medium' : 'text-slate-600'}>{msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [defaultFloorPlans, setDefaultFloorPlans] = useState<FloorPlan[]>(initialDefaultFloorPlans);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan>(initialDefaultFloorPlans[0]);
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

  const [scenario, setScenario] = useState<'home' | 'enterprise' | 'office' | 'hotel' | 'shop' | 'hospital'>('home');
  const [modelType, setModelType] = useState<'gemini-flash' | 'gemini-pro' | 'qwen' | 'glm'>('gemini-flash');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [genDescription, setGenDescription] = useState('');
  const [genPhoto, setGenPhoto] = useState<string | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [genElapsedTime, setGenElapsedTime] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<'economical' | 'standard' | 'premium'>('premium');
  const [baseAnalysisResult, setBaseAnalysisResult] = useState<AnalysisResult | null>(defaultAnalyses['1']);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGeneratingPlan) {
      setGenElapsedTime(0);
      interval = setInterval(() => {
        setGenElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGeneratingPlan]);

  useEffect(() => {
    const checkApiKey = async () => {
      // @ts-ignore
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(true); // Fallback if aistudio API is not available
      }
    };
    checkApiKey();
  }, []);

  const deriveTierResult = useCallback((baseResult: AnalysisResult, tier: 'economical' | 'standard' | 'premium'): AnalysisResult => {
    if (tier === 'premium') return baseResult;

    const derived = JSON.parse(JSON.stringify(baseResult)) as AnalysisResult;
    
    let mainRouters = derived.routers.filter(r => ['standard', 'high-power', 'fttr-main', 'ftto-main'].includes(r.type || 'standard'));
    let subRouters = derived.routers.filter(r => ['mesh', 'fttr-sub', 'ftto-sub'].includes(r.type || ''));
    
    // Ensure at least 1 main router if there are any routers
    if (mainRouters.length === 0 && subRouters.length > 0) {
      const firstSub = subRouters.shift()!;
      firstSub.type = firstSub.type?.includes('ftto') ? 'ftto-main' : 'standard';
      mainRouters.push(firstSub);
    }
    
    let keepSubCount = subRouters.length;
    if (tier === 'standard') keepSubCount = Math.max(0, Math.floor(subRouters.length * 0.7));
    if (tier === 'economical') keepSubCount = Math.max(0, Math.floor(subRouters.length * 0.4));
    
    const keptSubRouters = subRouters.slice(0, keepSubCount);
    derived.routers = [...mainRouters, ...keptSubRouters];
    
    // Ensure at least 1 router total
    if (derived.routers.length === 0 && baseResult.routers.length > 0) {
      derived.routers = [baseResult.routers[0]];
    }
    
    derived.recommendedCount = derived.routers.length;
    
    if (derived.equipment && typeof derived.equipment === 'string') {
      derived.equipment = derived.equipment.replace(/\d+台/, `${derived.recommendedCount}台`);
      derived.equipment = derived.equipment.replace(/\d+主\d+从/, `${mainRouters.length}主${keptSubRouters.length}从`);
    }
    
    if (derived.solution?.radarData) {
      derived.solution.radarData = derived.solution.radarData.map(d => {
        let reduction = 0;
        if (tier === 'standard') reduction = 10;
        if (tier === 'economical') reduction = 25;
        
        if (d.subject.includes('成本') || d.subject.includes('Cost')) {
           return { ...d, A: Math.min(d.fullMark || 100, d.A + reduction) };
        }
        return { ...d, A: Math.max(0, d.A - reduction) };
      });
    }
    
    if (derived.explanation && typeof derived.explanation !== 'string') {
      if (tier === 'standard') {
        derived.explanation.summary = "【均衡标准型】在保证核心区域覆盖的同时，适当减少了边缘区域的设备投入，性价比更高。";
      } else if (tier === 'economical') {
        derived.explanation.summary = "【经济实惠型】仅保留核心路由设备，满足最基本的网络连通需求，大幅降低组网成本。";
      }
    }
    
    if (derived.solution?.keyMetrics) {
      derived.solution.keyMetrics = derived.solution.keyMetrics.map(metric => {
        let newMetric = { ...metric };
        const match = metric.value.match(/(\d+)/);
        if (match) {
          let val = parseInt(match[1]);
          if (metric.label.includes('覆盖')) {
            if (tier === 'standard') val = Math.max(0, val - 10);
            if (tier === 'economical') val = Math.max(0, val - 25);
            newMetric.value = metric.value.replace(/\d+/, val.toString());
          } else if (metric.label.includes('并发') || metric.label.includes('终端')) {
            if (tier === 'standard') val = Math.max(0, Math.floor(val * 0.7));
            if (tier === 'economical') val = Math.max(0, Math.floor(val * 0.4));
            newMetric.value = metric.value.replace(/\d+/, val.toString());
          } else if (metric.label.includes('延迟') || metric.label.includes('时延')) {
            if (tier === 'standard') val = val + 15;
            if (tier === 'economical') val = val + 30;
            newMetric.value = metric.value.replace(/\d+/, val.toString());
          } else if (metric.label.includes('周期') || metric.label.includes('时间')) {
            if (tier === 'standard') val = Math.max(1, val - 1);
            if (tier === 'economical') val = Math.max(1, val - 2);
            newMetric.value = metric.value.replace(/\d+/, val.toString());
          }
        }
        return newMetric;
      });
    }

    return derived;
  }, []);

  useEffect(() => {
    if (baseAnalysisResult) {
      const derived = deriveTierResult(baseAnalysisResult, planTier);
      setAnalysisResult(derived);
      setRouters(derived.routers);
    }
  }, [planTier, baseAnalysisResult, deriveTierResult]);

  useEffect(() => {
    // When scenario changes, auto-select the first plan of that scenario
    const firstPlan = defaultFloorPlans.find(p => p.scenario === scenario);
    if (firstPlan && selectedPlan.scenario !== scenario) {
      handleSelectPlan(firstPlan);
    }
    setNewRouterType(scenario !== 'home' ? 'ftto-main' : 'standard');
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
  }, [hasApiKey]);

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
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('year');

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
    if (plan.aspectRatio) {
      setAspectRatio(plan.aspectRatio);
    }
    setError(null);
    if (plan.type === 'default') {
      const analysis = defaultAnalyses[plan.id] || {
        recommendedCount: 2,
        equipment: '推荐使用2台FTTO企业级主/从路由器',
        routers: [
          {id: 'r1', x: 30, y: 50, type: 'ftto-main', locationDescription: '主干区域'},
          {id: 'r2', x: 70, y: 50, type: 'ftto-sub', locationDescription: '分支区域'}
        ],
        explanation: {
          priority: '该场景需要保证高并发接入与稳定性。',
          strategy: '建议在核心区域部署主节点，在人员密集区部署子节点，确保信号无死角覆盖。',
          summary: '两节点组网方案兼顾了覆盖与成本，是该场景的高性价比选择。'
        },
        solution: {
          keyMetrics: [
            {"label": "覆盖率", "value": "98%"},
            {"label": "最高并发", "value": "150台终端"},
            {"label": "漫游延迟", "value": "<30ms"},
            {"label": "施工周期", "value": "1天"}
          ],
          radarData: [
            {"subject": "覆盖范围 (Coverage)", "A": 90, "fullMark": 100},
            {"subject": "带机并发 (Capacity)", "A": 85, "fullMark": 100},
            {"subject": "信号质量 (Quality)", "A": 95, "fullMark": 100},
            {"subject": "漫游体验 (Roaming)", "A": 88, "fullMark": 100},
            {"subject": "投资成本 (Cost)", "A": 80, "fullMark": 100}
          ]
        }
      };
      setBaseAnalysisResult(analysis);
      setAnalysisResult(analysis);
      setRouters(analysis.routers);
    } else if (plan.analysisResult) {
      setBaseAnalysisResult(plan.analysisResult);
      setAnalysisResult(plan.analysisResult);
      setRouters(plan.routers || plan.analysisResult.routers || []);
    } else {
      // Check if we have a cached result for this plan
      const imageHash = `${plan.imageUrl.length}_${plan.imageUrl.substring(0, 50)}_${plan.imageUrl.substring(Math.floor(plan.imageUrl.length / 2), Math.floor(plan.imageUrl.length / 2) + 50)}_${plan.imageUrl.substring(plan.imageUrl.length - 50)}`;
      const cacheKey = `${imageHash}_${scenario}_${modelType}_${enterpriseName}_${plan.widthMeters}_premium_${mainPrice}_${subPrice}`;
      
      if (analysisCache.current[cacheKey]) {
        const cachedResult = analysisCache.current[cacheKey];
        setBaseAnalysisResult(cachedResult);
        if (cachedResult.widthMeters && !plan.widthMeters) {
          setSelectedPlan(prev => ({ ...prev, widthMeters: cachedResult.widthMeters }));
        }
      } else {
        setAnalysisResult(null);
        setRouters([]);
      }
    }
  };

  const isEnterprise = scenario !== 'home';
  const isMonthly = billingCycle === 'month';
  
  const mainPrice = isEnterprise ? (isMonthly ? 50 : 1548) : (isMonthly ? 30 : 788);
  const subPrice = isEnterprise ? (isMonthly ? 30 : 900) : (isMonthly ? 10 : 300);
  
  const mainRouters = routers.filter(r => ['standard', 'high-power', 'fttr-main', 'ftto-main'].includes(r.type || 'standard'));
  const subRouters = routers.filter(r => ['mesh', 'fttr-sub', 'ftto-sub'].includes(r.type || ''));
  
  const cycleMultiplier = isMonthly ? 24 : 1;
  const installFee = isMonthly ? (isEnterprise ? 300 + Math.max(0, subRouters.length - 1) * 200 : 200 + Math.max(0, subRouters.length - 1) * 100) : 0;
  const totalPrice = (mainRouters.length * mainPrice + subRouters.length * subPrice) * cycleMultiplier + installFee;

  const handleAddRouterByType = (isMain: boolean) => {
    const newRouter: RouterNode = {
      id: `r${Date.now()}`,
      x: 50,
      y: 50,
      type: isMain 
        ? (scenario !== 'home' ? 'ftto-main' : 'standard')
        : (scenario !== 'home' ? 'ftto-sub' : 'mesh'),
      locationDescription: '手动新增节点'
    };
    setRouters([...routers, newRouter]);
  };

  const handleRemoveRouterByType = (isMain: boolean) => {
    if (isMain && scenario !== 'home' && mainRouters.length <= 1) {
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
      
      const timeoutId = setTimeout(() => {
        reject(new Error('SVG转换超时'));
      }, 10000);

      img.onload = () => {
        clearTimeout(timeoutId);
        const canvas = document.createElement('canvas');
        let width = img.width || 800;
        let height = img.height || 600;
        const maxSize = 2048;
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
        if (!ctx) return reject(new Error('No canvas context'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('SVG加载失败'));
      };
      img.src = svgUrl;
    });
  };

  const compressImageForAI = (base64Str: string, mimeType: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxSize = 1600; // Reduce max size slightly for better performance
        
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Always compress to JPEG with 0.7 quality to ensure small payload
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(base64Str);
      img.src = base64Str;
    });
  };

  const runAnalysis = async (imageUrl: string, mimeType: string, isRefine = false, targetPlanId?: string) => {
    const activeTier = 'premium'; // Always fetch premium from AI
    const currentPlanId = targetPlanId || selectedPlan.id;
    setError(null);
    
    // Create a robust pseudo-hash for the image to ensure same images hit the cache
    const imageHash = `${imageUrl.length}_${imageUrl.substring(0, 50)}_${imageUrl.substring(Math.floor(imageUrl.length / 2), Math.floor(imageUrl.length / 2) + 50)}_${imageUrl.substring(imageUrl.length - 50)}`;
    const cacheKey = `${imageHash}_${scenario}_${modelType}_${enterpriseName}_${selectedPlan.widthMeters}_premium_${mainPrice}_${subPrice}`;

    if (!isRefine && analysisCache.current[cacheKey]) {
      const cachedResult = analysisCache.current[cacheKey];
      setBaseAnalysisResult(cachedResult);
      if (cachedResult.widthMeters) {
        setSelectedPlan(prev => ({ ...prev, widthMeters: cachedResult.widthMeters }));
      }
      return;
    }

    if (isRefine) {
      setIsRefining(true);
      setAnalysisResult(null);
      setRouters([]);
      // Clear cache for this image to force a fresh analysis next time if needed
      delete analysisCache.current[cacheKey];
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
      } else {
        finalImageUrl = await compressImageForAI(imageUrl, mimeType);
        finalMimeType = 'image/jpeg'; // compressImageForAI returns jpeg
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
      const routersWithIds = (result.routers || []).map((r: any, i: number) => ({ ...r, id: `r${Date.now()}-${i}` }));
      
      const finalResult = { ...result, routers: routersWithIds };
      setBaseAnalysisResult(finalResult);
      
      if (cacheKey) {
        analysisCache.current[cacheKey] = finalResult;
      }
      
      let newWidthMeters = selectedPlan.widthMeters;
      if (result.areaSquareMeters && (!selectedPlan.widthMeters || selectedPlan.widthMeters === 10)) {
        newWidthMeters = Math.sqrt(result.areaSquareMeters! * aspectRatio);
      } else if (result.widthMeters && (!selectedPlan.widthMeters || selectedPlan.widthMeters === 10)) {
        newWidthMeters = result.widthMeters;
      }
      
      // Basic common sense check - apartments are rarely less than 3 meters or more than 100 meters wide
      if (!newWidthMeters || newWidthMeters < 3 || newWidthMeters > 200) {
        newWidthMeters = 10;
      }
      
      setSelectedPlan(prev => ({ 
        ...prev, 
        widthMeters: newWidthMeters,
        analysisResult: finalResult,
        routers: finalResult.routers
      }));
      
      // Update in history
      setDefaultFloorPlans(prev => prev.map(p => {
        if (p.id === currentPlanId) {
          return {
            ...p,
            widthMeters: newWidthMeters,
            analysisResult: finalResult,
            routers: finalResult.routers
          };
        }
        return p;
      }));
      
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
        setBaseAnalysisResult(fallback);
      }
    } finally {
      setIsAnalyzing(false);
      setIsRefining(false);
    }
  };

  const convertToGrayscale = (base64: string, mimeType: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = avg; // red
          data[i + 1] = avg; // green
          data[i + 2] = avg; // blue
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL(mimeType));
      };
      img.onerror = reject;
      img.src = base64;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      
      // Convert to grayscale to reduce parsing pressure
      const grayscaleBase64 = await convertToGrayscale(base64, mimeType);
      
      const newPlan: FloorPlan = {
        id: 'uploaded-' + Date.now(),
        name: file.name.replace(/\.[^/.]+$/, ""),
        imageUrl: base64, // Keep original color image for UI
        type: 'uploaded',
        scenario: scenario
      };
      // Add custom uploaded plan to the list so user can select it later
      setDefaultFloorPlans(prev => [newPlan, ...prev]);
      setSelectedPlan(newPlan);
      // Send grayscale image to AI to reduce parsing pressure
      await runAnalysis(grayscaleBase64, mimeType, !!feedback.trim(), newPlan.id);
    };
    reader.onerror = () => {
      setError('文件读取失败');
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handleReanalyze = async () => {
    if (selectedPlan.imageUrl) {
      // For default SVGs, mimeType is image/svg+xml
      const mimeType = selectedPlan.imageUrl.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'image/jpeg';
      
      let imageToSend = selectedPlan.imageUrl;
      if (mimeType !== 'image/svg+xml') {
        try {
          imageToSend = await convertToGrayscale(selectedPlan.imageUrl, mimeType);
        } catch (e) {
          console.error("Failed to convert to grayscale", e);
        }
      }
      
      runAnalysis(imageToSend, mimeType, false, selectedPlan.id);
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
    try {
      if (e.target instanceof Element && e.target.hasPointerCapture(e.pointerId)) {
        e.target.releasePointerCapture(e.pointerId);
      } else if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch(err) {} 
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const scaleAdjust = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => {
      const newScale = Math.max(0.5, Math.min(5, prev.scale * scaleAdjust));
      return { ...prev, scale: newScale };
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel, hasApiKey]);

  const addRouter = () => {
    setRouters(prev => [...prev, { id: `r${Date.now()}`, x: 50, y: 50, type: newRouterType }]);
  };

  const updateRouterType = (id: string, type: 'standard' | 'high-power' | 'mesh' | 'fttr-main' | 'fttr-sub' | 'ftto-main' | 'ftto-sub') => {
    setRouters(prev => prev.map(r => r.id === id ? { ...r, type } : r));
  };

  const removeRouter = (id: string) => {
    setRouters(prev => prev.filter(r => r.id !== id));
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#0085D0]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Server className="w-8 h-8 text-[#0085D0]" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">需要配置 API Key</h2>
          <p className="text-slate-600 mb-8">
            为了使用高分辨率（2K）的户型图生成功能，您需要配置自己的 Google Cloud API Key。
            <br/><br/>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-[#0085D0] hover:underline">查看计费文档</a>
          </p>
          <button
            onClick={async () => {
              // @ts-ignore
              if (window.aistudio && window.aistudio.openSelectKey) {
                // @ts-ignore
                await window.aistudio.openSelectKey();
                setHasApiKey(true); // Assume success to mitigate race condition
              }
            }}
            className="w-full bg-[#0085D0] hover:bg-[#0070B0] text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            配置 API Key
          </button>
        </div>
      </div>
    );
  }

  if (hasApiKey === null) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#0085D0] animate-spin" /></div>;
  }

  return (
    <>
    <div className="flex flex-col h-screen bg-[#f8fafc] text-slate-800 overflow-hidden font-sans relative">
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
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'home', label: '家庭' },
                    { id: 'enterprise', label: '政企园区' },
                    { id: 'office', label: '写字楼' },
                    { id: 'hotel', label: '酒店' },
                    { id: 'shop', label: '商铺' },
                    { id: 'hospital', label: '医院' }
                  ].map(s => (
                    <button 
                      key={s.id}
                      onClick={() => setScenario(s.id as any)}
                      className={`text-xs font-medium py-2 rounded-lg transition-all border ${scenario === s.id ? 'bg-[#0085D0] text-white border-[#0085D0] shadow-sm' : 'bg-white/80 text-slate-600 border-white/80 hover:bg-white'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <button 
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#0085D0] transition-colors"
                >
                  <span className="transform transition-transform" style={{ transform: showAdvancedSettings ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  高级设置 (模型选择)
                </button>
                
                {showAdvancedSettings && (
                  <div className="mt-3 pt-3 border-t border-slate-200/50">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-600">AI 模型</label>
                      {(modelType === 'gemini-flash' || modelType === 'gemini-pro') && (
                        <button 
                          onClick={async () => {
                            const aistudio = (window as any).aistudio;
                            if (aistudio && aistudio.openSelectKey) {
                              await aistudio.openSelectKey();
                            } else {
                              alert("当前环境不支持设置私有 Key");
                            }
                          }}
                          className="text-[10px] text-[#0085D0] hover:underline bg-[#0085D0]/10 px-2 py-0.5 rounded-full"
                        >
                          设置私有 Key
                        </button>
                      )}
                    </div>
                    <select 
                      value={modelType}
                      onChange={(e) => setModelType(e.target.value as 'gemini-flash' | 'gemini-pro' | 'qwen' | 'glm')}
                      className="w-full bg-white/80 border border-white/80 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0085D0]/50 shadow-sm appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                    >
                      <option value="gemini-flash">Gemini 3 Flash (默认)</option>
                      <option value="gemini-pro">Gemini 3.1 Pro</option>
                      <option value="qwen">通义千问 (Qwen VL)</option>
                      <option value="glm">智谱清言 (GLM-4V)</option>
                    </select>
                  </div>
                )}
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
              <div key={plan.id} className="relative group">
                <button
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    selectedPlan.id === plan.id 
                      ? 'bg-white/80 shadow-[0_4px_12px_rgba(0,133,208,0.1)] border border-white/80 text-[#0085D0]' 
                      : 'hover:bg-white/60 text-slate-600 border border-transparent'
                  }`}
                >
                  <Map className={`w-5 h-5 ${selectedPlan.id === plan.id ? 'text-[#0085D0]' : 'text-slate-400'}`} />
                  <span className="font-medium text-sm flex-1">{plan.name}</span>
                </button>
                {plan.originalImage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectPlan(plan);
                      setShowEditModal(true);
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 transition-opacity bg-white/80 rounded-lg shadow-sm ${
                      selectedPlan.id === plan.id 
                        ? 'opacity-100 text-[#0085D0]' 
                        : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#0085D0]'
                    }`}
                    title="修改户型图"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                )}
              </div>
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
                            const maxArea = scenario === 'home' ? 1000 : 20000;
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
                    max={scenario === 'home' ? 1000 : 20000}
                    step="10"
                    value={selectedPlan.widthMeters ? Number((selectedPlan.widthMeters * (selectedPlan.widthMeters / aspectRatio)).toFixed(1)) : 0}
                    onChange={(e) => {
                      let val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        const maxArea = scenario === 'home' ? 1000 : 20000;
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
              className="relative shadow-[0_4px_24px_rgba(0,133,208,0.1)] border border-white/80 touch-none select-none bg-white/80 backdrop-blur-md origin-center rounded-2xl overflow-hidden"
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
            >
              <img 
                src={selectedPlan.imageUrl} 
                alt="Floor Plan"
                className="block w-full h-full object-fill pointer-events-none" 
                draggable={false}
                onLoad={(e) => {
                  const { naturalWidth, naturalHeight } = e.currentTarget;
                  if (naturalHeight > 0) {
                    const newRatio = naturalWidth / naturalHeight;
                    if (!selectedPlan.aspectRatio) {
                      setAspectRatio(newRatio);
                      setSelectedPlan(prev => ({ ...prev, aspectRatio: newRatio }));
                    } else {
                      setAspectRatio(selectedPlan.aspectRatio);
                    }
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
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch(err) {}
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    setDraggingId(null);
                    try {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    } catch(err) {}
                  }}
                  onPointerCancel={(e) => {
                    e.stopPropagation();
                    setDraggingId(null);
                    try {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    } catch(err) {}
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
                     router.type === 'high-power' ? (scenario !== 'home' ? '高密AP' : '穿墙路由') :
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
        className="shrink-0 border-l border-white/60 bg-white/60 backdrop-blur-md shadow-[-4px_0_24px_0_rgba(0,133,208,0.05)] z-10 flex flex-col overflow-hidden relative"
        style={{ width: `${rightSidebarWidth}px` }}
      >
        <div className="p-6 border-b border-white/60 bg-white/40 backdrop-blur-md z-20 relative">
          <h2 className="text-lg font-bold text-slate-800">智能化解决方案</h2>
        </div>
        
        <div className="flex-1 relative min-w-0">
          <LoadingOverlay isAnalyzing={isAnalyzing || isRefining} />
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
            <div className="p-6">
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
                    runAnalysis(selectedPlan.imageUrl, selectedPlan.imageUrl.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'image/jpeg', !!feedback.trim(), selectedPlan.id);
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
              <div className="bg-[#f8fafc]/95 backdrop-blur-xl pt-6 pb-4 -mx-6 px-6 mb-6 shadow-sm">
                {/* Plan Tier Selector */}
                <div className="flex bg-white/80 backdrop-blur-md rounded-xl p-1 border border-white/60 shadow-sm mb-4">
                  <button 
                    onClick={() => setPlanTier('economical')}
                    className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${planTier === 'economical' ? 'bg-[#0085D0] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                  >
                    经济实惠型
                  </button>
                  <button 
                    onClick={() => setPlanTier('standard')}
                    className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${planTier === 'standard' ? 'bg-[#0085D0] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                  >
                    均衡标准型
                  </button>
                  <button 
                    onClick={() => setPlanTier('premium')}
                    className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${planTier === 'premium' ? 'bg-[#0085D0] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                  >
                    极致性能型
                  </button>
                </div>

                <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-5 border border-white/80 shadow-[0_8px_24px_rgba(0,133,208,0.08)]">
                  <div className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <div className="w-1 h-4 bg-[#0085D0] rounded-full"></div>
                    解决方案综述
                  </div>
                  
                  {/* Key Metrics Cards */}
                  {analysisResult.solution?.keyMetrics && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {(analysisResult.solution.keyMetrics || []).map((metric: any, idx: number) => (
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

                  {/* Radar Chart (Competitor Analysis) */}
                  {analysisResult.solution?.radarData && analysisResult.solution.radarData.length > 0 && (
                    <div className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm mt-4">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">竞品分析对比</h4>
                      <div className="w-full mt-2" style={{ height: 192 }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={analysisResult.solution.radarData}>
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
                    </div>
                  )}
                </div>
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
                ) : analysisResult.explanation ? (
                  <div className="space-y-4">
                    <div className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">规划重点</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysisResult.explanation.priority || '暂无说明'}</p>
                    </div>
                    <div className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">部署策略</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysisResult.explanation.strategy || '暂无说明'}</p>
                    </div>
                    <div className="bg-[#0085D0]/5 p-3 rounded-xl border border-[#0085D0]/10">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">方案总结</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysisResult.explanation.summary || '暂无说明'}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-700 leading-relaxed">
                    暂无详细解析
                  </p>
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
                          <button onClick={() => setBillingCycle('month')} className={`text-[10px] px-2 py-1 rounded-md transition-all ${billingCycle === 'month' ? 'bg-[#0085D0] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>包月(24期)</button>
                          <button onClick={() => setBillingCycle('year')} className={`text-[10px] px-2 py-1 rounded-md transition-all ${billingCycle === 'year' ? 'bg-[#0085D0] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>趸交(买断)</button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">主设备 ({mainPrice}元/{isMonthly ? '月' : '台'})</span>
                            <span className="text-xs text-slate-500">{scenario !== 'home' ? '华为B30标准款 / 中兴G100S' : '华为/中兴 FTTR-H 主网关'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleRemoveRouterByType(true)} disabled={scenario !== 'home' ? mainRouters.length <= 1 : mainRouters.length === 0} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors">-</button>
                            <span className="text-sm font-bold w-4 text-center">{mainRouters.length}</span>
                            <button onClick={() => handleAddRouterByType(true)} className="w-6 h-6 rounded-full bg-[#0085D0]/10 flex items-center justify-center text-[#0085D0] hover:bg-[#0085D0]/20 transition-colors">+</button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">从设备 ({subPrice}元/{isMonthly ? '月' : '台'})</span>
                            <span className="text-xs text-slate-500">{scenario !== 'home' ? '华为B671 / OptiXstar B675' : '华为/中兴 FTTR-H 从网关'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleRemoveRouterByType(false)} disabled={subRouters.length === 0} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors">-</button>
                            <span className="text-sm font-bold w-4 text-center">{subRouters.length}</span>
                            <button onClick={() => handleAddRouterByType(false)} className="w-6 h-6 rounded-full bg-[#0085D0]/10 flex items-center justify-center text-[#0085D0] hover:bg-[#0085D0]/20 transition-colors">+</button>
                          </div>
                        </div>

                        <div className="h-px w-full bg-slate-200 my-2"></div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">设备费 ({isMonthly ? '24个月' : '一次性买断'})</span>
                          <span className="font-medium">¥{(mainRouters.length * mainPrice + subRouters.length * subPrice) * cycleMultiplier}</span>
                        </div>
                        {isMonthly && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">一次性调测费</span>
                            <span className="font-medium">¥{installFee}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                          <span className="font-bold text-slate-800">总计预估</span>
                          <span className="font-bold text-lg text-[#0085D0]">¥{totalPrice}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/60 p-3 rounded-xl border border-white/80 shadow-sm">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-1">资费说明</h4>
                      <p className="text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: `本次方案共配置 ${mainRouters.length} 台主设备（${mainPrice}元/${isMonthly ? '月' : '台'}）和 ${subRouters.length} 台从设备（${subPrice}元/${isMonthly ? '月' : '台'}）。${isMonthly ? `按 24 个月周期计算，加上一次性调测费 ${installFee} 元，` : '按一次性买断（趸交）计算，'}最终预估总价为 ${totalPrice} 元。按需配置，按实结算。`.replace(/\d+/g, '<span class="font-bold text-[#0085D0] bg-[#0085D0]/10 px-1 rounded">$&</span>') }}></p>
                    </div>

                    <div className="bg-[#0085D0]/5 p-4 rounded-xl border border-[#0085D0]/10">
                      <h4 className="text-xs font-bold text-[#0085D0] uppercase tracking-wider mb-4">综合说明</h4>
                      
                      <div className="markdown-body mb-6">
                        <Markdown>{analysisResult.solution.comprehensiveSolution}</Markdown>
                      </div>

                      {/* Visual Reports inside Comprehensive Solution */}
                      <div className="flex flex-col gap-4 mt-6 border-t border-[#0085D0]/10 pt-4">
                        {/* Additional Visual Reports */}
                        {(analysisResult.solution?.donutData || analysisResult.solution?.barData) && (
                          <div className="grid grid-cols-1 gap-3">
                            {analysisResult.solution?.donutData && (
                              <div className="bg-white/80 p-3 rounded-xl shadow-sm border border-white">
                                <h4 className="text-xs font-semibold text-gray-700 mb-2">业务结构分析</h4>
                                <div className="w-full" style={{ height: 160 }}>
                                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                    <PieChart>
                                      <Pie
                                        data={analysisResult.solution.donutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={60}
                                        paddingAngle={5}
                                        dataKey="value"
                                      >
                                        {(analysisResult.solution.donutData || []).map((entry: any, index: number) => (
                                          <Cell key={`cell-${index}`} fill={['#0085D0', '#38bdf8', '#bae6fd', '#0284c7'][index % 4]} />
                                        ))}
                                      </Pie>
                                      <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                                {analysisResult.solution.donutDescription && (
                                  <p className="text-xs text-gray-500 mt-2 text-center">{analysisResult.solution.donutDescription}</p>
                                )}
                              </div>
                            )}
                            {analysisResult.solution?.barData && (
                              <div className="bg-white/80 p-3 rounded-xl shadow-sm border border-white">
                                <h4 className="text-xs font-semibold text-gray-700 mb-2">核心商机预测</h4>
                                <div className="w-full" style={{ height: 160 }}>
                                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                    <BarChart data={analysisResult.solution.barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                      <Bar dataKey="value" fill="#0085D0" radius={[4, 4, 0, 0]} barSize={20} />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                                {analysisResult.solution.barDescription && (
                                  <p className="text-xs text-gray-500 mt-2 text-center">{analysisResult.solution.barDescription}</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-4 gap-2.5 pt-4 pb-6">
                <button onClick={() => alert('方案已保存')} className="group relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_4px_12px_rgba(0,133,208,0.05),inset_0_1px_1px_rgba(255,255,255,0.8)] text-slate-700 py-2 rounded-xl text-sm font-medium hover:bg-white/60 hover:shadow-[0_8px_24px_rgba(0,133,208,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-1.5">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <Save className="w-3.5 h-3.5 text-[#0085D0]" />保存
                </button>
                <button onClick={() => alert('已提交审核')} className="group relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_4px_12px_rgba(0,133,208,0.05),inset_0_1px_1px_rgba(255,255,255,0.8)] text-slate-700 py-2 rounded-xl text-sm font-medium hover:bg-white/60 hover:shadow-[0_8px_24px_rgba(0,133,208,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-1.5">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <CheckCircle className="w-3.5 h-3.5 text-[#0085D0]" />审核
                </button>
                <button onClick={() => alert('方案下载中...')} className="group relative overflow-hidden bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_4px_12px_rgba(0,133,208,0.05),inset_0_1px_1px_rgba(255,255,255,0.8)] text-slate-700 py-2 rounded-xl text-sm font-medium hover:bg-white/60 hover:shadow-[0_8px_24px_rgba(0,133,208,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-1.5">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <Download className="w-3.5 h-3.5 text-[#0085D0]" />下载
                </button>
                <button onClick={() => alert('已甩单执行')} className="group relative overflow-hidden bg-gradient-to-br from-[#0085D0] to-[#006bb3] border border-[#0085D0]/50 shadow-[0_4px_12px_rgba(0,133,208,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)] text-white py-2 rounded-xl text-sm font-medium hover:shadow-[0_8px_24px_rgba(0,133,208,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-1.5">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <Send className="w-3.5 h-3.5" />甩单
                </button>
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
                runAnalysis(selectedPlan.imageUrl, selectedPlan.imageUrl.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'image/jpeg', !!feedback.trim(), selectedPlan.id);
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
          onClick={() => setShowGenerateModal(true)}
          className="flex-shrink-0 flex items-center justify-center gap-2 py-3 px-6 bg-white border border-amber-500 text-amber-500 hover:bg-amber-50 rounded-xl cursor-pointer transition-colors shadow-sm"
        >
          <span className="font-medium">口述+拍照生成</span>
        </button>
        
        <button 
          onClick={() => {
            if (selectedPlan.imageUrl) {
              runAnalysis(selectedPlan.imageUrl, selectedPlan.imageUrl.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'image/jpeg', !!analysisResult || !!feedback.trim(), selectedPlan.id);
            }
          }}
          disabled={isAnalyzing || isRefining || !selectedPlan.imageUrl}
          className="bg-[#0085D0] hover:bg-[#0070b0] text-white px-6 py-3 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium"
        >
          {isAnalyzing || isRefining ? <Loader2 className="w-5 h-5 animate-spin" /> : (analysisResult ? <><RefreshCw className="w-5 h-5 mr-2" />{error ? '重新分析' : '重新分析'}</> : <><Play className="w-5 h-5 mr-2" />开始分析</>)}
        </button>
      </div>
    </div>

    {/* Generate Floor Plan Modal */}
    {showGenerateModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] relative">
          
          {/* Loading Overlay */}
          {isGeneratingPlan && (
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
                  <span className="text-base font-bold text-slate-800">AI 正在生成户型图...</span>
                  <span className="text-sm text-slate-500 mt-1 font-mono">已耗时: {genElapsedTime}s</span>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800 text-lg">口述+拍照生成户型图</h3>
            <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-6">
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-bold text-slate-700 mb-2">上传现场环境照片/手绘图 (可选)</label>
              <label className="flex-1 flex flex-col items-center justify-center w-full min-h-[400px] border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors relative overflow-hidden">
                {genPhoto ? (
                  <div className="relative w-full h-full p-2">
                    <img src={genPhoto} alt="Uploaded env" className="w-full h-full object-contain rounded-lg" />
                    <button 
                      onClick={(e) => { e.preventDefault(); setGenPhoto(null); }}
                      className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-slate-500">
                    <Upload className="w-12 h-12 mb-4 text-slate-400" />
                    <p className="text-base font-bold text-slate-600 mb-1">点击上传照片或手绘草图</p>
                    <p className="text-sm text-slate-400 text-center">支持 JPG, PNG 格式<br/>上传手绘草图能显著提升生成准确度</p>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setGenPhoto(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }} 
                />
              </label>
            </div>

            <div className="w-full md:w-96 flex flex-col">
              <label className="block text-sm font-bold text-slate-700 mb-2">口述描述户型结构</label>
              <div className="relative flex-1">
                <textarea 
                  value={genDescription}
                  onChange={(e) => setGenDescription(e.target.value)}
                  placeholder="例如：这是一个大概80平米的两居室，进门是客厅，左边是主卧，右边是次卧和卫生间..."
                  className="w-full h-full min-h-[200px] bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0085D0]/50 resize-none shadow-inner"
                />
                <button 
                  onClick={() => {
                    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                    if (SpeechRecognition) {
                      const recognition = new SpeechRecognition();
                      recognition.lang = 'zh-CN';
                      recognition.interimResults = true;
                      recognition.onresult = (event: any) => {
                        let currentTranscript = '';
                        for (let i = 0; i < event.results.length; ++i) {
                          currentTranscript += event.results[i][0].transcript;
                        }
                        setGenDescription(prev => prev + currentTranscript);
                      };
                      recognition.onerror = (event: any) => {
                        setGenError('语音识别失败: ' + event.error);
                      };
                      recognition.start();
                    } else {
                      setGenError('您的浏览器不支持语音识别功能，请使用Chrome浏览器。');
                    }
                  }}
                  className="absolute bottom-4 right-4 bg-white hover:bg-slate-100 text-[#0085D0] p-3 rounded-xl transition-all shadow-md border border-slate-200 flex items-center justify-center"
                  title="语音输入"
                >
                  <Mic className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-3">
            <div className="text-red-500 text-sm font-medium px-2 flex-1">
              {genError}
            </div>
            <div className="flex gap-3 shrink-0">
              <button 
                onClick={() => {
                  setShowGenerateModal(false);
                  setGenError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={async () => {
                  setGenError(null);
                  if (!genDescription.trim()) {
                    setGenError('请至少输入口述描述');
                    return;
                  }
                  setIsGeneratingPlan(true);
                  try {
                    const mimeType = genPhoto ? genPhoto.match(/data:(.*?);base64/)?.[1] : undefined;
                    const result = await generateFloorPlanImage(genDescription, genPhoto || undefined, mimeType);
                    
                    const newPlan: FloorPlan = {
                      id: Date.now().toString(),
                      name: `AI生成 ${new Date().toLocaleTimeString()}`,
                      imageUrl: result.imageUrl,
                      originalImage: result.imageUrl,
                      type: 'uploaded',
                      scenario: scenario,
                      widthMeters: result.widthMeters
                    };
                    
                    // Add to defaultFloorPlans so it shows up in history using setState
                    setDefaultFloorPlans(prev => [newPlan, ...prev]);
                    
                    setSelectedPlan(newPlan);
                    setShowGenerateModal(false);
                    setGenDescription('');
                    setGenPhoto(null);
                    
                    // Trigger analysis immediately after generating
                    await runAnalysis(result.imageUrl, mimeType || 'image/jpeg', false, newPlan.id);
                  } catch (err: any) {
                    setGenError('生成失败: ' + err.message);
                  } finally {
                    setIsGeneratingPlan(false);
                  }
                }}
                disabled={isGeneratingPlan || !genDescription.trim()}
                className="px-6 py-2 bg-[#0085D0] text-white text-sm font-medium rounded-lg hover:bg-[#0070b0] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isGeneratingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isGeneratingPlan ? '生成中...' : genError ? '重新生成' : '开始生成'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Edit Floor Plan Modal */}
    {showEditModal && selectedPlan.originalImage && (
      <ImageEditorModal
        initialImage={selectedPlan.originalImage}
        initialTitle={selectedPlan.name}
        widthMeters={selectedPlan.widthMeters}
        onClose={() => setShowEditModal(false)}
        onApply={(newImage, newTitle, newWidthMeters) => {
          const newPlan: FloorPlan = {
            ...selectedPlan,
            name: newTitle || selectedPlan.name,
            imageUrl: newImage,
            originalImage: newImage, // Update original image so they can keep editing
            widthMeters: newWidthMeters !== undefined ? newWidthMeters : selectedPlan.widthMeters
          };
          
          // Update in history
          const index = defaultFloorPlans.findIndex(p => p.id === selectedPlan.id);
          if (index !== -1) {
            defaultFloorPlans[index] = newPlan;
          }
          
          setSelectedPlan(newPlan);
          setAnalysisResult(null);
          setFeedback('');
        }}
      />
    )}
    </>
  );
}
