import { useState, useCallback, useMemo } from 'react';
import { Node, Edge, SolverStep, SolverStatus } from './types';

export function usePrimSolver(nodes: Node[], edges: Edge[]) {
  const [status, setStatus] = useState<SolverStatus>('idle');
  const [steps, setSteps] = useState<SolverStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);

  const solve = useCallback((startNodeId?: string) => {
    if (nodes.length === 0) return;
    
    const startNode = startNodeId || nodes[0].id;
    const visited = new Set<string>([startNode]);
    const included = new Set<string>();
    const allSteps: SolverStep[] = [];

    allSteps.push({
      visitedNodes: Array.from(visited),
      includedEdges: Array.from(included),
      candidateEdges: [],
      currentEdgeId: null,
      message: `选择起始节点: ${nodes.find(n => n.id === startNode)?.label || startNode}`,
    });

    while (visited.size < nodes.length) {
      let minWeight = Infinity;
      let bestEdge: Edge | null = null;
      const candidates: { edgeId: string; weight: number }[] = [];

      // Find all edges connecting visited to non-visited
      for (const edge of edges) {
        const fromVisited = visited.has(edge.fromId);
        const toVisited = visited.has(edge.toId);

        if (fromVisited !== toVisited) {
          candidates.push({ edgeId: edge.id, weight: edge.weight });
          if (edge.weight < minWeight) {
            minWeight = edge.weight;
            bestEdge = edge;
          }
        }
      }

      if (!bestEdge) {
        // Disconnected graph
        allSteps.push({
          visitedNodes: Array.from(visited),
          includedEdges: Array.from(included),
          candidateEdges: [],
          currentEdgeId: null,
          message: '图不连通，无法继续求解。',
        });
        break;
      }

      const nextNodeId = visited.has(bestEdge.fromId) ? bestEdge.toId : bestEdge.fromId;
      const nextNodeLabel = nodes.find(n => n.id === nextNodeId)?.label || nextNodeId;

      allSteps.push({
        visitedNodes: Array.from(visited),
        includedEdges: Array.from(included),
        candidateEdges: candidates,
        currentEdgeId: bestEdge.id,
        message: `从候选边中选择权重最小的边 (${bestEdge.weight})，连接到节点 ${nextNodeLabel}`,
      });

      visited.add(nextNodeId);
      included.add(bestEdge.id);

      allSteps.push({
        visitedNodes: Array.from(visited),
        includedEdges: Array.from(included),
        candidateEdges: [],
        currentEdgeId: null,
        message: `节点 ${nextNodeLabel} 已加入生成树。`,
      });
    }

    if (visited.size === nodes.length) {
      allSteps.push({
        visitedNodes: Array.from(visited),
        includedEdges: Array.from(included),
        candidateEdges: [],
        currentEdgeId: null,
        message: '求解完成！已得到最小生成树。',
      });
    }

    setSteps(allSteps);
    setCurrentStepIndex(0);
    setStatus('solving');
  }, [nodes, edges]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setStatus('finished');
    }
  }, [currentStepIndex, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      setStatus('solving');
    }
  }, [currentStepIndex]);

  const reset = useCallback(() => {
    setSteps([]);
    setCurrentStepIndex(-1);
    setStatus('idle');
  }, []);

  const currentStep = useMemo(() => {
    return currentStepIndex >= 0 ? steps[currentStepIndex] : null;
  }, [steps, currentStepIndex]);

  return {
    status,
    currentStep,
    currentStepIndex,
    totalSteps: steps.length,
    solve,
    nextStep,
    prevStep,
    reset,
    steps
  };
}
