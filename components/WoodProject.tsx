import React, { useState, useRef, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCursor, Edges, Html } from '@react-three/drei';
import { useSpring, animated, config } from '@react-spring/three';
import * as THREE from 'three';
import { GamePhase } from '../types';
import { Clamp, Mallet, Chainsaw } from './Tools';
import { RouterTool } from './RouterTool';

interface WoodProjectProps {
  phase: GamePhase;
  progress: number;
  setProgress: (val: number) => void;
  onPhaseComplete: () => void;
  setOrbitEnabled: (enabled: boolean) => void;
  level: number;
  rawWoodCount?: number;
  setRawWoodCount?: (val: number) => void;
}

// Fix for "Type instantiation is excessively deep and possibly infinite" error
const AnimatedGroup = animated.group as any;

// --- Configuration ---
const NUM_TAILS = 4;
const BOARD_WIDTH = 2; 
const BOARD_THICKNESS = 0.4; 
const JOINT_HEIGHT = 0.4;    
const BOARD_LENGTH_B = 3; 
const BOARD_HEIGHT_A = 2.5; 
const TABLE_OFFSET = 0.00;
const GAP_HEIGHT = 0.15;
const HAMMER_TAPS_REQUIRED = 3; 

// --- Geometry Helpers for Box ---
const TOTAL_TAIL_RATIO = 0.65;
const TAIL_WIDTH_TIP = (BOARD_WIDTH * TOTAL_TAIL_RATIO) / NUM_TAILS;
const TAIL_WIDTH_ROOT = TAIL_WIDTH_TIP * 0.55;
const TAIL_CENTERS = (() => {
  const totalTailWidth = TAIL_WIDTH_TIP * NUM_TAILS;
  const remainingWidth = BOARD_WIDTH - totalTailWidth;
  const pinWidth = remainingWidth / (NUM_TAILS + 1);
  const centers: number[] = [];
  const pitch = TAIL_WIDTH_TIP + pinWidth;
  let currentX = -BOARD_WIDTH / 2 + pinWidth + TAIL_WIDTH_TIP / 2;
  for (let i = 0; i < NUM_TAILS; i++) {
    centers.push(currentX);
    currentX += pitch;
  }
  return centers;
})();

const COLOR_PINS = "#c29468"; 
const COLOR_TAILS = "#dcb280"; 
const COLOR_WASTE = "#ef4444"; 
const COLOR_EDGES = "#5c3a21";

interface SawdustSystemHandle {
    spawnBurst: (position: THREE.Vector3) => void;
    clear: () => void;
}

// --- Helper: Generate Tree Ring Texture ---
function createTreeRingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Background (Heartwood)
    ctx.fillStyle = '#6d4c41'; 
    ctx.fillRect(0, 0, 256, 256);

    // Rings
    const centerX = 128;
    const centerY = 128;
    ctx.strokeStyle = '#5d4037'; // Darker ring line
    ctx.lineWidth = 2;

    for (let r = 5; r < 120; r += 4 + Math.random() * 3) {
        ctx.beginPath();
        // Make rings slightly irregular
        for (let a = 0; a <= Math.PI * 2; a += 0.1) {
            const rOffset = r + (Math.sin(a * 10) + Math.cos(a * 5)) * 1.5;
            const x = centerX + Math.cos(a) * rOffset;
            const y = centerY + Math.sin(a) * rOffset;
            if (a === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    }

    // Cracks/Details
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 1;
    for(let i=0; i<5; i++) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        const angle = Math.random() * Math.PI * 2;
        ctx.lineTo(centerX + Math.cos(angle)*100, centerY + Math.sin(angle)*100);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

const treeRingTexture = createTreeRingTexture();


// --- Main Component ---
export const WoodProject: React.FC<WoodProjectProps> = ({ phase, progress, setProgress, onPhaseComplete, setOrbitEnabled, level, rawWoodCount, setRawWoodCount }) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered);
  const sawdustRef = useRef<SawdustSystemHandle>(null);

  // === Timber Stage (Now Shared/Moved to Level 1 Start) ===
  if (phase === GamePhase.TIMBER) {
      return (
          <TimberStage 
            phase={phase}
            onPhaseComplete={onPhaseComplete}
            setOrbitEnabled={setOrbitEnabled}
            sawdustRef={sawdustRef}
            setRawWoodCount={setRawWoodCount}
          />
      );
  }

  // === LEVEL 2: WOODEN STOOL ===
  if (level === 2) {
      return (
          <StoolProject 
            phase={phase} 
            progress={progress} 
            setProgress={setProgress} 
            onPhaseComplete={onPhaseComplete} 
            setOrbitEnabled={setOrbitEnabled}
            sawdustRef={sawdustRef}
          />
      );
  }

  // === LEVEL 1: DOVETAIL BOX (Default) ===
  return (
      <BoxProject 
        phase={phase}
        progress={progress}
        setProgress={setProgress}
        onPhaseComplete={onPhaseComplete}
        setOrbitEnabled={setOrbitEnabled}
        sawdustRef={sawdustRef}
      />
  )
};

// =========================================================
// STAGE: TIMBER
// =========================================================

