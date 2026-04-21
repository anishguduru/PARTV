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
      <div className="space-y-3">
        <p>
          <strong>PARTV</strong> (Pathfinding Algorithm RealTime Visualizer) allows you to see how famous algorithms navigate real-world road networks.
        </p>
        <p>
          We use live <strong>OpenStreetMap</strong> data to build a routable graph of any location you choose.
        </p>
      </div>
    )
  },
  {
    title: "2. Finding a Location",
    content: (
      <div className="space-y-3">
        <p>
          Explore the world map by <strong>panning</strong> (clicking and dragging) and <strong>zooming</strong> (using your scroll wheel or pinch-to-zoom).
        </p>
        <p>
          Zoom in until the status in the sidebar confirms the area is small enough to load. Click <strong>Load Roads Here</strong> to download the network data for your current view.
        </p>
      </div>
    )
  },
  {
    title: "3. App Modes (Normal vs Dev)",
    content: (
      <div className="space-y-3">
        <p>
          The app features two distinct modes:
        </p>
        <ul className="list-disc pl-4 space-y-2">
          <li><strong>Normal Mode:</strong> Focuses on interactive visualization. Set points, block roads, and watch the search happen.</li>
          <li><strong>Dev Mode:</strong> Advanced tools for developers to upload custom code and run objective benchmarks.</li>
        </ul>
      </div>
    )
  },
  {
    title: "4. Interaction & Routing",
    content: (
      <div className="space-y-3">
        <p>Select a tool and click/tap the map:</p>
        <ul className="list-disc pl-4 space-y-2">
          <li><span className="font-bold text-green-500">Set Start</span>: Where the path begins.</li>
          <li><span className="font-bold text-red-500">Set Target</span>: Your final destination.</li>
          <li><span className="font-bold text-amber-500">Waypoint</span>: An intermediate stop between start and target.</li>
          <li><span className="font-bold text-orange-500">Block Road</span>: Simulate construction or click an existing blockage to remove it.</li>
        </ul>
      </div>
    )
  },
  {
    title: "5. Custom Algorithms",
    content: (
      <div className="space-y-3">
        <p>
          In <strong>Dev Mode</strong>, you can download the <strong>Custom Script Instructions</strong> to see the API signature.
        </p>
        <p>
          Upload your own <code>.js</code> file to see your logic animated on real maps! You can upload multiple algorithms and select them from the dropdown.
        </p>
      </div>
    )
  },
  {
    title: "6. Benchmarking",
    content: (
      <div className="space-y-3">
        <p>
          Available in <strong>Dev Mode</strong>, the Benchmarking Panel runs thousands of random paths and calculates average <strong>Execution Time</strong>, <strong>Distance</strong>, and <strong>Success Rate</strong> for every algorithm.
        </p>
        <p>
          It's the ultimate way to prove which search strategy is actually the most efficient.
        </p>
      </div>
    )
  },
  {
    title: "7. Animation & Stats",
    content: (
      <div className="space-y-3">
        <p>
          Adjust the <strong>Simulation Speed</strong> to see how the "frontier" expands. Once finished, check the <strong>Results</strong> panel for:
        </p>
        <p className="pl-2">
          • <strong>Distance:</strong> Total path length.<br />
          • <strong>Explored:</strong> Search effort (node count).<br />
          • <strong>Time:</strong> Raw compute latency.
        </p>
        <p className="pt-2">
          You're all set! Close this tutorial to start exploring the world's road networks.
        </p>
      </div>
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
    width: '450px',
    height: '500px',
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
