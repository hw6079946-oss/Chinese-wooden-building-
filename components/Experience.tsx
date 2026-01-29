import React, { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GamePhase } from '../types';
import { WorkshopTable } from './WorkshopTable';
import { WoodProject } from './WoodProject';

interface ExperienceProps {
  phase: GamePhase;
  progress: number;
  setProgress: (val: number) => void;
  onPhaseComplete: () => void;
  level: number;
  rawWoodCount?: number;
  setRawWoodCount?: (val: number) => void;
}

export const Experience: React.FC<ExperienceProps> = ({ phase, progress, setProgress, onPhaseComplete, level, rawWoodCount, setRawWoodCount }) => {
  const controlsRef = useRef<any>(null);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  
  // Handle Camera Animation and Control State
  const { setAutoMoving } = useCamAnimation(phase, controlsRef, level);

  return (
    <>
      <color attach="background" args={['#eef2ff']} />
      
      {/* Lighting */}
      <ambientLight intensity={0.7} />
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={1.2} 
        castShadow 
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#ffdcae" />
      
      <Environment preset="city" />

      {/* Main Content */}
      <group position={[0, -1, 0]}>
        {phase !== GamePhase.TIMBER && <WorkshopTable />}
        <WoodProject 
          phase={phase} 
          progress={progress} 
          setProgress={setProgress} 
          onPhaseComplete={onPhaseComplete}
          setOrbitEnabled={setOrbitEnabled}
          level={level}
          rawWoodCount={rawWoodCount}
          setRawWoodCount={setRawWoodCount}
        />
      </group>

      <ContactShadows opacity={0.4} scale={20} blur={2} far={4.5} />
      
      <OrbitControls 
        ref={controlsRef}
        enabled={orbitEnabled}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={25}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 1.8}
        onStart={() => {
            setAutoMoving(false);
        }}
      />
    </>
  );
};

function useCamAnimation(phase: GamePhase, controlsRef: React.MutableRefObject<any>, level: number) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 5, 8));
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));
  const [isAutoMoving, setAutoMoving] = useState(false);

  useEffect(() => {
    // Level 2 (Stool) Camera Logic
    if (level === 2) {
         switch(phase) {
             case GamePhase.INTRO:
                targetPos.current.set(0, 5, 8);
                targetLook.current.set(0, 1, 0);
                break;
             case GamePhase.CUTTING: // Drilling holes
                targetPos.current.set(0, 6, 2); // Top down view
                targetLook.current.set(0, 0, 0);
                break;
             case GamePhase.ASSEMBLY:
                targetPos.current.set(3, 3, 3);
                targetLook.current.set(0, 1.5, 0);
                break;
             case GamePhase.SUCCESS:
                targetPos.current.set(0, 3, 6);
                targetLook.current.set(0, 1, 0);
                break;
             default:
                targetPos.current.set(2, 4, 4);
                targetLook.current.set(0, 0.5, 0);
                break;
         }
    } 
    // Level 1 (Box) Camera Logic
    else {
        switch (phase) {
        case GamePhase.INTRO:
            targetPos.current.set(0, 6, 10);
            targetLook.current.set(0, 0, 0);
            break;
        case GamePhase.TIMBER:
            targetPos.current.set(0, 6, 12);
            targetLook.current.set(0, 2, 0);
            break;
        case GamePhase.CLAMPING:
            targetPos.current.set(2, 4, 4);
            targetLook.current.set(0, 0.5, 0);
            break;
        case GamePhase.MARKING:
        case GamePhase.CUTTING:
            targetPos.current.set(0, 7, 3);
            targetLook.current.set(0, 0, 0);
            break;
        case GamePhase.ASSEMBLY_PREP:
        case GamePhase.ASSEMBLY:
            targetPos.current.set(3, 4, 4);
            targetLook.current.set(0, 1, 0);
            break;
        case GamePhase.CUTTING_BACK:
            targetPos.current.set(0, 7, -5); 
            targetLook.current.set(0, 0, -1.5);
            break;
        case GamePhase.ASSEMBLY_C:
            targetPos.current.set(-3, 4, -5);
            targetLook.current.set(0, 1, -1.5);
            break;
        case GamePhase.CUTTING_TOP:
            targetPos.current.set(0, 10, -1.5);
            targetLook.current.set(0, 2, -1.5);
            break;
        case GamePhase.ASSEMBLY_D:
            targetPos.current.set(4, 6, 4);
            targetLook.current.set(0, 2, -1.5);
            break;
        case GamePhase.SUCCESS:
            targetPos.current.set(-5, 4, 5); 
            targetLook.current.set(0, 1, -1.5);
            break;
        default:
             targetPos.current.set(0, 6, 10);
             targetLook.current.set(0, 0, 0);
             break;
        }
    }

    // Trigger animation for a short duration
    setAutoMoving(true);
    const timeout = setTimeout(() => {
        setAutoMoving(false);
    }, 1500); 

    return () => clearTimeout(timeout);
  }, [phase, level]);

  useFrame((state, delta) => {
    if (isAutoMoving) {
      state.camera.position.lerp(targetPos.current, 3 * delta);
      if (controlsRef.current) {
         controlsRef.current.target.lerp(targetLook.current, 3 * delta);
         controlsRef.current.update();
      }
    }
  });
  
  return { setAutoMoving };
}