function TimberStage({ onPhaseComplete, setOrbitEnabled, sawdustRef, setRawWoodCount }: any) {
    const [treesCut, setTreesCut] = useState([false, false]);
    const [cutProgress, setCutProgress] = useState([0, 0]); 
    const [fallRotation, setFallRotation] = useState([0, 0]); 
    const [saplingWarning, setSaplingWarning] = useState<{show: boolean, pos: [number, number, number]}>({show: false, pos: [0,0,0]});

    const trees = useMemo(() => [
        { id: 0, x: -3, z: -2 },
        { id: 1, x: 3, z: 0 },
    ], []);

    const saplings = useMemo(() => [
        { x: -4.5, z: -3 },
        { x: -1.5, z: -1 },
        { x: 4.5, z: 1.5 },
        { x: 1.5, z: 0.5 },
        { x: -2, z: 2 },
    ], []);

    const handleCut = (sawPos: THREE.Vector3) => {
        let changed = false;
        const newProgress = [...cutProgress];
        const newTreesCut = [...treesCut];
        const newFallRotations = [...fallRotation];
        
        // Check saplings first
        let hittingSapling = false;
        for (const sapling of saplings) {
            const dist = new THREE.Vector2(sawPos.x, sawPos.z).distanceTo(new THREE.Vector2(sapling.x, sapling.z));
            if (dist < 0.8 && sawPos.y < 1.5) {
                hittingSapling = true;
                setSaplingWarning({ show: true, pos: [sapling.x, 2, sapling.z] });
                break;
            }
        }
        if (!hittingSapling) {
            setSaplingWarning(prev => prev.show ? { ...prev, show: false } : prev);
        }

        // Check big trees
        trees.forEach((tree, idx) => {
             if (!newTreesCut[idx] && !hittingSapling) {
                 const dist = new THREE.Vector2(sawPos.x, sawPos.z).distanceTo(new THREE.Vector2(tree.x, tree.z));
                 const heightValid = sawPos.y > 0 && sawPos.y < 3;

                 if (dist < 1.2 && heightValid) { 
                     newProgress[idx] = Math.min(100, newProgress[idx] + 2); 
                     changed = true;

                     if (Math.random() > 0.8) {
                        sawdustRef.current?.spawnBurst(new THREE.Vector3(tree.x + (Math.random()-0.5)*0.5, 0.5, tree.z + (Math.random()-0.5)*0.5));
                     }

                     if (newProgress[idx] >= 100) {
                         newTreesCut[idx] = true;
                         const dirX = tree.x - sawPos.x;
                         const dirZ = tree.z - sawPos.z;
                         const angle = Math.atan2(dirX, dirZ);
                         newFallRotations[idx] = angle;
                         setRawWoodCount((prev: number) => prev + 1);
                     }
                 }
             }
        });

        if (changed) {
            setCutProgress(newProgress);
            setTreesCut(newTreesCut);
            setFallRotation(newFallRotations);
            if (newTreesCut.every(t => t)) {
                setTimeout(onPhaseComplete, 3500); // Give time for tree to fall
            }
        }
    };

    return (
        <group>
             <SawdustSystem ref={sawdustRef} />
             
             {/* Ground */}
             <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                 <planeGeometry args={[30, 30]} />
                 <meshStandardMaterial color="#3f6212" roughness={0.9} />
             </mesh>

             {/* Big Trees */}
             {trees.map((t, i) => (
                 <Tree 
                    key={i} 
                    position={[t.x, 0, t.z]} 
                    isCut={treesCut[i]} 
                    progress={cutProgress[i]} 
                    fallRotation={fallRotation[i]}
                 />
             ))}

             {/* Small Saplings */}
             {saplings.map((s, i) => (
                 <Sapling key={i} position={[s.x, 0, s.z]} />
             ))}

             {/* Warning Popup */}
             {saplingWarning.show && (
                 <Html position={saplingWarning.pos as any} center>
                     <div className="bg-red-600/90 text-white px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap shadow-xl border border-red-400 animate-pulse">
                         🚫 Too small! Not ready for harvest.<br/>
                         <span className="text-xs font-normal">不能砍伐还没有到砍伐的时间</span>
                     </div>
                 </Html>
             )}

             <Chainsaw 
                position={[0, 1, 2]} 
                onDragStart={() => setOrbitEnabled(false)}
                onDragEnd={() => setOrbitEnabled(true)}
                onCut={handleCut}
             />
        </group>
    )
}

const Sapling: React.FC<{position: [number, number, number]}> = ({position}) => {
    // Sway animation
    const swayRef = useRef<THREE.Group>(null);
    useFrame(({clock}) => {
        if (swayRef.current) {
            swayRef.current.rotation.z = Math.sin(clock.elapsedTime * 2 + position[0]) * 0.05;
        }
    });

    return (
        <group position={position} ref={swayRef}>
             <mesh position={[0, 0.4, 0]} castShadow>
                 <cylinderGeometry args={[0.05, 0.08, 0.8, 6]} />
                 <meshStandardMaterial color="#5d4037" roughness={0.9} />
             </mesh>
             <mesh position={[0, 1.0, 0]} castShadow>
                 <coneGeometry args={[0.4, 1.2, 8]} />
                 <meshStandardMaterial color="#65a30d" roughness={0.8} />
             </mesh>
             {/* Dirt pile */}
             <mesh position={[0, 0.02, 0]}>
                 <circleGeometry args={[0.3, 8]} />
                 <meshStandardMaterial color="#3e2723" />
             </mesh>
        </group>
    );
};

