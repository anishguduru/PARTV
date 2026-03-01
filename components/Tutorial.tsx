import React, { useState, useEffect, useCallback } from 'react';

interface TutorialProps {
  isActive: boolean;
  onClose: () => void;
  darkMode: boolean;
}

interface Step {
  targetId?: string; // If undefined, it's a center modal (intro/outro)
  title: string;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Tutorial.tsx
 * 
 * Provides an interactive onboarding experience.
 * Uses getBoundingClientRect() to highlight specific DOM elements (Control buttons, Map area)
 * by dimming the rest of the screen.
 */

const STEPS: Step[] = [
  {
    title: "Welcome to GeoPath Explorer",
    content: (
      <p>
        This tool allows you to visualize how computer algorithms find paths through real-world road networks.
        <br /><br />
        We use actual <strong>OpenStreetMap</strong> data. Let's take a quick tour of how to use it.
      </p>
    )
  },
  {
    targetId: 'ctrl-load',
    title: "1. Download Roads",
    content: "First, navigate to a location you like! Once you are zoomed in enough (Level 12+), click this button to download the road network for the visible area.",
    position: 'bottom'
  },
  {
    targetId: 'ctrl-algo',
    title: "2. Choose an Algorithm",
    content: (
      <ul className="list-disc pl-4 space-y-1 text-xs">
        <li><strong>Dijkstra:</strong> Guarantees the shortest path. The standard for navigation.</li>
        <li><strong>A*:</strong> Uses heuristics (distance to target) to find the path much faster.</li>
        <li><strong>BFS:</strong> Explores layer by layer (ignoring distance). Good for unweighted graphs.</li>
        <li><strong>DFS:</strong> Explores deep fast. Not optimal for paths, but interesting to watch.</li>
      </ul>
    ),
    position: 'top'
  },
  {
    targetId: 'ctrl-modes',
    title: "3. Interaction Modes",
    content: (
        <div>
            <p className="mb-2 text-xs">Select a tool to interact with the map:</p>
            <ul className="list-disc pl-4 space-y-1 text-xs">
                <li><span className="font-bold text-green-500">Set Start</span>: Where the path begins.</li>
                <li><span className="font-bold text-red-500">Set Target</span>: Where you want to go.</li>
                <li><span className="font-bold text-amber-500">Waypoint</span>: An intermediate stop.</li>
                <li><span className="font-bold text-orange-500">Block Road</span>: Click roads to create obstacles (traffic/construction).</li>
            </ul>
        </div>
    ),
    position: 'top'
  },
  {
    targetId: 'ctrl-speed',
    title: "4. Simulation Speed",
    content: "Control how fast the algorithm executes. Lower speeds help you understand the search pattern; higher speeds are better for long distances.",
    position: 'top'
  },
  {
    targetId: 'ctrl-run',
    title: "5. Visualize!",
    content: "Click 'Visualize Path' to start the animation. The algorithm will begin exploring from the Start Node towards the Target.",
    position: 'top'
  },
  {
    targetId: 'ctrl-stats',
    title: "6. Performance Stats",
    content: "After the path is found, check here to see the total distance, how many nodes were explored, and the actual execution time.",
    position: 'top'
  },
  {
    targetId: 'map-container',
    title: "7. Map Navigation",
    content: "Drag to pan the map. Use the scroll wheel or the +/- buttons in the corner to zoom. Hold 'Ctrl' while scrolling to zoom the page instead of the map.",
    position: 'right'
  }
];

export const Tutorial: React.FC<TutorialProps> = ({ isActive, onClose, darkMode }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const currentStep = STEPS[currentStepIndex];

  // Function to measure the target element relative to the viewport
  const updateRect = useCallback(() => {
    if (currentStep.targetId) {
      const el = document.getElementById(currentStep.targetId);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else {
        // Fallback if element not found (e.g. controls hidden), just center
        setRect(null);
      }
    } else {
      setRect(null);
    }
  }, [currentStep.targetId]);

  // Scroll element into view when step changes
  useEffect(() => {
    if (isActive && currentStep.targetId) {
      // Delay ensures any layout shifts or sidebar open animations (if any) are done
      // and ensures the element exists in DOM before trying to scroll.
      const timer = setTimeout(() => {
          const el = document.getElementById(currentStep.targetId!);
          if (el) {
            // 'center' ensures the element is visible and not stuck behind fixed headers/footers if any
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }, 150); // Increased delay slightly for reliability
      return () => clearTimeout(timer);
    }
  }, [currentStepIndex, isActive, currentStep.targetId]);

  // Recalculate position on resize or scroll to keep highlight accurate
  useEffect(() => {
    if (isActive) {
      updateRect();
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect, true); // Capture scroll on any element
    }
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isActive, updateRect, currentStepIndex]);

  if (!isActive) return null;

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onClose();
      setCurrentStepIndex(0);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // Styles for the card
  const cardClass = darkMode 
    ? "bg-gray-800 text-white border-gray-600" 
    : "bg-white text-gray-900 border-gray-300";

  // Calculate position styles
  let cardStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    width: '320px',
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: '80vh',   // Prevent card from being taller than viewport
    overflowY: 'auto',   // Scroll internally if content is too long
  };

