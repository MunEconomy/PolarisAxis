import { useEffect, useRef, useState } from 'react';
import { HolographicParticles } from './HolographicParticles';

export function HeroAtmosphere() {
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const visualRef = useRef<HTMLDivElement>(null);
  const playing = !paused && !reducedMotion && inView && pageVisible;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreferenceChange = () => setReducedMotion(preference.matches);
    const onVisibilityChange = () => setPageVisible(!document.hidden);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    if (visualRef.current) observer.observe(visualRef.current);
    preference.addEventListener('change', onPreferenceChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', onPreferenceChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <>
      <div className="hero__visual" ref={visualRef} aria-hidden="true">
        <HolographicParticles paused={!playing} />
      </div>
      {!reducedMotion && (
        <button type="button" className="hero__motion-toggle" onClick={() => setPaused(value => !value)}
          aria-label={paused ? 'Play background motion' : 'Pause background motion'} aria-pressed={paused}>
          <span className={paused ? 'motion-icon motion-icon--play' : 'motion-icon'} aria-hidden="true" />
          {paused ? 'PLAY' : 'PAUSE'}
        </button>
      )}
    </>
  );
}