const Tree: React.FC<{position: [number, number, number], isCut: boolean, progress: number, fallRotation?: number}> = ({ position, isCut, progress, fallRotation = 0 }) => {
    const { rotX } = useSpring({
        rotX: isCut ? Math.PI / 2 + 0.1 : 0, // Fall slightly more than 90 deg to hit ground
        config: { mass: 10, tension: 40, friction: 20 } 
    });

    const groupRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if (progress > 0 && !isCut && groupRef.current) {
             groupRef.current.position.x = Math.sin(state.clock.elapsedTime * 30) * 0.05 * (progress / 100);
        } else if (groupRef.current) {
            groupRef.current.position.x = 0;
        }
    });

    const trunkRadius = 0.5;

    return (
        <group position={position}>
            {/* Trunk Stump (stays) */}
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
                 <cylinderGeometry args={[trunkRadius, trunkRadius * 1.2, 0.4, 16]} />
                 <meshStandardMaterial color="#3e2723" roughness={0.9} />
            </mesh>
            
            {/* Stump Ring Texture (Visible only when cut) */}
            {isCut && (
                <mesh position={[0, 0.401, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
                    <circleGeometry args={[trunkRadius, 32]} />
                    <meshStandardMaterial map={treeRingTexture} color="#d7ccc8" roughness={0.8} />
                </mesh>
            )}

            {/* Cutting Indicator / Progress */}
            {!isCut && (
                <group position={[0, 0.5, 0]} rotation={[-Math.PI/2, 0, 0]}>
                    <ringGeometry args={[trunkRadius + 0.1, trunkRadius + 0.15, 32]} />
                    <meshBasicMaterial color={progress > 0 ? "#fbbf24" : "red"} opacity={0.8} transparent />
                    {progress > 0 && (
                        <mesh position={[0,0,-0.01]} rotation={[0,0,0]}>
                            <ringGeometry args={[trunkRadius + 0.1, trunkRadius + 0.15, 32, 1, 0, (progress/100) * Math.PI * 2]} />
                            <meshBasicMaterial color="#ef4444" toneMapped={false} />
                        </mesh>
                    )}
                </group>
            )}

            {/* Pivot Group for Fall Direction (Y Axis) */}
            <group rotation-y={fallRotation}>
                {/* Falling Part (X Axis Animation) */}
                <AnimatedGroup 
                    ref={groupRef}
                    rotation-x={rotX} 
                    position={[0, 0.2, 0]}
                >
                     {/* Cut Surface on Falling Trunk (Bottom) */}
                     {isCut && (
                        <mesh position={[0, 0.201, 0]} rotation={[Math.PI/2, 0, 0]}>
                            <circleGeometry args={[trunkRadius * 0.95, 32]} />
                            <meshStandardMaterial map={treeRingTexture} color="#d7ccc8" roughness={0.8} />
                        </mesh>
                     )}

                     {/* Main Trunk */}
                     <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
                         <cylinderGeometry args={[trunkRadius * 0.7, trunkRadius, 5, 16]} />
                         <meshStandardMaterial color="#5d4037" roughness={0.9} />
                     </mesh>
                     {/* Leaves */}
                     <group position={[0, 4, 0]}>
                          <mesh position={[0, 0, 0]} castShadow>
                              <coneGeometry args={[2, 4, 8]} />
                              <meshStandardMaterial color="#166534" roughness={0.8} />
                          </mesh>
                          <mesh position={[0, 1.5, 0]} castShadow>
                              <coneGeometry args={[1.5, 3, 8]} />
                              <meshStandardMaterial color="#15803d" roughness={0.8} />
                          </mesh>
                     </group>
                </AnimatedGroup>
            </group>
        </group>
    )
}

// =========================================================
// PROJECT: STOOL (Level 2)
// =========================================================

const STOOL_SEAT_RADIUS = 1.2;
const STOOL_SEAT_THICK = 0.3;
const LEG_RADIUS = 0.12; 
const HOLE_RADIUS = 0.13;
const LEG_HEIGHT = 3.5; 
const LEG_POSITIONS = [
    { x: 0.6, z: 0.6 },
    { x: -0.6, z: 0.6 },
    { x: 0.6, z: -0.6 },
    { x: -0.6, z: -0.6 },
];

function StoolProject({ phase, progress, setProgress, onPhaseComplete, setOrbitEnabled, sawdustRef }: any) {
    const [holesDrilled, setHolesDrilled] = useState([false, false, false, false]);
    const [legsState, setLegsState] = useState<'hidden' | 'dragging' | 'hammering' | 'done'>('hidden');
    const [hammerTaps, setHammerTaps] = useState(0);
    const legsRef = useRef<THREE.Group>(null);

    const { stoolRotation, stoolY } = useSpring({
        stoolRotation: phase === GamePhase.SUCCESS ? [0, 0, 0] : [Math.PI, 0, 0],
        stoolY: phase === GamePhase.SUCCESS ? 3.65 : STOOL_SEAT_THICK / 2, 
        config: { mass: 2, tension: 120, friction: 24 }
    });

    const handleClampClick = () => {
        if (phase === GamePhase.CLAMPING) {
            setProgress(1);
            setTimeout(onPhaseComplete, 600);
        }
    };

    const handleDrill = (toolX: number, toolZ: number) => {
        if (phase !== GamePhase.CUTTING) return;

        let changed = false;
        const newHoles = [...holesDrilled];
        
        LEG_POSITIONS.forEach((leg, idx) => {
            if (!newHoles[idx]) {
                const targetWorldZ = -leg.z; 
                const targetWorldX = leg.x;

                const dist = Math.sqrt(Math.pow(toolX - targetWorldX, 2) + Math.pow(toolZ - targetWorldZ, 2));
                
                if (dist < 0.25) {
                     newHoles[idx] = true;
                     changed = true;
                     sawdustRef.current?.spawnBurst(new THREE.Vector3(targetWorldX, 0.3, targetWorldZ));
                }
            }
        });

        if (changed) {
            setHolesDrilled(newHoles);
            if (newHoles.every(h => h)) {
                setTimeout(onPhaseComplete, 800);
            }
        }
    };

    useEffect(() => {
        if (phase === GamePhase.ASSEMBLY) {
            setLegsState('dragging');
            setHammerTaps(0);
        }
    }, [phase]);

    // Legs insertion logic
    const handleLegDrag = (e: any) => {
        if (legsState !== 'dragging' || !legsRef.current) return;
        e.stopPropagation();
        setOrbitEnabled(false);
        const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); 
        const point = new THREE.Vector3();
        e.ray.intersectPlane(dragPlane, point);

        const worldMaxY = 5.0; 
        const worldMinY = 0.5;
        const clampedWorldY = Math.max(worldMinY, Math.min(point.y, worldMaxY));
        
        legsRef.current.position.y = -clampedWorldY;

        if (clampedWorldY <= worldMinY + 0.1) {
            legsRef.current.position.y = -worldMinY; // Lock position
            setLegsState('hammering');
            setOrbitEnabled(true);
        }
    };

    const handleHammer = () => {
        if (legsState !== 'hammering' || !legsRef.current) return;
        const newTaps = hammerTaps + 1;
        setHammerTaps(newTaps);
        
        // World Y targets
        const startWorldY = 0.5;
        const endWorldY = 0.05; 
        const progress = newTaps / HAMMER_TAPS_REQUIRED;
        const currentWorldY = startWorldY - ((startWorldY - endWorldY) * progress);
        
        legsRef.current.position.y = -currentWorldY; // Inverted local

        if (newTaps >= HAMMER_TAPS_REQUIRED) {
            setLegsState('done');
            setTimeout(onPhaseComplete, 600);
        }
    };

    const handleDragStart = (e: any) => {
        if (legsState === 'dragging') {
             e.stopPropagation();
             setOrbitEnabled(false);
             (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }
    };
    const handleDragEnd = (e: any) => {
         e.stopPropagation();
         setOrbitEnabled(true);
         (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    };
    
    // Hammer position in World Space
    const hammerPosStool: [number, number, number] = [0, 2.5, 0];

    return (
        <group>
            <SawdustSystem ref={sawdustRef} />

            <AnimatedGroup 
                position-y={stoolY} 
                rotation={stoolRotation}
            >
                {/* SEAT */}
                <group>
                     <mesh castShadow receiveShadow>
                         <cylinderGeometry args={[STOOL_SEAT_RADIUS, STOOL_SEAT_RADIUS, STOOL_SEAT_THICK, 32]} />
                         <meshStandardMaterial color={COLOR_PINS} roughness={0.6} />
                     </mesh>
                     
                     {/* MARKINGS & HOLES on Local -Y face (which is UP when inverted) */}
                     {LEG_POSITIONS.map((pos, i) => (
                         <group 
                            key={i} 
                            position={[pos.x, -STOOL_SEAT_THICK/2 - 0.001, pos.z]} 
                            rotation={[Math.PI/2, 0, 0]} // Face -Y
                        >
                             
                             {/* Red Ring Marker */}
                             {!holesDrilled[i] && phase === GamePhase.CUTTING && (
                                 <mesh>
                                     <ringGeometry args={[HOLE_RADIUS, HOLE_RADIUS + 0.03, 32]} />
                                     <meshBasicMaterial color="red" side={THREE.DoubleSide} toneMapped={false} />
                                 </mesh>
                             )}

                             {/* Blind Hole Visual */}
                             {holesDrilled[i] && (
                                 <group>
                                     <mesh position={[0, 0, 0.01]}> 
                                         <circleGeometry args={[HOLE_RADIUS, 32]} />
                                         <meshStandardMaterial color="#1a1a1a" roughness={1} />
                                     </mesh>
                                     {/* Inner walls simulation */}
                                     <mesh position={[0, 0, -0.1]}>
                                         <cylinderGeometry args={[HOLE_RADIUS, HOLE_RADIUS, 0.2, 32, 1, true]} />
                                         <meshStandardMaterial color="#3f2e20" side={THREE.BackSide} />
                                     </mesh>
                                 </group>
                             )}
                         </group>
                     ))}
                </group>

                {/* LEGS */}
                {(phase === GamePhase.ASSEMBLY || phase === GamePhase.SUCCESS) && (
                    <group 
                        ref={legsRef} 
                        position={[0, -4, 0]} // Start at World Y=4 (Local -4)
                        onPointerDown={handleDragStart}
                        onPointerMove={handleLegDrag}
                        onPointerUp={handleDragEnd}
                    >
                        {LEG_POSITIONS.map((pos, i) => (
                             <group key={i} position={[pos.x, 0, pos.z]}>
                                 {/* Leg extending "down" in local space (which is UP in inverted world) */}
                                 <mesh position={[0, -LEG_HEIGHT/2, 0]} castShadow receiveShadow>
                                     <cylinderGeometry args={[LEG_RADIUS, LEG_RADIUS * 0.8, LEG_HEIGHT, 16]} />
                                     <meshStandardMaterial color={COLOR_TAILS} roughness={0.6} />
                                 </mesh>
                             </group>
                        ))}
                        
                        {legsState === 'dragging' && (
                             <mesh position={[0, -1, 0]} visible={false}>
                                  <boxGeometry args={[4, 4, 4]} /> 
                             </mesh>
                        )}
                    </group>
                )}
            </AnimatedGroup>

            {/* --- TOOLS --- */}
            
            {phase === GamePhase.CLAMPING && (
                <Clamp 
                    position={[1.8, 0, 1.2]} 
                    isClamped={progress === 1} 
                    onClick={handleClampClick} 
                    onPointerOver={() => {}} onPointerOut={() => {}}
                />
            )}

            {phase === GamePhase.CUTTING && (
                <RouterTool 
                    phase={phase}
                    variant="drill"
                    onCut={handleDrill} 
                    zBackPosition={0} 
                    onInteractionStart={() => setOrbitEnabled(false)}
                    onInteractionEnd={() => setOrbitEnabled(true)}
                />
            )}

            {legsState === 'hammering' && (
                <Mallet 
                    position={hammerPosStool}
                    rotation={[0, 0, -Math.PI/2]}
                    onClick={handleHammer}
                    onDragStart={() => setOrbitEnabled(false)}
                    onDragEnd={() => setOrbitEnabled(true)}
                />
            )}
        </group>
    );
}

// =========================================================
// PROJECT: DOVETAIL BOX (Level 1)
// =========================================================

function BoxProject(props: any) {
    const { phase, progress, setProgress, onPhaseComplete, setOrbitEnabled, sawdustRef } = props;
    
    // Refs
    const tailBoardARef = useRef<THREE.Group>(null);
    const tailBoardCRef = useRef<THREE.Group>(null);
    const topBoardDRef = useRef<THREE.Group>(null);

    // State
    const [wastesCutBFront, setWastesCutBFront] = useState<boolean[]>(() => new Array(NUM_TAILS).fill(false));
    const [wastesCutBBack, setWastesCutBBack] = useState<boolean[]>(() => new Array(NUM_TAILS).fill(false));
    const [wastesCutD, setWastesCutD] = useState<boolean[]>(() => new Array(NUM_TAILS).fill(false));
    const [assemblyState, setAssemblyState] = useState<'dragging' | 'hammering' | 'done'>('dragging');
    const [hammerTaps, setHammerTaps] = useState(0);
    const [hovered, setHover] = useState(false);
    useCursor(hovered);

    const handleClampClick = () => {
        if (phase === GamePhase.CLAMPING) {
            setProgress(1);
            setTimeout(onPhaseComplete, 600);
        }
    };

    const handleCut = (xPos: number, zPos: number) => {
        const threshold = TAIL_WIDTH_TIP / 1.5;
        let targetState: boolean[] = [];
        let setTargetState: React.Dispatch<React.SetStateAction<boolean[]>> = () => {};
        let isCutting = false;

        if (phase === GamePhase.CUTTING) {
            targetState = wastesCutBFront;
            setTargetState = setWastesCutBFront;
            isCutting = true;
        } else if (phase === GamePhase.CUTTING_BACK) {
            targetState = wastesCutBBack;
            setTargetState = setWastesCutBBack;
            isCutting = true;
        } else if (phase === GamePhase.CUTTING_TOP) {
            targetState = wastesCutD;
            setTargetState = setWastesCutD;
            isCutting = true;
        }

        if (!isCutting) return;

        const newWastes = [...targetState];
        let changed = false;
        const zBase = (phase === GamePhase.CUTTING_BACK) ? -2.6 : 0;
        const yBase = (phase === GamePhase.CUTTING_TOP) ? 5.4 : 0.4;

        TAIL_CENTERS.forEach((center, index) => {
            if (!newWastes[index] && Math.abs(xPos - center) < threshold) {
                newWastes[index] = true;
                changed = true;
                if (sawdustRef.current) {
                    sawdustRef.current.spawnBurst(new THREE.Vector3(center, yBase, zBase));
                }
            }
        });

        if (changed) {
            setTargetState(newWastes);
            if (newWastes.every(w => w)) {
                onPhaseComplete();
            }
        }
    };

    const handleAssemblyDrag = (event: any, boardRef: React.RefObject<THREE.Group>, targetY: number) => {
        if (assemblyState !== 'dragging') return;
        event.stopPropagation();
        setOrbitEnabled(false);
        const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const point = new THREE.Vector3();
        event.ray.intersectPlane(dragPlane, point);

        if (boardRef.current) {
            const stopY = targetY + GAP_HEIGHT;
            const currentY = Math.max(stopY, Math.min(point.y + 1, targetY + 3)); 
            boardRef.current.position.y = currentY;
            
            if (boardRef.current === tailBoardARef.current) {
                boardRef.current.position.z = 0; boardRef.current.position.x = 0;
            } else if (boardRef.current === tailBoardCRef.current) {
                boardRef.current.position.z = -2.6; boardRef.current.position.x = 0;
            } else if (boardRef.current === topBoardDRef.current) {
                boardRef.current.position.z = 0; boardRef.current.position.x = 0;
            }

            if (currentY <= stopY + 0.05) {
                boardRef.current.position.y = stopY;
                setOrbitEnabled(true);
                setAssemblyState('hammering');
            }
        }
    };

    const handleHammerClick = (targetY: number, boardRef: React.RefObject<THREE.Group>) => {
        if (assemblyState !== 'hammering') return;
        const newTaps = hammerTaps + 1;
        setHammerTaps(newTaps);
        const remainingGap = GAP_HEIGHT * (1 - (newTaps / HAMMER_TAPS_REQUIRED));
        const nextY = targetY + Math.max(0, remainingGap);
        if (boardRef.current) boardRef.current.position.y = nextY;
        if (newTaps >= HAMMER_TAPS_REQUIRED) {
            setAssemblyState('done');
            setTimeout(onPhaseComplete, 500);
        }
    };

    useEffect(() => {
        if (phase === GamePhase.INTRO) {
            setWastesCutBFront(new Array(NUM_TAILS).fill(false));
            setWastesCutBBack(new Array(NUM_TAILS).fill(false));
            setWastesCutD(new Array(NUM_TAILS).fill(false));
            sawdustRef.current?.clear(); 
            if (tailBoardARef.current) tailBoardARef.current.position.set(0, 2.5, 0);
            if (tailBoardCRef.current) tailBoardCRef.current.position.set(0, 2.5, -2.6);
            if (topBoardDRef.current) topBoardDRef.current.position.set(0, 5, 0); 
        }
        if ([GamePhase.ASSEMBLY, GamePhase.ASSEMBLY_C, GamePhase.ASSEMBLY_D].includes(phase)) {
            setAssemblyState('dragging');
            setHammerTaps(0);
        }
        if (phase === GamePhase.ASSEMBLY_PREP) tailBoardARef.current?.position.set(0, 2.5, 0);
        if (phase === GamePhase.CUTTING_BACK) tailBoardCRef.current?.position.set(0, 2.5, -2.6);
        if (phase === GamePhase.CUTTING_TOP) topBoardDRef.current?.position.set(0, 5, 0); 
    }, [phase]);

    const zPosBack = -2.6; 
    const yPosTop = BOARD_HEIGHT_A;
    const showMarksFront = phase === GamePhase.MARKING || phase === GamePhase.CUTTING;
    const showMarksBack = phase === GamePhase.CUTTING_BACK;

    const getHammerConfig = (): {pos: [number, number, number], rot: [number, number, number]} | null => {
        if (assemblyState !== 'hammering') return null;
        if (phase === GamePhase.ASSEMBLY) return { pos: [-1.4, 3.5, 0.5], rot: [0, 0, -Math.PI/2] };
        if (phase === GamePhase.ASSEMBLY_C) return { pos: [-1.4, 3.5, zPosBack - 0.5], rot: [0, 0, -Math.PI/2] };
        if (phase === GamePhase.ASSEMBLY_D) return { pos: [-1.4, 4.0, 0], rot: [0, 0, -Math.PI/2] };
        return null;
    };
    const hammerConfig = getHammerConfig();

    return (
        <group>
            <SawdustSystem ref={sawdustRef} />
            <group position={[0, TABLE_OFFSET, 0]}>
                <PinBoardMesh doubleSided />
                {TAIL_CENTERS.map((center, index) => (
                    <WasteBlock key={`bf-${index}`} position={[center, 0, 0]} visible={!wastesCutBFront[index]} isMarked={showMarksFront} />
                ))}
                {TAIL_CENTERS.map((center, index) => (
                    <WasteBlock key={`bb-${index}`} position={[center, 0, zPosBack]} visible={!wastesCutBBack[index]} isMarked={showMarksBack} />
                ))}
            </group>
            <group ref={tailBoardARef} position={[0, 2.5, 0]} 
                onPointerDown={(e) => phase === GamePhase.ASSEMBLY && handleAssemblyDrag(e, tailBoardARef, TABLE_OFFSET)} // Changed to Drag start logic if needed, or simplified
                onPointerMove={(e) => phase === GamePhase.ASSEMBLY && handleAssemblyDrag(e, tailBoardARef, TABLE_OFFSET)}
                visible={phase !== GamePhase.CLAMPING && phase !== GamePhase.MARKING && phase !== GamePhase.CUTTING}
            >
                <TailBoardMesh />
            </group>
             <group ref={tailBoardCRef} position={[0, 2.5, zPosBack]} 
                onPointerMove={(e) => phase === GamePhase.ASSEMBLY_C && handleAssemblyDrag(e, tailBoardCRef, TABLE_OFFSET)}
                visible={[GamePhase.CUTTING_BACK, GamePhase.ASSEMBLY_C, GamePhase.CUTTING_TOP, GamePhase.ASSEMBLY_D, GamePhase.SUCCESS].includes(phase)}
            >
                <TailBoardMesh />
            </group>
             <group ref={topBoardDRef} position={[0, 5, 0]} 
                onPointerMove={(e) => phase === GamePhase.ASSEMBLY_D && handleAssemblyDrag(e, topBoardDRef, yPosTop)}
                visible={[GamePhase.CUTTING_TOP, GamePhase.ASSEMBLY_D, GamePhase.SUCCESS].includes(phase)}
            >
                 <PinBoardMesh doubleSided />
            </group>
            {phase === GamePhase.CUTTING_TOP && topBoardDRef.current && (
                <group position={[0, 5, 0]}> 
                     {TAIL_CENTERS.map((center, index) => (
                         <group key={`d-${index}`} position={[0, 0, 0]}>
                             <WasteBlock position={[center, 0, 0]} visible={!wastesCutD[index]} isMarked={true} />
                             <WasteBlock position={[center, 0, zPosBack]} visible={!wastesCutD[index]} isMarked={true} />
                         </group>
                     ))}
                </group>
            )}
            {phase === GamePhase.CLAMPING && (
                <Clamp 
                    position={[1.2, 0, -1.1]} // Adjusted position
                    rotation={[0, Math.PI, 0]} // Adjusted rotation
                    isClamped={progress === 1} 
                    onClick={handleClampClick} 
                    onPointerOver={() => setHover(true)} 
                    onPointerOut={() => setHover(false)} 
                />
            )}
            {hammerConfig && (
                <Mallet position={hammerConfig.pos} rotation={hammerConfig.rot} onClick={() => {
                    if (phase === GamePhase.ASSEMBLY) handleHammerClick(TABLE_OFFSET, tailBoardARef);
                    if (phase === GamePhase.ASSEMBLY_C) handleHammerClick(TABLE_OFFSET, tailBoardCRef);
                    if (phase === GamePhase.ASSEMBLY_D) handleHammerClick(yPosTop, topBoardDRef);
                }} 
                onDragStart={() => setOrbitEnabled(false)}
                onDragEnd={() => setOrbitEnabled(true)}
                />
            )}
            {(phase === GamePhase.CUTTING || phase === GamePhase.CUTTING_BACK || phase === GamePhase.CUTTING_TOP) && (
                <RouterTool phase={phase} onCut={handleCut} zBackPosition={phase === GamePhase.CUTTING_BACK ? zPosBack : 0} onInteractionStart={() => setOrbitEnabled(false)} onInteractionEnd={() => setOrbitEnabled(true)} />
            )}
        </group>
    );
}

// =========================================================
// HELPERS & PARTS (Unchanged from original styles)
// =========================================================

const SawdustSystem = forwardRef<SawdustSystemHandle, {}>((props, ref) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 1200; 
    const particles = useRef<Array<{ active: boolean; position: THREE.Vector3; velocity: THREE.Vector3; rotation: THREE.Euler; rotSpeed: THREE.Vector3; scale: number; life: number; isPiled: boolean; }>>([]);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const colors = useMemo(() => [new THREE.Color("#e0c9a6"), new THREE.Color("#c29468"), new THREE.Color("#8B5A2B")], []);

    useMemo(() => {
        particles.current = new Array(count).fill(null).map(() => ({
            active: false,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            rotSpeed: new THREE.Vector3(),
            scale: 1,
            life: 0,
            isPiled: false
        }));
    }, []);

    useImperativeHandle(ref, () => ({
        spawnBurst: (pos: THREE.Vector3) => {
             const burstCount = 60; 
             const duration = 15;
             let iter = 0;
             const interval = setInterval(() => {
                 if (!meshRef.current) { clearInterval(interval); return; }
                 const batch = Math.floor(burstCount / duration);
                 let spawnedInBatch = 0;
                 for (let i = 0; i < count; i++) {
                     if (!particles.current[i].active) {
                        const p = particles.current[i];
                        p.active = true;
                        p.isPiled = false;
                        p.life = 0;
                        p.position.set(pos.x + (Math.random() - 0.5) * 0.1, pos.y + (Math.random() * 0.1), pos.z + (Math.random() - 0.5) * 0.1);
                        const angle = Math.random() * Math.PI * 2;
                        const force = 0.5 + Math.random() * 2.0;
                        p.velocity.set(Math.sin(angle) * force, 2.5 + Math.random() * 3.0, Math.cos(angle) * force);
                        p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                        p.rotSpeed.set((Math.random()-0.5) * 15, (Math.random()-0.5) * 15, (Math.random()-0.5) * 15);
                        p.scale = 0.5 + Math.random() * 0.7; 
                        const color = colors[Math.floor(Math.random() * colors.length)];
                        meshRef.current.setColorAt(i, color);
                        spawnedInBatch++;
                        if (spawnedInBatch >= batch) break;
                     }
                 }
                 meshRef.current.instanceColor!.needsUpdate = true;
                 iter++;
                 if (iter >= duration) clearInterval(interval);
             }, 30); 
        },
        clear: () => {
             particles.current.forEach(p => p.active = false);
             if (meshRef.current) {
                 meshRef.current.count = 0;
                 meshRef.current.instanceMatrix.needsUpdate = true;
             }
        }
    }));

    useFrame((state, delta) => {
        if (!meshRef.current) return;
        const dt = Math.min(delta, 0.1); 
        const gravity = -12; 
        const floorY = 0.01; 
        
        let activeCount = 0;
        for (let i = 0; i < count; i++) {
            const p = particles.current[i];
            if (p.active) {
                if (!p.isPiled) {
                    p.velocity.y += gravity * dt;
                    p.velocity.x *= 0.98; p.velocity.z *= 0.98;
                    p.position.add(p.velocity.clone().multiplyScalar(dt));
                    p.rotation.x += p.rotSpeed.x * dt; p.rotation.y += p.rotSpeed.y * dt; p.rotation.z += p.rotSpeed.z * dt;
                    if (p.position.y <= floorY) {
                        p.position.y = floorY + (Math.random() * 0.04);
                        p.isPiled = true;
                        p.velocity.set(0, 0, 0); 
                        p.rotSpeed.set(0, 0, 0);
                        p.scale *= 0.9; p.rotation.x = Math.PI / 2;
                    }
                }
                dummy.position.copy(p.position);
                dummy.rotation.copy(p.rotation);
                dummy.scale.setScalar(p.scale);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, dummy.matrix);
                activeCount++;
            } else {
                 dummy.position.set(0, -999, 0);
                 dummy.scale.setScalar(0);
                 dummy.updateMatrix();
                 meshRef.current.setMatrixAt(i, dummy.matrix);
            }
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.04, 0]} /> 
            <meshStandardMaterial roughness={0.9} color="#fff" /> 
        </instancedMesh>
    );
});

