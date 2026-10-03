import { useEffect, useRef, useState } from 'react';

export function Navigation() {
  const [hidden, setHidden] = useState(false);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    let previous = Math.max(0, window.scrollY);
    let direction = 0;
    let distance = 0;
    let frame = 0;
    const update = () => {
      frame = 0;
      const current = Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight));
      const delta = current - previous;
      previous = current;
      if (current <= 0) {
        setHidden(false);
        distance = 0;
        direction = 0;
        return;
      }
      if (delta === 0) return;
      const nextDirection = Math.sign(delta);
      if (nextDirection !== direction) distance = 0;
      direction = nextDirection;
      distance += Math.abs(delta);
      if (distance >= 8) {
        setHidden(direction > 0 && !header.current?.contains(document.activeElement));
        distance = 0;
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header ref={header} className={`site-header${hidden ? ' site-header--hidden' : ''}`} onFocusCapture={() => setHidden(false)} data-node-id="1:2">
      <nav aria-label="Main navigation" className="site-nav">
        {['WORK', 'ABOUT', 'CONTACT'].map(label => (
          <a key={label} role="link" tabIndex={0} aria-disabled="true" title="페이지 준비 중">{label}</a>
        ))}
      </nav>
    </header>
  );
}
