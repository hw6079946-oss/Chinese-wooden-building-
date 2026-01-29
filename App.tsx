import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { GamePhase } from './types';
import { Experience } from './components/Experience';
import { UIOverlay } from './components/UIOverlay';

const App: React.FC = () => {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.INTRO);
  const [progress, setProgress] = useState(0);
  const [level, setLevel] = useState(1); // 1 = Box (starts with Timber), 2 = Stool
  const [inventory, setInventory] = useState<string[]>([]);
  const [rawWoodCount, setRawWoodCount] = useState(0);

  // Helper to advance phases
  const nextPhase = () => {
    // === LEVEL 1: DOVETAIL BOX (Now includes Timber) ===
    if (level === 1) {
      switch (phase) {
        case GamePhase.INTRO:
          setPhase(GamePhase.TIMBER);
          setRawWoodCount(0); // Reset for new game
          break;
        case GamePhase.TIMBER:
          setPhase(GamePhase.CLAMPING);
          break;
        case GamePhase.CLAMPING:
          setPhase(GamePhase.MARKING);
          setTimeout(() => setPhase(GamePhase.CUTTING), 2000); 
          break;
        case GamePhase.CUTTING:
          setPhase(GamePhase.ASSEMBLY_PREP);
          setTimeout(() => setPhase(GamePhase.ASSEMBLY), 1500); 
          break;
        case GamePhase.ASSEMBLY:
          setPhase(GamePhase.CUTTING_BACK);
          break;
        case GamePhase.CUTTING_BACK:
          setPhase(GamePhase.ASSEMBLY_C);
          break;
        case GamePhase.ASSEMBLY_C:
          setPhase(GamePhase.CUTTING_TOP);
          break;
        case GamePhase.CUTTING_TOP:
          setPhase(GamePhase.ASSEMBLY_D);
          break;
        case GamePhase.ASSEMBLY_D:
          setPhase(GamePhase.SUCCESS);
          break;
        case GamePhase.SUCCESS:
          // Controlled by UI Overlay 'Collect' button
          break;
        default:
          setPhase(GamePhase.INTRO);
          break;
      }
    } 
    // === LEVEL 2: WOODEN STOOL ===
    else if (level === 2) {
      switch (phase) {
        case GamePhase.INTRO:
          setPhase(GamePhase.CLAMPING);
          break;
        case GamePhase.CLAMPING:
          // Skip marking, go straight to cutting holes for legs
          setPhase(GamePhase.CUTTING); 
          break;
        case GamePhase.CUTTING:
          // Assemble Legs
          setPhase(GamePhase.ASSEMBLY); 
          break;
        case GamePhase.ASSEMBLY:
          setPhase(GamePhase.SUCCESS);
          break;
        case GamePhase.SUCCESS:
           // End of demo
          break;
        default:
          setPhase(GamePhase.INTRO);
          break;
      }
    }
  };

  const handleCollectAndNext = () => {
     if (level === 1) {
         setInventory([...inventory, "Dovetail Box"]);
         setLevel(2);
         setPhase(GamePhase.INTRO);
         setProgress(0);
         // Keep raw wood count for immersion or reset if consumed
     } else {
         setInventory([...inventory, "Wooden Stool"]);
         // Loop or finish
         setPhase(GamePhase.INTRO);
         setProgress(0);
         setRawWoodCount(0);
         setLevel(1); // Restart loop
     }
  };

  return (
    <div className="w-full h-screen relative no-select font-sans text-slate-800">
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0 bg-[#e0e7ff]">
        <Canvas shadows camera={{ position: [0, 5, 8], fov: 45 }}>
          <Experience 
            phase={phase} 
            progress={progress} 
            setProgress={setProgress}
            onPhaseComplete={nextPhase} 
            level={level}
            rawWoodCount={rawWoodCount}
            setRawWoodCount={setRawWoodCount}
          />
        </Canvas>
      </div>

      {/* 2D UI Overlay */}
      <UIOverlay 
        phase={phase} 
        onNext={nextPhase} 
        progress={progress}
        level={level}
        inventory={inventory}
        rawWoodCount={rawWoodCount}
        onCollect={handleCollectAndNext}
      />
    </div>
  );
};

export default App;