import { useEffect, useState } from 'react';
import appIcon from '@/assets/app-icon.png';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen = ({ onFinish }: SplashScreenProps) => {
  const [screenOpacity, setScreenOpacity] = useState(1);
  const [iconVisible, setIconVisible] = useState(false);
  const [nameVisible, setNameVisible] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);
  const [barVisible, setBarVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setIconVisible(true), 0);
    const t2 = setTimeout(() => setNameVisible(true), 300);
    const t3 = setTimeout(() => setTaglineVisible(true), 500);
    const t4 = setTimeout(() => setBarVisible(true), 600);
    const t5 = setTimeout(() => setScreenOpacity(0), 2000);
    const t6 = setTimeout(() => onFinish(), 2300);

    return () => {
      [t1, t2, t3, t4, t5, t6].forEach(clearTimeout);
    };
  }, [onFinish]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        backgroundColor: '#000000',
        opacity: screenOpacity,
        transition: 'opacity 300ms ease-in',
      }}
    >
      <div className="flex flex-col items-center justify-center w-full h-full">
        <img
          src={appIcon}
          alt="FitLog Tracker"
          className="rounded-3xl"
          style={{
            width: 120,
            height: 120,
            opacity: iconVisible ? 1 : 0,
            transform: iconVisible ? 'scale(1)' : 'scale(0.7)',
            transition: 'opacity 400ms ease-out, transform 400ms ease-out',
            boxShadow: '0 0 40px rgba(34, 197, 94, 0.4), 0 0 80px rgba(168, 85, 247, 0.2)',
          }}
        />
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#ffffff',
            marginTop: 24,
            letterSpacing: '0.5px',
            opacity: nameVisible ? 1 : 0,
            transform: nameVisible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          }}
        >
          FitLog Tracker
        </h1>
        <p
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: '#9ca3af',
            marginTop: 8,
            opacity: taglineVisible ? 1 : 0,
            transition: 'opacity 200ms ease-out',
          }}
        >
          Track. Progress. Achieve.
        </p>
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 160,
          height: 3,
          backgroundColor: '#1f2937',
          borderRadius: 9999,
          overflow: 'hidden',
        }}
      >
        {barVisible && (
          <div
            className="fill-bar"
            style={{
              height: '100%',
              borderRadius: 9999,
              background: 'linear-gradient(to right, #22c55e, #a855f7)',
            }}
          />
        )}
      </div>
    </div>
  );
};

export default SplashScreen;
