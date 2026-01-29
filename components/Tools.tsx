import React, { useState, useEffect, useRef } from 'react';
import { useSpring, animated, config } from '@react-spring/three';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import '../types';

interface ClampProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  isClamped: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}

export const Clamp: React.FC<ClampProps> = ({ position, rotation = [0, 0, 0], isClamped, onClick, onPointerOver, onPointerOut }) => {
  // F-Clamp Animation: The bottom arm slides up to tighten
  const { armY, handleRot } = useSpring({
    armY: isClamped ? -0.4 : -0.8, // -0.4 is just below the table thickness
    handleRot: isClamped ? Math.PI * 4 : 0,
    config: { mass: 1, tension: 180, friction: 24 }
  });

  const barHeight = 2.5;
  const barThick = 0.15;
  const armLen = 0.8;

  return (
    <group 
      position={position} 
      rotation={rotation as any}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* --- F-Clamp Visuals --- */}
      
      {/* 1. Main Vertical Bar (Steel) */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[barThick, barHeight, barThick]} />
        <meshStandardMaterial color="#aaa" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* 2. Top Fixed Jaw (Holds top of wood) */}
      <group position={[armLen/2 - barThick/2, 0.6, 0]}> {/* Positioned relative to board height */}
        <mesh castShadow>
             <boxGeometry args={[armLen, 0.15, 0.2]} />
             <meshStandardMaterial color="#ef4444" roughness={0.5} />
        </mesh>
        {/* Rubber pad */}
        <mesh position={[0, -0.08, 0]}>
             <boxGeometry args={[armLen * 0.8, 0.05, 0.2]} />
             <meshStandardMaterial color="#111" />
        </mesh>
      </group>

      {/* 3. Bottom Sliding Arm (Animated) */}
      <animated.group position-y={armY as any} position-x={armLen/2 - barThick/2}>
         <mesh castShadow>
             <boxGeometry args={[armLen, 0.15, 0.2]} />
             <meshStandardMaterial color="#ef4444" roughness={0.5} />
         </mesh>
         
         {/* Screw Mechanism */}
         <group position={[0.2, -0.3, 0]}>
             <mesh>
                 <cylinderGeometry args={[0.04, 0.04, 0.6]} />
                 <meshStandardMaterial color="#333" metalness={0.8} />
             </mesh>
             
             {/* Handle */}
             <animated.mesh position={[0, -0.3, 0]} rotation-y={handleRot as any}>
                 <cylinderGeometry args={[0.08, 0.08, 0.2]} />
                 <meshStandardMaterial color="#ef4444" />
                 <mesh position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
                      <cylinderGeometry args={[0.03, 0.03, 0.5]} />
                      <meshStandardMaterial color="#111" />
                 </mesh>
             </animated.mesh>

             {/* Top Pad Plate */}
             <mesh position={[0, 0.3, 0]}>
                  <cylinderGeometry args={[0.08, 0.08, 0.05]} />
                  <meshStandardMaterial color="#111" />
             </mesh>
         </group>
      </animated.group>
    </group>
  );
};

interface MalletProps {
    position: [number, number, number];
    rotation?: [number, number, number];
    onClick: () => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
}

