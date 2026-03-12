import React, { useState, useEffect } from 'react';

interface TutorialProps {
  isActive: boolean;
  onClose: () => void;
  darkMode: boolean;
}

interface Step {
  title: string;
  content: React.ReactNode;
}

/**
 * Tutorial.tsx
 * 
 * Provides an interactive onboarding experience.
 */

const STEPS: Step[] = [
  {
    title: "1. Welcome to PARTV",
    content: (
      <p>
        This tool allows you to visualize how computer algorithms find paths through real-world road networks.
        <br /><br />
        We use actual <strong>OpenStreetMap</strong> data. Let's take a quick tour of how to use it.
      </p>
    )
  },
  {
    title: "2. Find & Download Roads",
    content: (
      <p>
        Use the <strong>Find Place</strong> search bar to jump to any city worldwide. 
        <br /><br />
        Once you've found a location, zoom in until the <strong>Current View</strong> status says "Ready to Load", then click <strong>Load Roads Here</strong> to download the road network.
      </p>
    )
  },
  {
    title: "3. Choose an Algorithm",
    content: (
      <ul className="list-disc pl-4 space-y-2">
        <li><strong>Dijkstra:</strong> Guarantees the shortest path. The standard for navigation.</li>
        <li><strong>A*:</strong> Uses heuristics (distance to target) to find the path much faster.</li>
        <li><strong>BFS:</strong> Explores layer by layer (ignoring distance). Good for unweighted graphs.</li>
        <li><strong>DFS:</strong> Explores deep fast. Not optimal for paths, but interesting to watch.</li>
      </ul>
    )
  },
  {
    title: "4. Interaction Modes",
    content: (
        <div>
            <p className="mb-2">Select a tool to interact with the map:</p>
            <ul className="list-disc pl-4 space-y-2">
                <li><span className="font-bold text-green-500">Set Start</span>: Click on the map to set where the path begins.</li>
                <li><span className="font-bold text-red-500">Set Target</span>: Click on the map to set your destination.</li>
                <li><span className="font-bold text-orange-500">Block Road</span>: Click on road segments to create obstacles like traffic or construction.</li>
            </ul>
        </div>
    )
  },
  {
    title: "5. Simulation Speed & Run",
    content: (
      <p>
        Adjust the <strong>Simulation Speed</strong> slider to control how fast the algorithm executes. Lower speeds help you understand the search pattern, while higher speeds are better for long distances.
        <br /><br />
        Click <strong>Visualize Path</strong> to start the animation!
      </p>
    )
  },
  {
    title: "6. Performance Stats",
    content: (
      <p>
        After the path is found, check the stats panel to see:
        <br /><br />
        • <strong>Distance:</strong> Total length of the found path.<br />
        • <strong>Explored:</strong> How many nodes the algorithm visited.<br />
        • <strong>Time:</strong> The actual execution time to calculate the path.
      </p>
    )
  },
  {
    title: "7. Benchmarking",
    content: (
      <p>
        Want to see which algorithm is the best? 
        <br /><br />
        Open the <strong>Benchmarking Panel</strong> on the right side of the screen to run all algorithms simultaneously and compare their performance metrics side-by-side.
      </p>
    )
  },
  {
    title: "8. Map Navigation",
    content: (
      <p>
        • <strong>Pan:</strong> Click and drag to move around the map.<br />
        • <strong>Zoom:</strong> Use your mouse scroll wheel or pinch-to-zoom on touch devices.<br />
        <br />
        You're all set! Close this tutorial to start exploring.
      </p>
    )
  }
];

export const Tutorial: React.FC<TutorialProps> = ({ isActive, onClose, darkMode }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const currentStep = STEPS[currentStepIndex];

  useEffect(() => {
    if (!isActive) {
      setCurrentStepIndex(0);
    }
  }, [isActive]);

  if (!isActive) return null;

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onClose();
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
    height: '380px',
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: '80vh',   // Prevent card from being taller than viewport
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/75 pointer-events-auto">
       {/* The Tutorial Card */}
       <div 
          className={`p-5 rounded-xl shadow-2xl border flex flex-col gap-3 transition-all duration-300 pointer-events-auto ${cardClass}`}
          style={cardStyle}
       >
          <div className="flex justify-between items-center mb-1">
             <span className="text-xs font-bold opacity-60 tracking-widest">Tutorial {currentStepIndex + 1}/{STEPS.length}</span>
             <button onClick={onClose} className="hover:opacity-70 font-bold">✕</button>
          </div>
          
          <h3 className="text-lg font-bold">{currentStep.title}</h3>
          <div className="text-sm leading-relaxed opacity-90 flex-grow overflow-y-auto">
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