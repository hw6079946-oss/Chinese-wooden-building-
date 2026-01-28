import React, { useState, useEffect } from 'react';
import { useSpring, animated, config } from '@react-spring/three';
import '../types';

interface ClampProps {
  position: [number, number, number];
  isClamped: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}

export const Clamp: React.FC<ClampProps> = ({ position, isClamped, onClick, onPointerOver, onPointerOut }) => {
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
      <animated.group position-y={armY} position-x={armLen/2 - barThick/2}>
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
             <animated.mesh position={[0, -0.3, 0]} rotation-y={handleRot}>
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
}

export const Mallet: React.FC<MalletProps> = ({ position, rotation = [0, 0, 0], onClick }) => {
    const [strike, setStrike] = useState(false);
    const [hover, setHover] = useState(false);

    // Animation for striking (Swings in local Z axis)
    // Adjusted: Swing logic for a "Chop" motion
    const { animRot } = useSpring({
        animRot: strike ? [0, 0, -Math.PI / 4] : [0, 0, Math.PI / 6],
        config: { tension: 300, friction: 15 },
        onRest: () => {
            if (strike) setStrike(false);
        }
    });

    const handleClick = (e: any) => {
        e.stopPropagation();
        setStrike(true);
        onClick();
    };

    return (
        <group position={position} rotation={rotation as any}>
             {/* Pivot Group for swing animation (Z-axis rotation) */}
            <animated.group 
                rotation={animRot as any} 
                onClick={handleClick}
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
                    {/* Rotated 90deg Z to align with X-axis (Swing Plane) */}
                    <mesh position={[0, 0.8, 0]} rotation={[0, 0, -Math.PI/2]} castShadow>
                        <cylinderGeometry args={[0.25, 0.25, 0.7]} />
                        <meshStandardMaterial color="#8d6e63" roughness={0.6} />
                    </mesh>

                    {/* Head Faces (Impact zones at +/- X) */}
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
                {hover && (
                    <pointLight position={[0, 1.5, 0]} intensity={1} color="#fbbf24" distance={2} />
                )}
            </animated.group>
            
            {/* Guide arrow/indicator */}
            <mesh position={[0, 2.5, 0]}>
                 <sphereGeometry args={[0.1]} />
                 <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
            </mesh>
        </group>
    );
};
