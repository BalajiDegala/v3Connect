import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DataCenterBackground } from '../components/DataCenterBackground';

export function HomePage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Full screen 3D background */}
      <DataCenterBackground fullScreen />
      
      {/* Overlay content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        {/* Show Connect button only if NOT authenticated */}
        {!isAuthenticated && (
          <button
            onClick={login}
            className="group relative px-16 py-6 text-4xl font-bold transition-all duration-300 
              text-white hover:scale-110 active:scale-95"
            style={{ letterSpacing: '0.3em' }}
          >
            <span className="relative z-10 drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">CONNECT</span>
          </button>
        )}
        
        {/* Title */}
        <style>{`
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .gradient-text {
            background: linear-gradient(90deg, #0b1b2b 0%, #123244 25%, #1b3b59 50%, #2a516f 75%, #3a6a8a 100%);
            background-size: 200% 100%;
            animation: gradientShift 8s ease-in-out infinite;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
          }
        `}</style>

        <h1 className="mt-8 text-8xl font-bold gradient-text" style={{ 
          fontFamily: '"Univers LT Std Light", "Univers Light", "Univers", "Helvetica Neue", "Arial", sans-serif', 
          letterSpacing: '0.4em', 
          /* tightened line-height to compensate for vertical scale */
          lineHeight: '0.85', 
          /* make text bold */
          fontWeight: 700,
          display: 'inline-block',
          /* subtly scale vertically */
          transform: 'scaleY(1.12)',
          transformOrigin: 'center',
          /* keep a very subtle rim for readability */
          textShadow: `
            0 -2px 4px rgba(255, 255, 255, 0.03),
            0 6px 18px rgba(10, 34, 54, 0.12)
          `,
          filter: 'none'
        }}>
          ANKIYA CLOUD
        </h1>
      </div> 
    </div>
  );
}
