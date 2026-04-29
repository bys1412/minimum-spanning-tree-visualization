/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Play, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Zap, 
  MousePointer2, 
  Link as LinkIcon,
  HelpCircle,
  X,
  Info
} from 'lucide-react';
import * as d3 from 'd3-selection';
import * as d3Zoom from 'd3-zoom';
import { Node, Edge } from './types';
import { cn, generateId } from './utils';
import { usePrimSolver } from './usePrimSolver';
import { PasswordGate } from './components/PasswordGate';

// --- Constants & Types ---

const INITIAL_NODES: Node[] = [
  { id: '1', x: 200, y: 150, label: 'A' },
  { id: '2', x: 400, y: 100, label: 'B' },
  { id: '3', x: 600, y: 150, label: 'C' },
  { id: '4', x: 200, y: 350, label: 'D' },
  { id: '5', x: 400, y: 400, label: 'E' },
  { id: '6', x: 600, y: 350, label: 'F' },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e1', fromId: '1', toId: '2', weight: 4 },
  { id: 'e2', fromId: '1', toId: '4', weight: 2 },
  { id: 'e3', fromId: '2', toId: '3', weight: 5 },
  { id: 'e4', fromId: '2', toId: '4', weight: 3 },
  { id: 'e5', fromId: '2', toId: '5', weight: 1 },
  { id: 'e6', fromId: '3', toId: '5', weight: 6 },
  { id: 'e7', fromId: '3', toId: '6', weight: 3 },
  { id: 'e8', fromId: '4', toId: '5', weight: 4 },
  { id: 'e9', fromId: '5', toId: '6', weight: 2 },
];

type InteractionMode = 'select' | 'addNode' | 'addEdge' | 'delete';

// --- Sub-components ---