export const Mallet: React.FC<MalletProps> = ({ position, rotation = [0, 0, 0], onClick, onDragStart, onDragEnd }) => {
    const [strike, setStrike] = useState(false);
    const [hover, setHover] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    // Local position state to support dragging
    const [currentPos, setCurrentPos] = useState(new THREE.Vector3(...position));
    
    // Refs for drag calculation
    const dragStartPos = useRef(new THREE.Vector2());
    const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -position[1]));
    const { camera, raycaster } = useThree();

    // Sync prop position to local state when prop changes (e.g. phase change)
    useEffect(() => {
        setCurrentPos(new THREE.Vector3(...position));
        // Update drag plane height based on new Y prop
        planeRef.current.constant = -position[1];
    }, [position[0], position[1], position[2]]);

    // Animation for striking (Swings in local Z axis)
    const { animRot } = useSpring({
        animRot: strike ? [0, 0, -Math.PI / 4] : [0, 0, Math.PI / 6],
        config: { tension: 300, friction: 15 },
        onRest: () => {
            if (strike) setStrike(false);
        }
    });

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        setIsDragging(true);
        onDragStart?.();
        // Record screen coords to distinguish click vs drag later
        dragStartPos.current.set(e.clientX, e.clientY);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const handlePointerMove = (e: any) => {
        if (!isDragging) return;
        e.stopPropagation();

        // Raycast to horizontal plane at current height
        raycaster.setFromCamera(new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        ), camera);

        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(planeRef.current, target);

        if (target) {
            // Update only X and Z, keep Y fixed at the prop height
            setCurrentPos(prev => new THREE.Vector3(target.x, prev.y, target.z));
        }
    };

    const handlePointerUp = (e: any) => {
        e.stopPropagation();
        setIsDragging(false);
        onDragEnd?.();
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

        // Check distance to see if it was a click or a drag
        const dist = dragStartPos.current.distanceTo(new THREE.Vector2(e.clientX, e.clientY));
        
        // If moved less than 5 pixels, treat as click
        if (dist < 5) {
            setStrike(true);
            onClick();
        }
    };

    return (
        <group 
            position={[currentPos.x, currentPos.y, currentPos.z]} 
            rotation={rotation as any}
        >
             {/* Pivot Group for swing animation (Z-axis rotation) */}
            <animated.group 
                rotation={animRot as any} 
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerOver={() => setHover(true)}
                onPointerOut={() => setHover(false)}
            >
                {/* Visual Offset: Move handle so pivot (0,0,0) is at the grip */}
                <group position={[0, 0.8, 0]}> 
                    {/* Handle (Along Y) */}
                    <mesh position={[0, 0, 0]} castShadow>
                        <cylinderGeometry args={[0.06, 0.08, 1.6]} />
                        <meshStandardMaterial color="#d4a373" roughness={0.8} />
                    </mesh>

                    {/* Head - Positioned at top of handle */}
                    <mesh position={[0, 0.8, 0]} rotation={[0, 0, -Math.PI/2]} castShadow>
                        <cylinderGeometry args={[0.25, 0.25, 0.7]} />
                        <meshStandardMaterial color="#8d6e63" roughness={0.6} />
                    </mesh>

                    {/* Head Faces */}
                    <mesh position={[0.36, 0.8, 0]} rotation={[0, 0, -Math.PI/2]}>
                        <cylinderGeometry args={[0.22, 0.24, 0.02]} />
                        <meshStandardMaterial color="#5d4037" />
                    </mesh>
                    <mesh position={[-0.36, 0.8, 0]} rotation={[0, 0, -Math.PI/2]}>
                         <cylinderGeometry args={[0.22, 0.24, 0.02]} />
                        <meshStandardMaterial color="#5d4037" />
                    </mesh>
                </group>

                {/* Hover Glow */}
                {(hover || isDragging) && (
                    <pointLight position={[0, 1.5, 0]} intensity={1} color="#fbbf24" distance={2} />
                )}
            </animated.group>
            
            {/* Guide Hint: Bouncing Arrow */}
            <BounceArrow visible={!strike && !isDragging} />
        </group>
    );
};

const BounceArrow: React.FC<{visible: boolean}> = ({ visible }) => {
    const arrowRef = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        if (arrowRef.current && visible) {
            // Bobbing animation: Base height 2.8 + sine wave
            arrowRef.current.position.y = 2.8 + Math.sin(clock.getElapsedTime() * 6) * 0.2;
            arrowRef.current.rotation.y += 0.02;
        }
    });

    if (!visible) return null;

    return (
        <group ref={arrowRef} position={[0, 2.8, 0]}>
            {/* Arrow Head */}
            <mesh position={[0, 0, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.15, 0.4, 8]} />
                <meshBasicMaterial color="#ef4444" transparent opacity={0.9} />
            </mesh>
            {/* Arrow Shaft */}
            <mesh position={[0, 0.35, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.3, 8]} />
                <meshBasicMaterial color="#ef4444" transparent opacity={0.9} />
            </mesh>
        </group>
    );
};