  // Check if target is essentially the full screen (e.g. Map Canvas)
  const isFullScreen = rect && (rect.width > window.innerWidth * 0.9) && (rect.height > window.innerHeight * 0.9);

  if (!rect || isFullScreen) {
    // Center of screen
    cardStyle.top = '50%';
    cardStyle.left = '50%';
    cardStyle.transform = 'translate(-50%, -50%)';
  } else {
    // Smart Positioning Logic
    let pos = currentStep.position || 'bottom';
    
    // Safety thresholds for card size
    // Increased estimate to more aggressively flip positions if space is tight
    const CARD_HEIGHT_ESTIMATE = 320; 
    const spaceTop = rect.top;
    const spaceBottom = window.innerHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = window.innerWidth - rect.right;

    // Auto-flip if not enough space
    if (pos === 'top' && spaceTop < CARD_HEIGHT_ESTIMATE) {
        pos = 'bottom';
    } else if (pos === 'bottom' && spaceBottom < CARD_HEIGHT_ESTIMATE) {
        pos = 'top';
    } else if (pos === 'left' && spaceLeft < 340) {
        pos = 'right';
    } else if (pos === 'right' && spaceRight < 340) {
        pos = 'left';
    }

    const gap = 12;
    
    // Base Positioning
    if (pos === 'bottom') {
        cardStyle.top = rect.bottom + gap;
        cardStyle.left = rect.left + (rect.width / 2) - 160; 
    } else if (pos === 'top') {
        cardStyle.bottom = (window.innerHeight - rect.top) + gap;
        cardStyle.left = rect.left + (rect.width / 2) - 160;
    } else if (pos === 'right') {
        cardStyle.top = rect.top;
        cardStyle.left = rect.right + gap;
    } else if (pos === 'left') {
        cardStyle.top = rect.top;
        cardStyle.right = (window.innerWidth - rect.left) + gap;
    }

    // Horizontal Clamping (Keep card within screen edges)
    // We can't clamp 'right' property easily without reflowing, but we can clamp 'left'
    if (cardStyle.left !== undefined && typeof cardStyle.left === 'number') {
        const minX = 12;
        const maxX = window.innerWidth - 320 - 12; // Width of card - margin
        cardStyle.left = Math.max(minX, Math.min(maxX, cardStyle.left));
    }
  }

  return (
    <div className="fixed inset-0 z-[9000] overflow-hidden pointer-events-none">
       {/* 
          The Backdrop using a massive box-shadow (CSS Hack).
          We use a zero-size div positioned over the target element.
          We give it a box-shadow of 9999px to darken everything *else*.
          pointer-events-none ensures interaction passes through the highlight to the app.
       */}
       <div 
         className="absolute transition-all duration-300 ease-in-out pointer-events-none"
         style={rect ? {
           top: rect.top,
           left: rect.left,
           width: rect.width,
           height: rect.height,
           boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)', // The darkening overlay
           borderRadius: '8px',
         } : {
           top: '50%',
           left: '50%',
           width: 0,
           height: 0,
           boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)'
         }}
       >
          {/* Pulsating ring for attention */}
          {rect && (
             <div className="absolute -inset-1 border-2 border-blue-500 rounded-lg animate-pulse" />
          )}
       </div>

       {/* The Tutorial Card */}
       <div 
          className={`p-5 rounded-xl shadow-2xl border flex flex-col gap-3 transition-all duration-300 pointer-events-auto ${cardClass}`}
          style={cardStyle}
       >
          <div className="flex justify-between items-center mb-1">
             <span className="text-xs font-bold opacity-60 uppercase tracking-widest">Tutorial {currentStepIndex + 1}/{STEPS.length}</span>
             <button onClick={onClose} className="hover:opacity-70 font-bold">✕</button>
          </div>
          
          <h3 className="text-lg font-bold">{currentStep.title}</h3>
          <div className="text-sm leading-relaxed opacity-90">
            {currentStep.content}
          </div>

          <div className="flex justify-between mt-4 pt-3 border-t border-gray-500/20">
             <button 
                onClick={handlePrev} 
                disabled={currentStepIndex === 0}
                className="px-3 py-1.5 rounded text-sm hover:bg-gray-500/20 disabled:opacity-30 transition"
             >
                Back
             </button>
             <button 
                onClick={handleNext}
                className="px-4 py-1.5 rounded text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg"
             >
                {currentStepIndex === STEPS.length - 1 ? "Finish" : "Next"}
             </button>
          </div>
       </div>
    </div>
  );
};