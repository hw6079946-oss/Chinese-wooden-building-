import React from 'react';

export enum GamePhase {
  INTRO = 'INTRO',
  
  // Level 2 Specific
  TIMBER = 'TIMBER',

  CLAMPING = 'CLAMPING',
  MARKING = 'MARKING',
  CUTTING = 'CUTTING',        // Front of Bottom Board
  ASSEMBLY_PREP = 'ASSEMBLY_PREP',
  ASSEMBLY = 'ASSEMBLY',      // Front Board (A)
  
  CUTTING_BACK = 'CUTTING_BACK', // Back of Bottom Board
  ASSEMBLY_C = 'ASSEMBLY_C',     // Back Board (C)
  
  CUTTING_TOP = 'CUTTING_TOP',   // Top Board (D)
  ASSEMBLY_D = 'ASSEMBLY_D',     // Top Board (D)
  
  SUCCESS = 'SUCCESS'
}

export interface GameState {
  phase: GamePhase;
  clampProgress: number; // 0 to 1
  cutProgress: number; // 0 to 1
  assemblyProgress: number; // 0 to 1
}

// Augment JSX namespace to recognize R3F elements.
// We provide a catch-all index signature to IntrinsicElements to support
// all React Three Fiber elements (mesh, group, geometries, materials, etc.)
// without needing to list them exhaustively.

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}