const extrudeSettingsJoint = { depth: BOARD_THICKNESS, bevelEnabled: false };

const PinBoardMesh: React.FC<{doubleSided?: boolean}> = ({doubleSided = false}) => {
    const { shapesFront, shapesBack } = useMemo(() => {
        const shapesF: THREE.Shape[] = [];
        const shapesB: THREE.Shape[] = [];
        const W = BOARD_WIDTH / 2;
        const H = JOINT_HEIGHT;

        const createPinShape = (xLeftBot: number, xLeftTop: number, xRightTop: number, xRightBot: number) => {
             const s = new THREE.Shape();
             s.moveTo(xLeftBot, 0);
             s.lineTo(xLeftTop, H);
             s.lineTo(xRightTop, H);
             s.lineTo(xRightBot, 0);
             s.lineTo(xLeftBot, 0); 
             return s;
        };

        shapesF.push(createPinShape(-W, -W, TAIL_CENTERS[0] - TAIL_WIDTH_TIP/2, TAIL_CENTERS[0] - TAIL_WIDTH_ROOT/2));
        for (let i = 0; i < NUM_TAILS - 1; i++) {
            shapesF.push(createPinShape(
                TAIL_CENTERS[i] + TAIL_WIDTH_ROOT/2, TAIL_CENTERS[i] + TAIL_WIDTH_TIP/2,
                TAIL_CENTERS[i+1] - TAIL_WIDTH_TIP/2, TAIL_CENTERS[i+1] - TAIL_WIDTH_ROOT/2
            ));
        }
        shapesF.push(createPinShape(TAIL_CENTERS[NUM_TAILS-1] + TAIL_WIDTH_ROOT/2, TAIL_CENTERS[NUM_TAILS-1] + TAIL_WIDTH_TIP/2, W, W));

        if (doubleSided) {
            shapesB.push(...shapesF);
        }

        return { shapesFront: shapesF, shapesBack: shapesB };
    }, [doubleSided]);

    const bodyLength = BOARD_LENGTH_B - (doubleSided ? 0.8 : 0.4);
    
    return (
        <group>
            <mesh receiveShadow castShadow position={[0, 0, 0]}>
                <extrudeGeometry args={[shapesFront, extrudeSettingsJoint]} />
                <meshStandardMaterial color={COLOR_PINS} roughness={0.6} />
                <Edges threshold={20} color={COLOR_EDGES} opacity={0.3} />
            </mesh>

            <mesh receiveShadow castShadow position={[0, JOINT_HEIGHT/2, -bodyLength/2]}>
                 <boxGeometry args={[BOARD_WIDTH, JOINT_HEIGHT, bodyLength]} />
                 <meshStandardMaterial color={COLOR_PINS} roughness={0.6} />
                 <Edges threshold={20} color={COLOR_EDGES} opacity={0.3} />
            </mesh>

            {doubleSided && (
                 <mesh receiveShadow castShadow position={[0, 0, -BOARD_LENGTH_B + 0.4]}>
                    <extrudeGeometry args={[shapesBack, extrudeSettingsJoint]} />
                    <meshStandardMaterial color={COLOR_PINS} roughness={0.6} />
                    <Edges threshold={20} color={COLOR_EDGES} opacity={0.3} />
                </mesh>
            )}
        </group>
    );
};

