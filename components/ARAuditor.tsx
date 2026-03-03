
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { geminiService } from '../services/gemini';
import { AuditIssue, ChatMessage } from '../types';
import AIGuide from './AIGuide';

interface Props {
  history: ChatMessage[];
  onUpdateHistory: (messages: ChatMessage[]) => void;
  onAuditComplete: () => void;
}

const ARAuditor: React.FC<Props> = ({ history, onUpdateHistory, onAuditComplete }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [results, setResults] = useState<{ issues: AuditIssue[], score: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isProcessingBackground, setIsProcessingBackground] = useState(false);
  const [activeIssue, setActiveIssue] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'report' | 'remediate'>('report');
  const [sensorStatus, setSensorStatus] = useState<'OFFLINE' | 'INITIALIZING' | 'ACTIVE' | 'DENIED'>('OFFLINE');
  
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [remediatedImage, setRemediatedImage] = useState<string | null>(null);
  const [remediationPrompt, setRemediationPrompt] = useState('');
  const [isRemediating, setIsRemediating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerInterval = useRef<number | null>(null);
  const lastScanTime = useRef<number>(0);

  const startCamera = async () => {
    setSensorStatus('INITIALIZING');
    
    const constraints = {
      video: { 
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const onMetadata = () => {
          setSensorStatus('ACTIVE');
          setIsScanning(true);
          videoRef.current?.play().catch(e => console.error("Video play failed", e));
        };
        videoRef.current.onloadedmetadata = onMetadata;
        if (videoRef.current.readyState >= 2) onMetadata();
      }
    } catch (err) {
      console.error("Camera stream acquisition failed", err);
      setSensorStatus('DENIED');
      alert("Camera access denied. Please enable camera permissions for this site.");
    }
  };

  const captureAndAnalyze = useCallback(async (silent = false) => {
    if (!videoRef.current || !canvasRef.current || isProcessingBackground || (loading && !silent)) return;
    
    const now = Date.now();
    if (silent && now - lastScanTime.current < 12000) return;
    lastScanTime.current = now;

    if (!silent) setLoading(true);
    else setIsProcessingBackground(true);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      setCapturedFrame(base64Image); 

      try {
        const analysis = await geminiService.analyzeAccessibility(base64Image);
        if (analysis && analysis.issues) {
          setResults({ 
            issues: Array.isArray(analysis.issues) ? analysis.issues : [], 
            score: analysis.overallComplianceScore || 0 
          });
          
          if (!silent) {
            onUpdateHistory([...history, {
              role: 'user',
              text: `[SYSTEM] Manual Analysis Complete. Accessibility Score: ${analysis.overallComplianceScore}%.`,
              timestamp: Date.now(),
              isHidden: true
            }]);
            onAuditComplete();
          }
        }
      } catch (error) {
        console.error("Neural Analysis Failed:", error);
      }
    }

    setLoading(false);
    setIsProcessingBackground(false);
  }, [history, isProcessingBackground, loading, onAuditComplete, onUpdateHistory]);

  const handleRemediate = async () => {
    if (!capturedFrame || !remediationPrompt || isRemediating) return;
    
    setIsRemediating(true);
    setRemediatedImage(null); // Clear previous fix to show processing
    try {
      const result = await geminiService.editImage(capturedFrame, remediationPrompt);
      if (result) {
        setRemediatedImage(result);
        setShowOriginal(false);
        onUpdateHistory([...history, {
          role: 'user',
          text: `[SYSTEM] Neural Fix Rendered: "${remediationPrompt}"`,
          timestamp: Date.now(),
          isHidden: true
        }]);
      }
    } catch (err) {
      console.error("Visual remediation failed", err);
    } finally {
      setIsRemediating(false);
    }
  };

  useEffect(() => {
    if (isLiveMode && isScanning) {
      captureAndAnalyze(true);
      scannerInterval.current = window.setInterval(() => {
        captureAndAnalyze(true);
      }, 15000);
    } else {
      if (scannerInterval.current) clearInterval(scannerInterval.current);
    }
    return () => {
      if (scannerInterval.current) clearInterval(scannerInterval.current);
    };
  }, [isLiveMode, isScanning, captureAndAnalyze]);

  const renderAROverlay = () => {
    if (!results || !results.issues || !isScanning) return null;

    return (
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-none z-30"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="glowEffect" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="scannerLine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(99, 102, 241, 0)" />
            <stop offset="50%" stopColor="rgba(99, 102, 241, 0.4)" />
            <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
          </linearGradient>
        </defs>

        {(loading || isProcessingBackground) && (
          <g className="animate-scanning-line">
            <rect x="0" y="0" width="1000" height="150" fill="url(#scannerLine)" opacity="0.6" />
            <line x1="0" y1="0" x2="1000" y2="0" stroke="#6366f1" strokeWidth="5" opacity="0.8" />
          </g>
        )}

        {results.issues.map((issue, idx) => {
          if (!issue.coordinates) return null;
          const [ymin, xmin, ymax, xmax] = issue.coordinates;
          const width = xmax - xmin;
          const height = ymax - ymin;
          const isActive = activeIssue === idx;

          const isCompliant = issue.status === 'COMPLIANT';
          const isWarning = issue.status === 'WARNING';
          const color = isCompliant ? '#10b981' : isWarning ? '#fbbf24' : '#f43f5e';
          const statusIcon = isCompliant ? '✅' : isWarning ? '⚠️' : '❌';
          const bracketSize = Math.min(width, height) * 0.2;

          return (
            <g 
              key={`${idx}-${issue.type}`} 
              className="pointer-events-auto cursor-pointer"
              onMouseEnter={() => setActiveIssue(idx)}
              onMouseLeave={() => setActiveIssue(null)}
            >
              <rect 
                x={xmin} y={ymin} width={width} height={height}
                fill="none" stroke={color} strokeWidth="3" opacity="0.5" filter="url(#glowEffect)"
                className="animate-pulse"
              />
              <rect 
                x={xmin} y={ymin} width={width} height={height}
                fill={color} fillOpacity={isActive ? "0.2" : "0.08"}
                stroke={color} strokeWidth="2" strokeDasharray="8,4"
              />

              <path d={`M${xmin} ${ymin + bracketSize} V${ymin} H${xmin + bracketSize}`} fill="none" stroke={color} strokeWidth="6" />
              <path d={`M${xmax - bracketSize} ${ymin} H${xmax} V${ymin + bracketSize}`} fill="none" stroke={color} strokeWidth="6" />
              <path d={`M${xmin} ${ymax - bracketSize} V${ymax} H${xmin + bracketSize}`} fill="none" stroke={color} strokeWidth="6" />
              <path d={`M${xmax - bracketSize} ${ymax} H${xmax} V${ymax - bracketSize}`} fill="none" stroke={color} strokeWidth="6" />

              {isActive && (
                <foreignObject 
                  x={xmin + width > 500 ? xmin - 420 : xmin + width + 30} 
                  y={Math.max(50, ymin - 100)} 
                  width="400" 
                  height="450"
                  className="overflow-visible"
                >
                  <div className="bg-slate-900/98 backdrop-blur-2xl border border-slate-700 p-8 rounded-[3rem] shadow-[0_0_80px_rgba(0,0,0,0.8)] animate-in zoom-in duration-200 ring-2 ring-indigo-500/20 text-left">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                      <div>
                         <h4 className="font-black text-white text-2xl uppercase tracking-tighter leading-none">{issue.type}</h4>
                         <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mt-2 block">Neural Point ID</span>
                      </div>
                      <span className="text-3xl">{statusIcon}</span>
                    </div>
                    
                    <div className="space-y-4 mb-8">
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Observation</p>
                        <p className="text-slate-200 text-sm leading-relaxed italic">"{issue.description}"</p>
                      </div>
                      <div className="bg-indigo-600/10 border border-indigo-500/30 p-5 rounded-[2rem]">
                        <p className="text-[10px] text-indigo-400 font-bold uppercase mb-2">ADA Fix</p>
                        <p className="text-white text-xs font-semibold leading-snug">{issue.recommendation}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">Est. Cost</span>
                        <span className="text-xl font-black text-white">{issue.costEstimate}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setRemediationPrompt(`REDUCE BARRIER: ${issue.type}. Instruction: ${issue.recommendation}. Create a realistic, architectural fix that matches the environment.`); 
                            setSidebarTab('remediate'); 
                          }}
                          className="bg-slate-800 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all active:scale-95"
                        >
                          Visual Fix
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onUpdateHistory([...history, { role: 'user', text: `Cite the ADA standards for this ${issue.type}: ${issue.description}`, timestamp: Date.now() }]); }}
                          className="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all active:scale-95"
                        >
                          Ask AI
                        </button>
                      </div>
                    </div>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 font-mono relative overflow-hidden">
      {/* HUD Header */}
      <header className="flex-none p-6 bg-slate-900/60 backdrop-blur-2xl border-b border-slate-800 flex items-center justify-between z-50">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-3xl shadow-xl relative overflow-hidden">
            <span>{sensorStatus === 'ACTIVE' ? '🛰️' : '📷'}</span>
            {(loading || isProcessingBackground) && <div className="absolute inset-0 bg-indigo-500/20 animate-pulse"></div>}
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none italic">Spatial HUD v9.5</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className={`w-2 h-2 rounded-full ${
                sensorStatus === 'ACTIVE' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 
                sensorStatus === 'INITIALIZING' ? 'bg-amber-500 animate-pulse' : 'bg-slate-700'
              }`}></span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.5em]">
                {sensorStatus === 'ACTIVE' ? 'Uplink: Synchronized' : sensorStatus === 'INITIALIZING' ? 'Accessing Sensors...' : 'Sensor Link: Offline'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <button 
            onClick={() => setIsLiveMode(!isLiveMode)}
            disabled={!isScanning}
            className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
              isLiveMode 
              ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl scale-105' 
              : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300'
            } disabled:opacity-20`}
          >
            {isLiveMode ? 'SYNC: PERSISTENT' : 'SYNC: MANUAL'}
          </button>
          {!isScanning && (
            <button 
              onClick={startCamera}
              className="bg-indigo-600 text-white px-10 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all hover:bg-indigo-500 shadow-2xl"
            >
              INITIALIZE LENS
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-black overflow-hidden">
          <div className="w-full h-full relative">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover brightness-[1.1] contrast-[1.1] ${!isScanning ? 'hidden' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {isScanning && renderAROverlay()}

            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-slate-950">
                <div className="w-48 h-48 bg-slate-900/30 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center mb-10 group cursor-pointer relative" onClick={startCamera}>
                   <span className="text-7xl group-hover:scale-110 transition-transform duration-500 text-white">📷</span>
                   <div className={`absolute inset-[-20px] border-2 border-indigo-500/20 rounded-full ${sensorStatus === 'INITIALIZING' ? 'animate-spin border-t-indigo-500' : 'animate-ping'}`}></div>
                </div>
                <h3 className="text-indigo-400 font-black text-xl uppercase tracking-[1em] animate-pulse">
                  {sensorStatus === 'INITIALIZING' ? 'Booting Neural Bridge' : 'Connect Vision Sensors'}
                </h3>
              </div>
            )}

            {isScanning && !isLiveMode && (
  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40">
    <button 
      disabled
      className="relative w-32 h-32 opacity-40 cursor-not-allowed"
    >
      <div className="absolute inset-0 rounded-full border-8 border-indigo-500/20"></div>
      <div className="w-full h-full rounded-full bg-white flex items-center justify-center shadow-2xl relative z-10">
        <div className="w-28 h-28 rounded-full border-[10px] border-slate-950 flex flex-col items-center justify-center font-black text-slate-950 text-[14px] uppercase tracking-tighter">
          <span>PHASE 2</span>
        </div>
      </div>
    </button>
  </div>
)}


            {loading && (
              <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                <div className="w-32 h-32 border-[12px] border-white/5 border-t-indigo-500 rounded-full animate-spin mb-10 shadow-2xl"></div>
                <h3 className="text-5xl font-black text-white uppercase tracking-tighter italic">Deep Scanning</h3>
                <p className="text-indigo-300 text-[11px] font-black uppercase tracking-[0.5em] mt-4 animate-pulse">Calculating Proportions</p>
              </div>
            )}
          </div>

          <AIGuide 
            context="Technical Accessibility Compliance & Spatial Auditing" 
            history={history} 
            onUpdateHistory={onUpdateHistory} 
          />
        </div>

        {/* Sidebar */}
        <div className="w-[520px] bg-slate-950 border-l border-slate-800 flex flex-col z-30 shadow-2xl relative">
          <div className="flex border-b border-slate-800 bg-slate-900/40">
             {['report', 'remediate'].map((tab) => (
               <button 
                 key={tab}
                 onClick={() => setSidebarTab(tab as any)}
                 className={`flex-1 py-10 font-black text-[14px] uppercase tracking-[0.4em] transition-all relative ${
                   sidebarTab === tab ? 'text-white bg-slate-900/50' : 'text-slate-500 hover:text-slate-300'
                 }`}
               >
                 {tab === 'remediate' ? 'Visual Synthesis' : 'Audit Log'}
                 {sidebarTab === tab && <div className="absolute bottom-0 left-0 w-full h-1.5 bg-indigo-500 shadow-lg"></div>}
               </button>
             ))}
          </div>

          <div className="flex-1 overflow-hidden relative">
            {sidebarTab === 'report' ? (
              <div className="h-full flex flex-col p-10 overflow-y-auto custom-scrollbar">
                {results ? (
                  <div className="space-y-10 pb-24">
                    <div className="text-center bg-slate-900/30 p-10 rounded-[3.5rem] border border-slate-800 shadow-inner">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.8em] mb-4 block">Compliance Index</span>
                      <span className="text-9xl font-black text-white leading-none tracking-tighter italic">{results.score}%</span>
                    </div>
                    {results.issues.map((issue, idx) => (
                      <div 
                        key={`${idx}-${issue.type}`}
                        onMouseEnter={() => setActiveIssue(idx)}
                        onMouseLeave={() => setActiveIssue(null)}
                        className={`p-10 rounded-[4rem] border-2 transition-all cursor-pointer relative overflow-hidden group ${
                          activeIssue === idx 
                          ? 'bg-indigo-600/15 border-indigo-500 shadow-2xl scale-[1.01]' 
                          : 'bg-slate-900/30 border-slate-800 hover:border-slate-700 shadow-xl'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-xl font-black text-white uppercase tracking-tight italic leading-none">{issue.type}</h4>
                          <span className={`text-[9px] font-black px-4 py-2 rounded-full uppercase tracking-widest ${
                            issue.status === 'COMPLIANT' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            issue.status === 'WARNING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {issue.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed mb-8 italic">"{issue.description}"</p>
                        <div className="grid grid-cols-2 gap-3">
                          <button 
                             onClick={() => { 
                               setRemediationPrompt(`REDUCE BARRIER: ${issue.type}. Recommended fix: ${issue.recommendation}. Implement this physically into the scene matching lighting and architecture.`); 
                               setSidebarTab('remediate'); 
                             }}
                             className="py-4 bg-indigo-600/10 border border-indigo-500/30 rounded-[2rem] text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-inner"
                           >
                             Synthesize Fix
                           </button>
                           <button 
                             onClick={() => { onUpdateHistory([...history, { role: 'user', text: `Explain the technical ADA specs for ${issue.type}. Auditor found: "${issue.description}"`, timestamp: Date.now() }]); }}
                             className="py-4 bg-slate-800 border border-slate-700 rounded-[2rem] text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-all shadow-inner"
                           >
                             Consult AI
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                   <div className="h-full flex flex-col items-center justify-center opacity-20 p-20 text-center">
                      <span className="text-9xl mb-10">🛰️</span>
                      <p className="text-xl font-black uppercase tracking-[1em] text-white italic">Awaiting Sync...</p>
                   </div>
                )}
              </div>
            ) : (
              <div className="h-full p-10 flex flex-col gap-8 bg-slate-950 animate-in slide-in-from-right-4 duration-400 overflow-y-auto custom-scrollbar">
                 <div className="flex justify-between items-center">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Neural Fix</h3>
                    {remediatedImage && (
                       <button 
                        onMouseDown={() => setShowOriginal(true)}
                        onMouseUp={() => setShowOriginal(false)}
                        onMouseLeave={() => setShowOriginal(false)}
                        className="bg-indigo-600/20 border border-indigo-500/30 px-4 py-2 rounded-xl text-[9px] font-black text-indigo-400 uppercase tracking-widest active:bg-indigo-600 active:text-white transition-all"
                       >
                         HOLD: SHOW ORIGINAL
                       </button>
                    )}
                 </div>
                 
                 <p className="text-sm text-slate-400 leading-relaxed font-medium">Render a physical, architecturally integrated ADA solution directly onto the environment buffer.</p>
                 
                 <div className="relative aspect-video bg-slate-900 rounded-[3rem] overflow-hidden border-2 border-slate-800 shadow-2xl group">
                    {remediatedImage && !showOriginal ? (
                      <img src={remediatedImage} className="w-full h-full object-cover animate-in fade-in duration-500" alt="Neural Fix Render" />
                    ) : capturedFrame ? (
                      <img src={`data:image/jpeg;base64,${capturedFrame}`} className={`w-full h-full object-cover transition-all duration-300 ${remediatedImage ? 'opacity-100' : 'opacity-40 grayscale'}`} alt="Source Buffer" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-700 font-black italic uppercase tracking-widest text-xs text-center px-12">Target environment frame required for synthesis</div>
                    )}
                    
                    {isRemediating && (
                      <div className="absolute inset-0 bg-indigo-600/40 backdrop-blur-xl flex flex-col items-center justify-center z-20">
                         <div className="relative">
                            <div className="w-20 h-20 border-4 border-white/20 rounded-full border-t-white animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                               <span className="text-[10px] font-black text-white animate-pulse">FIXING</span>
                            </div>
                         </div>
                         <p className="text-white font-black uppercase tracking-widest animate-pulse text-[10px] mt-6">Reconstructing Architectural Mesh...</p>
                      </div>
                    )}

                    {remediatedImage && (
                      <div className="absolute bottom-4 right-4 bg-emerald-500/90 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">
                        Synthesis Stable
                      </div>
                    )}
                 </div>

                 <div className="space-y-6">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Modification Logic</label>
                    <textarea 
                      value={remediationPrompt}
                      onChange={(e) => setRemediationPrompt(e.target.value)}
                      placeholder="Describe the architectural remediation required..."
                      className="w-full h-32 bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 text-white text-sm focus:border-indigo-500 outline-none transition-all resize-none shadow-inner font-mono"
                    />
                    <button 
                      onClick={handleRemediate}
                      disabled={isRemediating || !capturedFrame}
                      className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 text-white rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-600/40 transition-all active:scale-95 flex items-center justify-center gap-4"
                    >
                      {isRemediating ? 'GENERATING...' : 'SYNTHESIZE VISUAL FIX'}
                      {!isRemediating && <span className="text-xl">✨</span>}
                    </button>
                    
                    {remediatedImage && (
                      <div className="grid grid-cols-2 gap-3">
                         <button 
                          onClick={() => { setRemediatedImage(null); setRemediationPrompt(''); }}
                          className="py-4 bg-slate-800 text-slate-400 rounded-[2rem] font-black uppercase tracking-widest text-[9px] hover:text-white transition-all"
                        >
                          Flush Buffer
                        </button>
                        <button 
                          onClick={() => window.open(remediatedImage, '_blank')}
                          className="py-4 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-[2rem] font-black uppercase tracking-widest text-[9px] hover:bg-emerald-600 hover:text-white transition-all"
                        >
                          Export Visualization
                        </button>
                      </div>
                    )}
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scanning-line {
          0% { transform: translateY(-150px); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(1150px); opacity: 0; }
        }
        .animate-scanning-line { animation: scanning-line 8s linear infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 20px; }
      `}} />
    </div>
  );
};

export default ARAuditor;
