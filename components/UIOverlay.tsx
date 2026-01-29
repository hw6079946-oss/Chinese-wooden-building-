import React, { useState, useEffect } from 'react';
import { GamePhase } from '../types';
import { ArrowRight, Hammer, CheckCircle, Package, Trees } from 'lucide-react';

interface UIOverlayProps {
  phase: GamePhase;
  onNext: () => void;
  progress: number;
  level: number;
  inventory: string[];
  rawWoodCount: number;
  onCollect: () => void;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({ phase, onNext, progress, level, inventory, rawWoodCount, onCollect }) => {
  const [showSuccessPrompt, setShowSuccessPrompt] = useState(false);

  useEffect(() => {
    if (phase === GamePhase.SUCCESS) {
      setShowSuccessPrompt(true);
    } else {
      setShowSuccessPrompt(false);
    }
  }, [phase]);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
      {/* Confetti Effect */}
      {phase === GamePhase.SUCCESS && <Confetti />}

      {/* Header */}
      <div className="w-full flex justify-between items-start">
        <div className="bg-white/90 backdrop-blur shadow-lg rounded-2xl p-4 max-w-md border-b-4 border-amber-500">
          <h1 className="text-2xl font-bold text-amber-800 mb-1 flex items-center gap-2">
             <Hammer className="w-6 h-6" /> Dovetail Master <span className="text-sm bg-amber-100 px-2 py-0.5 rounded text-amber-600">Lvl {level}</span>
          </h1>
          <p className="text-slate-600 font-medium">
             {level === 1 ? getBoxInstructions(phase) : getStoolInstructions(phase)}
          </p>
        </div>

        {/* Right Side Panel: Inventory & Raw Materials */}
        <div className="flex flex-col gap-2 items-end">
            {/* Raw Material Panel */}
            {rawWoodCount > 0 && (
                 <div className="bg-white/90 backdrop-blur shadow-lg rounded-2xl p-3 border-b-4 border-green-600 flex flex-col gap-2 min-w-[120px]">
                     <h3 className="text-xs font-bold text-green-800 uppercase tracking-wide flex items-center gap-1">
                        <Trees className="w-4 h-4" /> Raw Material
                     </h3>
                     <div className="flex items-center gap-2">
                         <div className="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center text-lg border border-amber-400">🪵</div>
                         <div className="font-bold text-slate-700 text-lg">
                             +{rawWoodCount}
                         </div>
                     </div>
                 </div>
            )}

            {/* Inventory Widget */}
            {inventory.length > 0 && (
                <div className="bg-white/90 backdrop-blur shadow-lg rounded-2xl p-3 border-b-4 border-blue-500 flex flex-col gap-2">
                    <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide flex items-center gap-1">
                        <Package className="w-4 h-4" /> Inventory
                    </h3>
                    <div className="flex gap-2">
                        {inventory.map((item, i) => (
                            <div key={i} className="w-12 h-12 bg-slate-100 rounded-lg border border-slate-300 flex items-center justify-center text-xs text-center p-1 leading-tight shadow-inner" title={item}>
                                {item.includes("Box") ? "📦" : "🪑"}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Central Instructions / Progress */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center w-full">
         {phase === GamePhase.TIMBER && (
           <div className="bg-black/50 text-white px-4 py-2 rounded-full animate-bounce inline-block">
             Right-click to rotate saw. Drag to cut trees!
           </div>
         )}
         {phase === GamePhase.CLAMPING && (
           <div className="bg-black/50 text-white px-4 py-2 rounded-full animate-bounce inline-block">
             Tap the Clamp to tighten!
           </div>
         )}
         {(phase === GamePhase.CUTTING || phase === GamePhase.CUTTING_BACK || phase === GamePhase.CUTTING_TOP) && (
           <div className="bg-black/50 text-white px-4 py-2 rounded-full inline-block">
             Drag the Router to remove material!
           </div>
         )}
         {(phase === GamePhase.ASSEMBLY || phase === GamePhase.ASSEMBLY_C || phase === GamePhase.ASSEMBLY_D) && (
           <div className="bg-black/50 text-white px-4 py-2 rounded-full inline-block">
             Drag the parts together and use the Mallet!
           </div>
         )}
      </div>

      {/* Footer Controls */}
      <div className={`w-full flex ${phase === GamePhase.SUCCESS ? 'justify-end items-end pr-8 pb-8' : 'justify-center pb-8'} pointer-events-auto`}>
        {phase === GamePhase.INTRO && (
          <button 
            onClick={onNext}
            className="bg-green-500 hover:bg-green-600 text-white text-xl font-bold py-4 px-12 rounded-full shadow-xl transform transition hover:scale-105 border-b-4 border-green-700 active:border-b-0 active:translate-y-1"
          >
            Start Project: {level === 1 ? "Dovetail Box" : "Wooden Stool"}
          </button>
        )}
        
        {phase === GamePhase.SUCCESS && (
          <div className="text-center animate-fade-in-up flex flex-col items-center">
            <div 
              className={`bg-white/95 p-8 rounded-3xl shadow-2xl border-4 border-green-500 mb-6 transition-all duration-700 transform ${showSuccessPrompt ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            >
               <div className="flex justify-center mb-4">
                   <div className="bg-green-100 p-4 rounded-full">
                    <CheckCircle className="w-16 h-16 text-green-600" />
                   </div>
               </div>
               <h2 className="text-3xl font-bold text-green-800 mb-2">Excellent Work!</h2>
               <p className="text-slate-600 mb-6 text-lg">
                   {level === 1 
                    ? "You've mastered the Dovetail Joint." 
                    : "You've built a sturdy Wooden Stool."}
               </p>
               
               <button 
                  onClick={onCollect}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-xl shadow-lg transition flex items-center gap-3 text-lg mx-auto hover:-translate-y-1"
                >
                  <Package className="w-6 h-6" />
                  Collect & {level === 1 ? "Start Level 2" : "Replay"}
                  <ArrowRight className="w-5 h-5" />
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Helpers ---

const getBoxInstructions = (phase: GamePhase) => {
    switch(phase) {
        case GamePhase.INTRO: return "Welcome! Let's build a Dovetail Box.";
        case GamePhase.TIMBER: return "Step 1: Harvest Timber. Cut the trees!";
        case GamePhase.CLAMPING: return "Step 2: Secure the base board.";
        case GamePhase.MARKING: return "Step 3: Mark the tails pattern.";
        case GamePhase.CUTTING: return "Step 4: Cut the sockets for the Front.";
        case GamePhase.ASSEMBLY_PREP: return "Front sockets ready!";
        case GamePhase.ASSEMBLY: return "Step 5: Attach the Front Board.";
        case GamePhase.CUTTING_BACK: return "Step 6: Now cut sockets for the Back.";
        case GamePhase.ASSEMBLY_C: return "Step 7: Attach the Back Board.";
        case GamePhase.CUTTING_TOP: return "Step 8: Prepare the Top Lid.";
        case GamePhase.ASSEMBLY_D: return "Step 9: Cap it off with the Top.";
        case GamePhase.SUCCESS: return "Congratulations! A sturdy box structure.";
        default: return "";
    }
}

const getStoolInstructions = (phase: GamePhase) => {
    switch(phase) {
        case GamePhase.INTRO: return "Level 2: Let's build a Round Stool.";
        case GamePhase.CLAMPING: return "Step 1: Secure the seat block.";
        case GamePhase.CUTTING: return "Step 2: Drill holes for the legs.";
        case GamePhase.ASSEMBLY: return "Step 3: Hammer the legs into place.";
        case GamePhase.SUCCESS: return "Stool Complete!";
        default: return "";
    }
}

// --- Confetti Component ---
const Confetti: React.FC = () => {
    // Generate static array of particles
    const particles = Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100 + '%',
        animDelay: Math.random() * 2 + 's',
        bg: ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'][Math.floor(Math.random() * 5)]
    }));

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-50">
            {particles.map(p => (
                <div 
                    key={p.id}
                    className="absolute w-3 h-3 rounded-sm animate-confetti"
                    style={{
                        left: p.left,
                        top: '-10px',
                        backgroundColor: p.bg,
                        animationDuration: '3s',
                        animationDelay: p.animDelay,
                        animationIterationCount: 'infinite',
                        opacity: 0.8
                    }}
                />
            ))}
            <style>{`
                @keyframes confetti {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
                .animate-confetti {
                    animation-name: confetti;
                    animation-timing-function: linear;
                }
            `}</style>
        </div>
    );
};