const tailShape = new THREE.Shape();
tailShape.moveTo(-TAIL_WIDTH_TIP/2, JOINT_HEIGHT);
tailShape.lineTo(-TAIL_WIDTH_ROOT/2, 0);
tailShape.lineTo(TAIL_WIDTH_ROOT/2, 0);
tailShape.lineTo(TAIL_WIDTH_TIP/2, JOINT_HEIGHT);
tailShape.lineTo(-TAIL_WIDTH_TIP/2, JOINT_HEIGHT);

const TailBoardMesh: React.FC = () => {
    const shape = useMemo(() => {
        const s = new THREE.Shape();
        const W = BOARD_WIDTH / 2;
        const JointH = JOINT_HEIGHT; 
        const BodyH = BOARD_HEIGHT_A; 
        const TotalH = JointH + BodyH; 
        const TopJointShoulderY = TotalH - JointH;

        s.moveTo(-W, TopJointShoulderY); 
        s.lineTo(-W, JointH);

        TAIL_CENTERS.forEach(center => {
            s.lineTo(center - TAIL_WIDTH_TIP/2, JointH);
            s.lineTo(center - TAIL_WIDTH_ROOT/2, 0);
            s.lineTo(center + TAIL_WIDTH_ROOT/2, 0);
            s.lineTo(center + TAIL_WIDTH_TIP/2, JointH);
        });

        s.lineTo(W, JointH);
        s.lineTo(W, TopJointShoulderY);

        const reversedCenters = [...TAIL_CENTERS].reverse();
        reversedCenters.forEach(center => {
            s.lineTo(center + TAIL_WIDTH_ROOT/2, TopJointShoulderY);
            s.lineTo(center + TAIL_WIDTH_TIP/2, TotalH);
            s.lineTo(center - TAIL_WIDTH_TIP/2, TotalH);
            s.lineTo(center - TAIL_WIDTH_ROOT/2, TopJointShoulderY);
        });

        s.lineTo(-W, TopJointShoulderY);

        return s;
    }, []);

    return (
        <mesh receiveShadow castShadow>
            <extrudeGeometry args={[shape, extrudeSettingsJoint]} />
            <meshStandardMaterial color={COLOR_TAILS} roughness={0.6} />
            <Edges threshold={20} color={COLOR_EDGES} opacity={0.3} />
        </mesh>
    );
};

const WasteBlock: React.FC<{position: [number, number, number], visible: boolean, isMarked: boolean}> = ({position, visible, isMarked}) => {
    if (!visible) return null;
    const color = isMarked ? COLOR_WASTE : COLOR_PINS; 
    const opacity = isMarked ? 0.8 : 1;
    const emissive = isMarked ? "#991b1b" : "#000000";
    
    return (
        <group position={position}>
             <mesh receiveShadow>
                <extrudeGeometry args={[tailShape, extrudeSettingsJoint]} />
                <meshStandardMaterial 
                    color={color}
                    transparent={isMarked}
                    opacity={opacity}
                    emissive={emissive}
                    roughness={0.6}
                />
             </mesh>
             {isMarked && (
                 <group position={[0, 0, 0.01]}>
                    <lineSegments>
                         <edgesGeometry args={[new THREE.ExtrudeGeometry(tailShape, {depth: 0})]} />
                         <lineBasicMaterial color="red" linewidth={2} />
                    </lineSegments>
                 </group>
             )}
        </group>
    )
}