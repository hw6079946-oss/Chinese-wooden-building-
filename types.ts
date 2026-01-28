import React from 'react';

export enum GamePhase {
  INTRO = 'INTRO',
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
// We declare both React.JSX (for React 18+) and global JSX (legacy/global) 
// to ensure compatibility across different TypeScript configurations.

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // Core
      group: any;
      mesh: any;
      scene: any;
      color: any;
      
      // Geometries
      boxGeometry: any;
      planeGeometry: any;
      sphereGeometry: any;
      cylinderGeometry: any;
      torusGeometry: any;
      extrudeGeometry: any;
      edgesGeometry: any;
      
      // Materials
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      lineBasicMaterial: any;
      
      // Lights
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      
      // Helpers
      gridHelper: any;
      axesHelper: any;
      
      // Lines
      lineSegments: any;
      
      // Catch-all
      [elemName: string]: any;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Core
      group: any;
      mesh: any;
      scene: any;
      color: any;
      
      // Geometries
      boxGeometry: any;
      planeGeometry: any;
      sphereGeometry: any;
      cylinderGeometry: any;
      torusGeometry: any;
      extrudeGeometry: any;
      edgesGeometry: any;
      
      // Materials
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      lineBasicMaterial: any;
      
      // Lights
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      
      // Helpers
      gridHelper: any;
      axesHelper: any;
      
      // Lines
      lineSegments: any;
      
      // Catch-all
      [elemName: string]: any;
    }
  }
}
