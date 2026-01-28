import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { GamePhase } from '../types';

interface RouterToolProps {
  phase: GamePhase;
  zBackPosition: number;
  onCut: (xPosition: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

export const RouterTool: React.FC<RouterToolProps> = ({ phase, zBackPosition, onCut, onInteractionStart, onInteractionEnd }) => {
  const meshRef = useRef<THREE.Group>(null);
  const drillBitRef = useRef<THREE.Group>(null); // Ref for the spinning part
  const [dragging, setDragging] = useState(false);
  const [hovered, setHover] = useState(false);
  useCursor(hovered || dragging);
  
  const { camera, raycaster, pointer } = useThree();
  
  // Calculate working plane and position based on phase
  const isTop = phase === GamePhase.CUTTING_TOP;
  const isBack = phase === GamePhase.CUTTING_BACK;
  
  // Height adjustments: 
  // We want the bit tip (local 0,0,0) to touch the wood surface.
  // Board top surface is roughly at Y = 0.4 (bottom board) or 5.4 (top board).
  const workY = isTop ? 5.4 : 0.6;
  const workZ = isBack ? (zBackPosition - 0.2) : 0.2;
  
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -workY); 
  
  useFrame((state, delta) => {
    // 1. Dragging Logic
    if (dragging && meshRef.current) {
      raycaster.setFromCamera(pointer, camera);
      const target = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, target);
      
      if (target) {
        // Constrain to board width
        const x = Math.max(-1.0, Math.min(1.0, target.x));
        meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, x, 0.3);
        meshRef.current.position.y = workY; 
        meshRef.current.position.z = workZ;

        onCut(meshRef.current.position.x);
      }
    }

    // 2. Drill Rotation Animation
    if (drillBitRef.current) {
      const speed = dragging ? 40 : 2; // Fast spin when cutting
      drillBitRef.current.rotation.y += delta * speed;
    }
  });

  // Cartoon Colors - Construction Theme
  const bodyColor = "#fbbf24"; // Yellow (DeWalt-ish)
  const gripColor = "#1f2937"; // Dark Grey
  const accentColor = "#ef4444"; // Red Trigger

  return (
    <group 
      ref={meshRef} 
      position={[1.5, workY, workZ]}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onPointerDown={(e) => { 
        e.stopPropagation(); 
        setDragging(true); 
        onInteractionStart();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId); 
      }}
      onPointerUp={(e) => { 
        e.stopPropagation(); 
        setDragging(false); 
        onInteractionEnd();
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); 
      }}
    >
      {/* 
        Model Structure:
        Origin (0,0,0) is the tip of the dovetail bit.
      */}

      {/* --- SPINNING PARTS (Bit + Chuck) --- */}
      <group ref={drillBitRef} position={[0, 0, 0]}>
        {/* Dovetail Cutter Head */}
        <mesh position={[0, 0.075, 0]} castShadow>
           <cylinderGeometry args={[0.02, 0.08, 0.15, 8]} />
           <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Bit Shaft */}
        <mesh position={[0, 0.35, 0]}>
           <cylinderGeometry args={[0.03, 0.03, 0.45, 8]} />
           <meshStandardMaterial color="#9ca3af" metalness={0.6} />
        </mesh>

        {/* Chuck */}
        <mesh position={[0, 0.65, 0]} castShadow>
           <cylinderGeometry args={[0.12, 0.1, 0.25, 16]} />
           <meshStandardMaterial color="#111" metalness={0.5} roughness={0.5} />
        </mesh>
        {/* Chuck Detail */}
        <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.125, 0.105, 0.05, 8]} />
            <meshStandardMaterial color="#333" />
        </mesh>
      </group>

      {/* --- STATIC BODY PARTS (Housing + Handle) --- */}
      <group position={[0, 0.75, 0]}>
        
        {/* Main Body / Motor Housing (Vertical Cylinder) */}
        {/* Aligned with the bit for "drilling down" orientation */}
        <mesh position={[0, 0.5, 0]} castShadow>
           <cylinderGeometry args={[0.28, 0.28, 1.0, 16]} />
           <meshStandardMaterial color={bodyColor} roughness={0.4} />
        </mesh>
        
        {/* Top Cap */}
        <mesh position={[0, 1.05, 0]}>
            <cylinderGeometry args={[0.28, 0.25, 0.1, 16]} />
            <meshStandardMaterial color="#111" />
        </mesh>

        {/* Handle extending to the Right (+X) */}
        <group position={[0, 0.6, 0]} rotation={[0, 0, -1.4]}> 
             {/* -1.4 rad is about -80 degrees, pointing mostly right and slightly down */}
             
             {/* Handle Stem */}
             <mesh position={[0, -0.6, 0]} castShadow>
                 <boxGeometry args={[0.22, 0.8, 0.28]} />
                 <meshStandardMaterial color={gripColor} />
             </mesh>

             {/* Trigger (on the 'underside' relative to rotation, facing the bit) */}
             <mesh position={[0.08, -0.25, 0]}>
                 <boxGeometry args={[0.08, 0.2, 0.1]} />
                 <meshStandardMaterial color={accentColor} emissive={dragging ? "#b91c1c" : "#000"} />
             </mesh>
             
             {/* Battery Base */}
             <mesh position={[0, -1.1, 0]}>
                 <boxGeometry args={[0.35, 0.25, 0.5]} />
                 <meshStandardMaterial color="#111" />
             </mesh>

             {/* Battery Contact Detail */}
             <mesh position={[0, -1.1, 0.26]}>
                 <planeGeometry args={[0.2, 0.1]} />
                 <meshBasicMaterial color="yellow" opacity={0.5} transparent />
             </mesh>
        </group>

        {/* Vents on the main body */}
        <mesh position={[0, 0.7, 0.28]}>
            <boxGeometry args={[0.15, 0.4, 0.02]} />
            <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0, 0.7, -0.28]}>
            <boxGeometry args={[0.15, 0.4, 0.02]} />
            <meshStandardMaterial color="#111" />
        </mesh>
      </group>

      {/* Cutting Effects */}
      {dragging && (
         <group>
           <pointLight position={[0, 0.05, 0]} color="#f59e0b" intensity={3} distance={1.5} decay={2} />
           <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.random() * Math.PI]}>
              <planeGeometry args={[0.3, 0.3]} />
              <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} depthWrite={false} />
           </mesh>
         </group>
      )}
    </group>
  );
};
