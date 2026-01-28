import React, { useState, useRef, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCursor, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { GamePhase } from '../types';
import { Clamp, Mallet } from './Tools';
import { RouterTool } from './RouterTool';

interface WoodProjectProps {
  phase: GamePhase;
  progress: number;
  setProgress: (val: number) => void;
  onPhaseComplete: () => void;
  setOrbitEnabled: (enabled: boolean) => void;
  level: number;
}

// --- Configuration ---
const NUM_TAILS = 4;
const BOARD_WIDTH = 2; // Width along X
const BOARD_THICKNESS = 0.4; 
const JOINT_HEIGHT = 0.4;    
const BOARD_LENGTH_B = 3; // Length along Z
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

// --- Particle System Interface ---
interface SawdustSystemHandle {
    spawnBurst: (position: THREE.Vector3) => void;
    clear: () => void;
}

export const WoodProject: React.FC<WoodProjectProps> = ({ phase, progress, setProgress, onPhaseComplete, setOrbitEnabled, level }) => {
  const [hovered, setHover] = useState(false);
  useCursor(hovered);
  const sawdustRef = useRef<SawdustSystemHandle>(null);

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

  // === LEVEL 1: DOVETAIL BOX IMPLEMENTATION ===
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
// LEVEL 2: STOOL PROJECT
// =========================================================

const STOOL_SEAT_RADIUS = 1.2;
const STOOL_SEAT_THICK = 0.3;
const LEG_RADIUS = 0.15;
const LEG_HEIGHT = 2.5;
// Positions for 4 legs (X, Z)
const LEG_POSITIONS = [
    { x: 0.6, z: 0.6 },
    { x: -0.6, z: 0.6 },
    { x: 0.6, z: -0.6 },
    { x: -0.6, z: -0.6 },
];

const StoolProject: React.FC<any> = ({ phase, progress, setProgress, onPhaseComplete, setOrbitEnabled, sawdustRef }) => {
    const [holesDrilled, setHolesDrilled] = useState([false, false, false, false]);
    const [legsState, setLegsState] = useState<'hidden' | 'dragging' | 'hammering' | 'done'>('hidden');
    const [hammerTaps, setHammerTaps] = useState(0);
    const legsRef = useRef<THREE.Group>(null);

    // --- Interaction Handlers ---

    // 1. Clamping
    const handleClampClick = () => {
        if (phase === GamePhase.CLAMPING) {
            setProgress(1);
            setTimeout(onPhaseComplete, 600);
        }
    };

    // 2. Cutting (Drilling Holes)
    const handleDrill = (xPos: number) => {
        if (phase !== GamePhase.CUTTING) return;
        
        let changed = false;
        const newHoles = [...holesDrilled];

        LEG_POSITIONS.forEach((leg, idx) => {
            if (!newHoles[idx]) {
                if (Math.abs(xPos - leg.x) < 0.3) {
                     newHoles[idx] = true;
                     changed = true;
                     sawdustRef.current?.spawnBurst(new THREE.Vector3(leg.x, STOOL_SEAT_THICK + 0.1, leg.z));
                }
            }
        });

        if (changed) {
            setHolesDrilled(newHoles);
            if (newHoles.every(h => h)) {
                setTimeout(onPhaseComplete, 500);
            }
        }
    };

    // 3. Assembly (Legs)
    useEffect(() => {
        if (phase === GamePhase.ASSEMBLY) {
            setLegsState('dragging');
            setHammerTaps(0);
        }
    }, [phase]);

    const handleLegDrag = (e: any) => {
        if (legsState !== 'dragging' || !legsRef.current) return;
        e.stopPropagation();
        setOrbitEnabled(false);
        const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const point = new THREE.Vector3();
        e.ray.intersectPlane(dragPlane, point);

        const targetY = 0; // Seat bottom
        const stopY = targetY + 0.5; // Gap
        const currentY = Math.max(stopY, Math.min(point.y, 4));
        
        legsRef.current.position.y = currentY;

        if (currentY <= stopY + 0.1) {
            legsRef.current.position.y = stopY;
            setLegsState('hammering');
            setOrbitEnabled(true);
        }
    };

    const handleHammer = () => {
        if (legsState !== 'hammering' || !legsRef.current) return;
        const newTaps = hammerTaps + 1;
        setHammerTaps(newTaps);
        
        const startY = 0.5;
        const endY = 0; // Flush with bottom of seat
        const progress = newTaps / 3;
        
        legsRef.current.position.y = startY - (startY * progress);

        if (newTaps >= 3) {
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
    
    // Position for Stool Hammer: Striking bottom of legs (which are pointing up in this view?)
    // Actually seat is inverted?
    // "Seat (Upside Down for work)" -> Rotated PI X.
    // Legs attached to bottom (now Top).
    // So we are hammering legs DOWN into seat.
    // Target Y = LEG_HEIGHT + Gap.
    // Mallet should strike down.
    
    const hammerPosStool: [number, number, number] = [-1.5, LEG_HEIGHT + 1.8, 0];
    const hammerRotStool: [number, number, number] = [0, 0, -Math.PI/2];

    return (
        <group>
            <SawdustSystem ref={sawdustRef} />

            {/* --- SEAT (Upside Down for work) --- */}
            <group position={[0, STOOL_SEAT_THICK/2, 0]}>
                 <mesh castShadow receiveShadow rotation={[Math.PI, 0, 0]}>
                     <cylinderGeometry args={[STOOL_SEAT_RADIUS, STOOL_SEAT_RADIUS, STOOL_SEAT_THICK, 32]} />
                     <meshStandardMaterial color={COLOR_PINS} roughness={0.6} />
                 </mesh>
                 {/* Holes Visuals */}
                 {LEG_POSITIONS.map((pos, i) => (
                     <group key={i} position={[pos.x, STOOL_SEAT_THICK/2 + 0.01, pos.z]} rotation={[Math.PI/2, 0, 0]}>
                         <mesh visible={holesDrilled[i]}>
                             <circleGeometry args={[LEG_RADIUS]} />
                             <meshStandardMaterial color="#3f2e20" />
                         </mesh>
                         {!holesDrilled[i] && phase === GamePhase.CUTTING && (
                             <mesh>
                                 <ringGeometry args={[LEG_RADIUS, LEG_RADIUS + 0.05]} />
                                 <meshBasicMaterial color="red" />
                             </mesh>
                         )}
                     </group>
                 ))}
            </group>

            {/* --- LEGS --- */}
            {(phase === GamePhase.ASSEMBLY || phase === GamePhase.SUCCESS) && (
                <group 
                    ref={legsRef} 
                    position={[0, 4, 0]} 
                    onPointerDown={handleDragStart}
                    onPointerMove={handleLegDrag}
                    onPointerUp={handleDragEnd}
                >
                    {LEG_POSITIONS.map((pos, i) => (
                         <mesh key={i} position={[pos.x, LEG_HEIGHT/2, pos.z]} castShadow receiveShadow>
                             <cylinderGeometry args={[LEG_RADIUS, LEG_RADIUS * 0.8, LEG_HEIGHT, 16]} />
                             <meshStandardMaterial color={COLOR_TAILS} roughness={0.6} />
                         </mesh>
                    ))}
                    {/* Ghost highlight for dragging */}
                    {legsState === 'dragging' && (
                         <mesh position={[0, LEG_HEIGHT/2, 0]} visible={false}>
                              <boxGeometry args={[3, 3, 3]} /> 
                         </mesh>
                    )}
                </group>
            )}

            {/* --- TOOLS --- */}
            {phase === GamePhase.CLAMPING && (
                <Clamp 
                    position={[1.5, 0, 1.2]} 
                    isClamped={progress === 1} 
                    onClick={handleClampClick} 
                    onPointerOver={() => {}} onPointerOut={() => {}}
                />
            )}

            {phase === GamePhase.CUTTING && (
                <RouterTool 
                    phase={phase}
                    onCut={handleDrill}
                    zBackPosition={0} 
                    onInteractionStart={() => setOrbitEnabled(false)}
                    onInteractionEnd={() => setOrbitEnabled(true)}
                />
            )}

            {legsState === 'hammering' && (
                <Mallet 
                    position={hammerPosStool}
                    rotation={hammerRotStool}
                    onClick={handleHammer}
                />
            )}
        </group>
    );
};

// =========================================================
// LEVEL 1: DOVETAIL BOX (Existing Logic Wrapped)
// =========================================================

const BoxProject: React.FC<any> = (props) => {
    const { phase, progress, setProgress, onPhaseComplete, setOrbitEnabled, sawdustRef } = props;
    
    // ... Copy of the existing state logic from previous WoodProject ...
    const tailBoardARef = useRef<THREE.Group>(null);
    const tailBoardCRef = useRef<THREE.Group>(null);
    const topBoardDRef = useRef<THREE.Group>(null);

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

    const handleCut = (xPos: number) => {
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
        // Reset logic when phase changes
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
        
        // Horizontal orientation: Handle along X, Head along Y (Down).
        // Rot: [0, 0, -Math.PI/2] (Handle +X).
        // Head is at +1.6 X (End of handle). Faces are Up/Down.
        // We want pivot at Left. Head at Center.
        // Board center X=0.
        // Pivot X = -1.6.
        // Height: Above board.
        
        if (phase === GamePhase.ASSEMBLY) {
             // Front Board Top ~ 2.65
             return { pos: [-1.4, 3.8, 0.5], rot: [0, 0, -Math.PI/2] };
        }
        if (phase === GamePhase.ASSEMBLY_C) {
             // Back Board Top ~ 2.65
             return { pos: [-1.4, 3.8, zPosBack - 0.5], rot: [0, 0, -Math.PI/2] };
        }
        if (phase === GamePhase.ASSEMBLY_D) {
             // Top Board Face ~ 5.4
             return { pos: [-1.4, 6.6, 0], rot: [0, 0, -Math.PI/2] };
        }
        return null;
    };
    const hammerConfig = getHammerConfig();

    return (
        <group>
            <SawdustSystem ref={sawdustRef} />
            
            {/* Box Components */}
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
                onPointerDown={(e) => phase === GamePhase.ASSEMBLY && handleAssemblyDragStart(e)}
                onPointerMove={(e) => phase === GamePhase.ASSEMBLY && handleAssemblyDrag(e, tailBoardARef, TABLE_OFFSET)}
                onPointerUp={(e) => phase === GamePhase.ASSEMBLY && handleAssemblyEnd(e)}
                visible={phase !== GamePhase.CLAMPING && phase !== GamePhase.MARKING && phase !== GamePhase.CUTTING}
            >
                <TailBoardMesh />
            </group>

             <group ref={tailBoardCRef} position={[0, 2.5, zPosBack]} 
                onPointerDown={(e) => phase === GamePhase.ASSEMBLY_C && handleAssemblyDragStart(e)}
                onPointerMove={(e) => phase === GamePhase.ASSEMBLY_C && handleAssemblyDrag(e, tailBoardCRef, TABLE_OFFSET)}
                onPointerUp={(e) => phase === GamePhase.ASSEMBLY_C && handleAssemblyEnd(e)}
                visible={[GamePhase.CUTTING_BACK, GamePhase.ASSEMBLY_C, GamePhase.CUTTING_TOP, GamePhase.ASSEMBLY_D, GamePhase.SUCCESS].includes(phase)}
            >
                <TailBoardMesh />
            </group>

             <group ref={topBoardDRef} position={[0, 5, 0]} 
                onPointerDown={(e) => phase === GamePhase.ASSEMBLY_D && handleAssemblyDragStart(e)}
                onPointerMove={(e) => phase === GamePhase.ASSEMBLY_D && handleAssemblyDrag(e, topBoardDRef, yPosTop)}
                onPointerUp={(e) => phase === GamePhase.ASSEMBLY_D && handleAssemblyEnd(e)}
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

            {/* Tools */}
            {phase === GamePhase.CLAMPING && (
                <Clamp position={[1.2, 0.0, 1.0]} isClamped={progress === 1} onClick={handleClampClick} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)} />
            )}
            {hammerConfig && (
                <Mallet position={hammerConfig.pos} rotation={hammerConfig.rot} onClick={() => {
                    if (phase === GamePhase.ASSEMBLY) handleHammerClick(TABLE_OFFSET, tailBoardARef);
                    if (phase === GamePhase.ASSEMBLY_C) handleHammerClick(TABLE_OFFSET, tailBoardCRef);
                    if (phase === GamePhase.ASSEMBLY_D) handleHammerClick(yPosTop, topBoardDRef);
                }} />
            )}
            {(phase === GamePhase.CUTTING || phase === GamePhase.CUTTING_BACK || phase === GamePhase.CUTTING_TOP) && (
                <RouterTool phase={phase} onCut={handleCut} zBackPosition={phase === GamePhase.CUTTING_BACK ? zPosBack : 0} onInteractionStart={() => setOrbitEnabled(false)} onInteractionEnd={() => setOrbitEnabled(true)} />
            )}
        </group>
    );

    function handleAssemblyDragStart(e: any) {
        if (assemblyState !== 'dragging') return;
        e.stopPropagation();
        setOrbitEnabled(false);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    function handleAssemblyEnd(e: any) {
        e.stopPropagation();
        setOrbitEnabled(true);
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
}


// --- Sawdust Physics System ---
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

// --- Geometry Definitions (Box) ---

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

const tailShape = new THREE.Shape();
tailShape.moveTo(-TAIL_WIDTH_TIP/2, JOINT_HEIGHT);
tailShape.lineTo(-TAIL_WIDTH_ROOT/2, 0);
tailShape.lineTo(TAIL_WIDTH_ROOT/2, 0);
tailShape.lineTo(TAIL_WIDTH_TIP/2, JOINT_HEIGHT);
tailShape.lineTo(-TAIL_WIDTH_TIP/2, JOINT_HEIGHT);

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