const ToolbarButton = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  shortcut 
}: { 
  icon: any; 
  label: string; 
  active?: boolean; 
  onClick: () => void;
  shortcut?: string;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 group relative border-2",
      active 
        ? "bg-blue-50 text-blue-600 border-blue-400 shadow-sm shadow-blue-100" 
        : "bg-white text-slate-500 hover:bg-slate-50 border-slate-200 border-dashed"
    )}
    title={`${label}${shortcut ? ` (${shortcut})` : ""}`}
  >
    <Icon className={cn("w-5 h-5 mb-1", active ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500")} />
    <span className="text-[10px] font-semibold leading-none">{label}</span>
  </button>
);

export default function App() {
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [mode, setMode] = useState<InteractionMode>('select');
  const [selectedElement, setSelectedElement] = useState<{ type: 'node' | 'edge'; id: string } | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  
  // Transform for pan/zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    status: solverStatus,
    currentStep,
    currentStepIndex,
    totalSteps,
    solve,
    nextStep,
    prevStep,
    reset: resetSolver,
    steps
  } = usePrimSolver(nodes, edges);

  const [autoPlay, setAutoPlay] = useState(false);

  // --- Pan & Zoom ---

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const zoom = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });

    d3.select(svgRef.current).call(zoom);

    // Initial center if needed
    // zoom.translateTo(d3.select(svgRef.current), 400, 250);
  }, []);

  // --- Auto Play ---

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoPlay && solverStatus === 'solving') {
      interval = setInterval(() => {
        if (currentStepIndex < totalSteps - 1) {
          nextStep();
        } else {
          setAutoPlay(false);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [autoPlay, solverStatus, currentStepIndex, totalSteps, nextStep]);

  // --- Graph Interactions ---

  const handleSvgClick = (e: React.MouseEvent) => {
    if (solverStatus === 'solving' || solverStatus === 'finished') return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    // Convert click to zoom/pan coordinates
    const clickX = (e.clientX - rect.left - transform.x) / transform.k;
    const clickY = (e.clientY - rect.top - transform.y) / transform.k;

    if (mode === 'addNode') {
      const newNode: Node = {
        id: generateId(),
        x: clickX,
        y: clickY,
        label: String.fromCharCode(65 + (nodes.length % 26)) + (nodes.length >= 26 ? Math.floor(nodes.length / 26) : ''),
      };
      setNodes([...nodes, newNode]);
    } else if (mode === 'select') {
      setSelectedElement(null);
    }
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (solverStatus === 'solving' || solverStatus === 'finished') return;

    if (mode === 'delete') {
      setNodes(nodes.filter(n => n.id !== nodeId));
      setEdges(edges.filter(edge => edge.fromId !== nodeId && edge.toId !== nodeId));
      if (selectedElement?.id === nodeId) setSelectedElement(null);
    } else if (mode === 'addEdge') {
      if (selectedElement?.type === 'node') {
        if (selectedElement.id !== nodeId) {
          // Check if edge already exists
          const exists = edges.find(ed => 
            (ed.fromId === selectedElement.id && ed.toId === nodeId) ||
            (ed.fromId === nodeId && ed.toId === selectedElement.id)
          );
          if (!exists) {
            const newEdge: Edge = {
              id: generateId(),
              fromId: selectedElement.id,
              toId: nodeId,
              weight: Math.floor(Math.random() * 10) + 1,
            };
            setEdges([...edges, newEdge]);
          }
          setSelectedElement(null);
        }
      } else {
        setSelectedElement({ type: 'node', id: nodeId });
      }
    } else if (mode === 'select') {
      setSelectedElement({ type: 'node', id: nodeId });
    }
  };

  const handleEdgeClick = (e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    if (solverStatus === 'solving' || solverStatus === 'finished') return;

    if (mode === 'delete') {
      setEdges(edges.filter(edge => edge.id !== edgeId));
      if (selectedElement?.id === edgeId) setSelectedElement(null);
    } else if (mode === 'select') {
      setSelectedElement({ type: 'edge', id: edgeId });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNode && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const clickX = (e.clientX - rect.left - transform.x) / transform.k;
      const clickY = (e.clientY - rect.top - transform.y) / transform.k;
      
      setNodes(nodes.map(n => n.id === draggedNode ? { ...n, x: clickX, y: clickY } : n));
    }
  };

  // --- Render Helpers ---

  const solverVisited = new Set(currentStep?.visitedNodes || []);
  const solverIncludedEdges = new Set(currentStep?.includedEdges || []);
  const solverCandidateEdges = new Set(currentStep?.candidateEdges.map(e => e.edgeId) || []);

  return (
    <PasswordGate>
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-200">
            <Zap className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-800 leading-none">最小生成树求解器</h1>
            <div className="mt-1 flex items-center space-x-2">
               <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold rounded border border-blue-100 uppercase tracking-wider">Prim 算法</span>
               <span className="text-[10px] text-slate-400 font-medium">运筹学可视化工具</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex bg-slate-100 rounded-lg p-1 space-x-1">
             <button 
                onClick={() => {
                  if (solverStatus !== 'idle') {
                    resetSolver();
                    setAutoPlay(false);
                  }
                }}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  solverStatus === 'idle' ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700"
                )}
             >
               编辑模式
             </button>
             <button 
                onClick={() => {
                  if (solverStatus === 'idle') solve();
                }}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  solverStatus !== 'idle' ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700"
                )}
             >
               演示模式
             </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-5 overflow-y-auto z-10">
          <div className="space-y-8">
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">交互工具</h3>
              <div className="grid grid-cols-2 gap-2">
                <ToolbarButton 
                  icon={MousePointer2} 
                  label="选择对象" 
                  active={mode === 'select'} 
                  onClick={() => setMode('select')} 
                />
                <ToolbarButton 
                  icon={Plus} 
                  label="添加节点" 
                  active={mode === 'addNode'} 
                  onClick={() => setMode('addNode')} 
                />
                <ToolbarButton 
                  icon={LinkIcon} 
                  label="建立连边" 
                  active={mode === 'addEdge'} 
                  onClick={() => setMode('addEdge')} 
                />
                <ToolbarButton 
                  icon={Trash2} 
                  label="删除元素" 
                  active={mode === 'delete'} 
                  onClick={() => setMode('delete')} 
                />
              </div>

              <button
                onClick={() => {
                  setNodes([...INITIAL_NODES]);
                  setEdges([...INITIAL_EDGES]);
                  setSelectedElement(null);
                  resetSolver();
                  setAutoPlay(false);
                }}
                className="w-full mt-4 flex items-center justify-center space-x-2 py-2 border border-slate-200 text-slate-400 rounded-xl hover:bg-slate-50 hover:text-red-500 hover:border-red-100 transition-all text-[11px] font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重置示例图</span>
              </button>
            </section>

            {/* Selection Details */}
            <section className="flex-1">
               <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">对象属性</h3>
              {selectedElement ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-100"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold text-blue-600 uppercase">
                      选中{selectedElement.type === 'node' ? '节点' : '边'}
                    </span>
                    <button onClick={() => setSelectedElement(null)} className="text-slate-300 hover:text-slate-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {selectedElement.type === 'node' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">节点名称</label>
                        <input 
                          type="text" 
                          value={nodes.find(n => n.id === selectedElement.id)?.label || ''} 
                          onChange={(e) => setNodes(nodes.map(n => n.id === selectedElement.id ? { ...n, label: e.target.value } : n))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {selectedElement.type === 'edge' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">权重数值</label>
                        <input 
                          type="number" 
                          value={edges.find(e => e.id === selectedElement.id)?.weight || 0} 
                          onChange={(e) => setEdges(edges.map(ed => ed.id === selectedElement.id ? { ...ed, weight: Number(e.target.value) } : ed))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="text-center py-8 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                   <p className="text-[11px] text-slate-400 font-medium">在画布上点击元素<br/>以查看和修改其属性</p>
                </div>
              )}
            </section>
          </div>

          <div className="mt-auto pt-6 border-t border-slate-100">
              <button 
                onClick={() => solve()}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center space-x-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>自动求解</span>
              </button>
          </div>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 relative graph-grid bg-[#f1f5f9] overflow-hidden" ref={containerRef}>
          {/* Algorithm Info Overlay */}
          <div className="absolute bottom-6 right-6 z-10">
             <AnimatePresence>
                {solverStatus !== 'idle' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="glass-panel p-5 w-72 rounded-3xl shadow-2xl flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-bold text-slate-800 tracking-wide">算法过程 (Prim)</h4>
                      <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full">
                         <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                         <span className="text-[10px] font-bold uppercase tracking-tight">求解中</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 max-h-56 overflow-y-auto pr-2 mb-5 space-y-4 custom-scrollbar text-slate-600">
                      {steps.slice(0, currentStepIndex + 1).map((step, idx) => (
                        <div key={idx} className="flex space-x-3">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full mt-2 shrink-0 transition-colors",
                            idx === currentStepIndex ? "bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" : "bg-slate-300"
                          )} />
                          <p className={cn(
                            "text-[11px] leading-relaxed",
                            idx === currentStepIndex ? "text-slate-800 font-semibold" : "text-slate-400 font-medium"
                          )}>
                            <span className={cn(
                              "font-bold mr-1.5",
                              idx === currentStepIndex ? "text-blue-600" : "text-slate-500"
                            )}>步骤 {idx + 1}:</span>
                            {step.message}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                       <button 
                         onClick={prevStep}
                         disabled={currentStepIndex <= 0}
                         className="flex items-center justify-center space-x-1 py-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-all"
                       >
                         <ChevronLeft className="w-3.5 h-3.5" />
                         <span>上一步</span>
                       </button>
                       <button 
                         onClick={nextStep}
                         disabled={currentStepIndex >= totalSteps - 1}
                         className="flex items-center justify-center space-x-1 py-2 text-[11px] font-bold text-white bg-slate-800 rounded-xl hover:bg-slate-900 disabled:opacity-40 transition-all shadow-md"
                       >
                         <span>下一步</span>
                         <ChevronRight className="w-3.5 h-3.5" />
                       </button>
                    </div>
                  </motion.div>
                )}
             </AnimatePresence>
          </div>

          <svg
            ref={svgRef}
            className="w-full h-full cursor-crosshair touch-none select-none"
            onClick={handleSvgClick}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setDraggedNode(null)}
            onMouseLeave={() => setDraggedNode(null)}
          >
            <defs>
              <pattern
                id="grid"
                width={100}
                height={100}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 100 0 L 0 0 0 100"
                  fill="none"
                  stroke="rgba(0,0,0,0.05)"
                  strokeWidth="1"
                />
                <circle cx="0" cy="0" r="1" fill="rgba(0,0,0,0.1)" />
              </pattern>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                <feOffset dx="0" dy="2" result="offsetblur" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.1" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
              <rect 
                x={-10000} 
                y={-10000} 
                width={20000} 
                height={20000} 
                fill="url(#grid)" 
                pointerEvents="none"
              />
              {/* Edges */}
              {edges.map(edge => {
                const from = nodes.find(n => n.id === edge.fromId);
                const to = nodes.find(n => n.id === edge.toId);
                if (!from || !to) return null;

                const isIncluded = solverIncludedEdges.has(edge.id);
                const isCandidate = solverCandidateEdges.has(edge.id);
                const isSelected = selectedElement?.type === 'edge' && selectedElement.id === edge.id;
                const isProcessing = currentStep?.currentEdgeId === edge.id;

                return (
                  <g key={edge.id} className="group cursor-pointer">
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={
                        isSelected ? '#3b82f6' : 
                        (isIncluded || isProcessing ? '#2563eb' : 
                        (isCandidate ? '#94a3b8' : '#e2e8f0'))
                      }
                      strokeWidth={isSelected || isIncluded || isProcessing ? 4 : 2}
                      strokeDasharray={isCandidate ? "4 4" : "none"}
                      strokeLinecap="round"
                      onClick={(e) => handleEdgeClick(e, edge.id)}
                      className="transition-all duration-300"
                    />
                    {/* Weight badge */}
                    <g 
                      transform={`translate(${(from.x + to.x) / 2}, ${(from.y + to.y) / 2})`}
                      onClick={(e) => handleEdgeClick(e, edge.id)}
                    >
                      <circle
                        r={12}
                        fill="white"
                        stroke={isSelected ? '#3b82f6' : '#f1f5f9'}
                        className="transition-all"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={cn(
                          "text-[11px] font-bold pointer-events-none transition-colors",
                          isSelected ? "fill-blue-600" : "fill-slate-400"
                        )}
                      >
                        {edge.weight}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map(node => {
                const isVisited = solverVisited.has(node.id);
                const isSelected = selectedElement?.type === 'node' && selectedElement.id === node.id;

                return (
                  <g 
                    key={node.id} 
                    className="group"
                    onMouseDown={(e) => {
                      if (mode === 'select' && solverStatus === 'idle') {
                        e.stopPropagation();
                        setDraggedNode(node.id);
                      }
                    }}
                    onClick={(e) => handleNodeClick(e, node.id)}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={24}
                      fill="white"
                      filter="url(#shadow)"
                      stroke={
                        isVisited ? '#2563eb' : 
                        (isSelected ? '#3b82f6' : '#cbd5e1')
                      }
                      strokeWidth={isSelected || isVisited ? 4 : 2}
                      className="transition-all duration-300 cursor-pointer"
                    />
                    <text
                      x={node.x}
                      y={node.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className={cn(
                        "text-[13px] font-bold select-none pointer-events-none transition-colors",
                        isVisited ? "fill-blue-600" : (isSelected ? "fill-blue-500" : "fill-slate-700")
                      )}
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Success Notification */}
          <div className="absolute top-6 right-6 z-10 pointer-events-none">
             <AnimatePresence>
                {solverStatus === 'finished' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 20 }}
                    className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-3"
                  >
                    <div className="bg-white/20 p-1.5 rounded-full">
                       <Zap className="w-4 h-4 fill-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">求解完成!</p>
                      <p className="text-[10px] opacity-80 font-medium">最小权重和: {steps[steps.length - 1]?.includedEdges.reduce((acc, edgeId) => acc + (edges.find(e => e.id === edgeId)?.weight || 0), 0)}</p>
                    </div>
                  </motion.div>
                )}
             </AnimatePresence>
          </div>
        </main>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
    </PasswordGate>
  );
}
