/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface Edge {
  id: string;
  fromId: string;
  toId: string;
  weight: number;
}

export type SolverStatus = 'idle' | 'solving' | 'finished';

export interface SolverStep {
  visitedNodes: string[];
  includedEdges: string[];
  candidateEdges: { edgeId: string; weight: number }[];
  currentEdgeId: string | null;
  message: string;
}

export interface GraphState {
  nodes: Node[];
  edges: Edge[];
}
