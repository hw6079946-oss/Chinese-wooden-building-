import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { GamePhase } from '../types';

interface RouterToolProps {
  phase: GamePhase;
  zBackPosition: number;
  onCut: (x: number, z: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  variant?: 'router' | 'drill';
}

export const RouterTool: React.FC<RouterToolProps> = ({ 
  phase, 
  zBackPosition, 
  onCut, 
  onInteractionStart, 
  onInteractionEnd,
  variant = 'router'
}) => {
  const meshRef = useRef<THREE.Group>(null);
  const drillBitRef = useRef<THREE.Group>(null); 
  const [dragging, setDragging] = useState(false);
  const [hovered, setHover] = useState(false);
  useCursor(hovered || dragging);
  
  const { camera, raycaster, pointer } = useThree();
  
  // Height adjustments
  // Stool Seat (Level 2) is 0.3 thick, inverted. Top face (technically bottom) is at World Y = 0.3.
  const workY = variant === 'drill' ? 0.3 : (phase === GamePhase.CUTTING_TOP ? 5.4 : 0.6);
  const workZ = phase === GamePhase.CUTTING_BACK ? (zBackPosition - 0.2) : 0.2;
  
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -workY); 
  
  useFrame((state, delta) => {
    if (dragging && meshRef.current) {
      raycaster.setFromCamera(pointer, camera);
      const target = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, target);
      
      if (target) {
        if (variant === 'drill') {
            // Free movement on X/Z for stool drilling
            meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, target.x, 0.5);
            meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, target.z, 0.5);
            meshRef.current.position.y = workY;
            onCut(meshRef.current.position.x, meshRef.current.position.z); 
        } else {
            // Constrain to board width (X only) for Box router
            const x = Math.max(-1.0, Math.min(1.0, target.x));
            meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, x, 0.3);
            meshRef.current.position.y = workY; 
            meshRef.current.position.z = workZ;
            onCut(meshRef.current.position.x, meshRef.current.position.z);
        }
      }
    }

    // Spin animation
    if (drillBitRef.current) {
      const speed = dragging ? 40 : 2; 
      drillBitRef.current.rotation.y += delta * speed;
    }
  });

  const bodyColor = variant === 'drill' ? "#dc2626" : "#fbbf24"; 

  return (
    <group 
      ref={meshRef} 
      position={[1.5, workY, variant === 'drill' ? 0 : workZ]}
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
      <group ref={drillBitRef}>
        {variant === 'router' ? (
            /* Router Bit */
            <mesh position={[0, 0.075, 0]} castShadow>
                <cylinderGeometry args={[0.02, 0.08, 0.15, 8]} />
                <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
            </mesh>
        ) : (
            /* Twist Drill Bit */
            <group position={[0, 0.2, 0]}>
                {/* Point */}
                <mesh position={[0, -0.2, 0]}>
                    <coneGeometry args={[0.04, 0.1, 8]} />
                    <meshStandardMaterial color="#555" metalness={0.8} />
                </mesh>
                {/* Spiral Shaft */}
                <mesh position={[0, 0.1, 0]}>
                    <cylinderGeometry args={[0.04, 0.04, 0.5, 16]} />
                    <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
                </mesh>
                {/* Visual "flutes" for spiral effect */}
                 <mesh position={[0, 0.1, 0]} rotation={[0,0,0.1]}>
                    <cylinderGeometry args={[0.041, 0.041, 0.5, 3]} />
                    <meshStandardMaterial color="#111" wireframe opacity={0.3} transparent />
                </mesh>
            </group>
        )}

        <mesh position={[0, 0.35, 0]}>
           <cylinderGeometry args={[0.03, 0.03, 0.45, 8]} />
           <meshStandardMaterial color="#9ca3af" metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.65, 0]} castShadow>
           <cylinderGeometry args={[0.12, 0.1, 0.25, 16]} />
           <meshStandardMaterial color="#111" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>

      {/* Body */}
      <group position={[0, 0.75, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow>
           <cylinderGeometry args={[0.28, 0.28, 1.0, 16]} />
           <meshStandardMaterial color={bodyColor} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
            <cylinderGeometry args={[0.28, 0.25, 0.1, 16]} />
            <meshStandardMaterial color="#111" />
        </mesh>
        <group position={[0, 0.6, 0]} rotation={[0, 0, -1.4]}> 
             <mesh position={[0, -0.6, 0]} castShadow>
                 <boxGeometry args={[0.22, 0.8, 0.28]} />
                 <meshStandardMaterial color="#1f2937" />
             </mesh>
        </group>
      </group>

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