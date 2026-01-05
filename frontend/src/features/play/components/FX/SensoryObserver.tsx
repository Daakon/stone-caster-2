
import { useEffect, useRef } from 'react';

interface SensoryObserverProps {
    gameState: any; // Weakly typed for Phase 5.5 flexibility
}

export function SensoryObserver({ gameState }: SensoryObserverProps) {
    const prevStamina = useRef<number | null>(null);
    const prevHp = useRef<number | null>(null);

    // Refs for DOM manipulation
    const vignetteRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!gameState?.tier1_mechanical) return;

        const currentStamina = gameState.tier1_mechanical.current_stamina ?? 100;
        const currentHp = gameState.tier1_mechanical.current_hp ?? 100;

        // 1. Impulse: Screen Shake (Stamina Drop > 20)
        // We track the delta.
        if (prevStamina.current !== null) {
            const staminaLoss = prevStamina.current - currentStamina;
            if (staminaLoss > 20) {
                triggerShake();
            }
        }

        // 2. Continuous: Low Health Vignette (HP < 30)
        if (vignetteRef.current) {
            if (currentHp < 30) {
                vignetteRef.current.style.opacity = '1';
                vignetteRef.current.style.animation = 'pulse-red 2s infinite';
            } else {
                vignetteRef.current.style.opacity = '0';
                vignetteRef.current.style.animation = 'none';
            }
        }

        // Update Refs
        prevStamina.current = currentStamina;
        prevHp.current = currentHp;

    }, [gameState]);

    return (
        <>
            {/* VisualFX Styles Injected Locally for self-containment */}
            <style>{`
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        
        .animate-shake {
          animation: shake 0.5s;
          animation-iteration-count: 1;
        }

        .fx-vignette {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 50;
            background: radial-gradient(circle, transparent 50%, rgba(255, 0, 0, 0.4) 100%);
            opacity: 0;
            transition: opacity 1s ease-in-out;
            mix-blend-mode: multiply;
        }
        
        @keyframes pulse-red {
            0% { opacity: 0.5; }
            50% { opacity: 0.8; }
            100% { opacity: 0.5; }
        }
      `}</style>
            <div ref={vignetteRef} className="fx-vignette" />
        </>
    );
}

function triggerShake() {
    // We shake the narrative container only (stabilize HUD)
    const root = document.getElementById('game-narrative-container') || document.body;
    root.classList.remove('animate-shake');
    // Force reflow
    void root.offsetWidth;
    root.classList.add('animate-shake');

    // Cleanup
    setTimeout(() => {
        root.classList.remove('animate-shake');
    }, 550);
}