export const Chainsaw: React.FC<{
    position: [number, number, number];
    onDragStart: () => void;
    onDragEnd: () => void;
    onCut: (pos: THREE.Vector3) => void;
}> = ({ position, onDragStart, onDragEnd, onCut }) => {
    const groupRef = useRef<THREE.Group>(null);
    const tipRef = useRef<THREE.Group>(null);
    const [dragging, setDragging] = useState(false);
    const [tiltIndex, setTiltIndex] = useState(0); // 0: Vertical, 1: Diagonal, 2: Horizontal
    const { camera, raycaster } = useThree();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);

    const targetAngle = -tiltIndex * (Math.PI / 4);
    const { rotationX } = useSpring({
        rotationX: targetAngle,
        config: { tension: 200, friction: 20 }
    });

    // Toggle Tilt Mode
    const toggleTilt = (e?: any) => {
        if(e) {
            e.stopPropagation();
            e.preventDefault(); 
        }
        setTiltIndex((prev) => (prev + 1) % 3);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'r') toggleTilt();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useFrame(({ clock }) => {
        if (groupRef.current) {
            const vibeStrength = dragging ? 0.005 : 0.001;
            groupRef.current.position.y = 1 + Math.sin(clock.elapsedTime * 50) * vibeStrength;
            
            if (dragging && tipRef.current) {
                const tipPos = new THREE.Vector3();
                tipRef.current.getWorldPosition(tipPos);
                onCut(tipPos);
            }
        }
    });

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        if (e.nativeEvent.button === 2) {
            toggleTilt(e);
            return;
        }
        setDragging(true);
        onDragStart();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const handlePointerMove = (e: any) => {
        if (!dragging) return;
        e.stopPropagation();
        
        raycaster.setFromCamera(new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        ), camera);

        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, target);
        
        if (groupRef.current && target) {
            groupRef.current.position.x = target.x;
            groupRef.current.position.z = target.z;
        }
    };

    const handlePointerUp = (e: any) => {
        e.stopPropagation();
        if (dragging) {
            setDragging(false);
            onDragEnd();
            (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
            
            if (groupRef.current && tipRef.current) {
                const tipPos = new THREE.Vector3();
                tipRef.current.getWorldPosition(tipPos);
                onCut(tipPos);
            }
        }
    };

    return (
        <group 
            ref={groupRef}
            position={position}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onContextMenu={(e) => { e.stopPropagation(); e.nativeEvent.preventDefault(); }}
        >
            <animated.group rotation-y={Math.PI/2} rotation-x={rotationX as any}>
                {/* Visual Hint for Rotation */}
                {!dragging && (
                     <group position={[0, 0.8, 0]} rotation={[0, -Math.PI/2, 0]}>
                         <mesh>
                             <ringGeometry args={[0.3, 0.35, 32, 1, 0, Math.PI * 1.5]} />
                             <meshBasicMaterial color="white" opacity={0.6} transparent side={THREE.DoubleSide} />
                         </mesh>
                         <mesh position={[0.25, 0.25, 0]}>
                             <coneGeometry args={[0.08, 0.2, 8]} />
                             <meshBasicMaterial color="white" opacity={0.8} transparent />
                         </mesh>
                     </group>
                )}

                {/* Body */}
                <mesh position={[0, 0.2, 0]} castShadow>
                    <boxGeometry args={[0.8, 0.4, 0.4]} />
                    <meshStandardMaterial color="#f97316" />
                </mesh>
                {/* Handle Top */}
                <mesh position={[0, 0.5, 0]}>
                    <torusGeometry args={[0.3, 0.05, 8, 16, Math.PI]} />
                    <meshStandardMaterial color="#1f2937" />
                </mesh>
                {/* Blade */}
                <mesh position={[0.8, 0.1, 0]} castShadow>
                    <boxGeometry args={[1.2, 0.15, 0.05]} />
                    <meshStandardMaterial color="#9ca3af" metalness={0.8} />
                </mesh>
                {/* Teeth Visual */}
                <mesh position={[0.8, 0.18, 0]}>
                     <boxGeometry args={[1.2, 0.02, 0.06]} />
                     <meshBasicMaterial color="#374151" />
                </mesh>
                {/* Blade Tip Helper for Collision */}
                <group ref={tipRef} position={[1.4, 0.1, 0]} />
                
                {dragging && (
                     <group position={[1.4, 0.1, 0]}>
                        <pointLight color="#fbbf24" intensity={2} distance={1} decay={2} />
                     </group>
                )}
            </animated.group>
        </group>
    );
};