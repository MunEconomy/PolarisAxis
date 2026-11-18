import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './BrandStory.css';

const headlines = ['THE STORY IN BRAND.', 'BRAND IN DESIGN.'];
const headlineLength = headlines[0].length + headlines[1].length;

const storyLines = [
  'STORY BECOMES BRAND WHEN IT FINDS A FIXED',
  'POINT THAT DOES NOT MOVE. BRAND BECOMES',
  'DESIGN WHEN THAT POINT STARTS MOVING',
  'FORWARD, WITHOUT EVER LOSING ITS PLACE.',
  'POLARIS AXIS IS BOTH, HELD AND IN MOTION.',
];

export function BrandStory() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const storyRef = useRef<HTMLParagraphElement>(null);
  const [typedCount, setTypedCount] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);

  useLayoutEffect(() => {
    const story = storyRef.current;
    if (!story) return;
    let mounted = true;
    const words = Array.from(story.querySelectorAll<HTMLElement>('.brand-story__word'));
    const measureLines = () => {
      // Words sharing a rendered line move together, including mobile wrapping.
      const tops = words.map(word => word.offsetTop);
      let line = 0;
      tops.forEach((top, index) => {
        if (index > 0 && Math.abs(top - tops[index - 1]) > 1) line += 1;
        words[index].style.setProperty('--story-line', String(line));
      });
    };
    measureLines();
    const resizeObserver = new ResizeObserver(measureLines);
    resizeObserver.observe(story);
    document.fonts.ready.then(() => { if (mounted) measureLines(); });
    return () => {
      mounted = false;
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: number | undefined;
    let observer: IntersectionObserver | undefined;
    let started = false;
    let written = 0;
    const text = headlines.join('');

    const finish = () => {
      window.clearTimeout(timer);
      started = true;
      written = headlineLength;
      setTypedCount(headlineLength);
      setHasEntered(true);
      observer?.disconnect();
    };
    const typeNext = () => {
      written += 1;
      setTypedCount(written);
      if (written === headlineLength) return;
      const delay = written === headlines[0].length ? 420
        : text[written - 1] === ' ' ? 45 : 65 + (written % 4) * 12;
      timer = window.setTimeout(typeNext, delay);
    };
    const onMotionChange = () => { if (motion.matches) finish(); };

    if (motion.matches || !('IntersectionObserver' in window)) {
      finish();
    } else {
      observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting || started) return;
        started = true;
        observer?.disconnect();
        setHasEntered(true);
        timer = window.setTimeout(typeNext, 160);
      }, { threshold: .35, rootMargin: '0px 0px -8% 0px' });
      observer.observe(title);
    }
    motion.addEventListener('change', onMotionChange);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      motion.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <section className="brand-story" aria-labelledby="brand-story-title">
      <h2 ref={titleRef} className="brand-story__title" id="brand-story-title" lang="en" aria-label={headlines.join(' ')}>
        {headlines.map((line, lineIndex) => (
          <span className="brand-story__title-line" data-node-id={lineIndex === 0 ? '1:270' : '1:271'} aria-hidden="true" key={line}>
            {Array.from(line).map((letter, index) => {
              const position = index + (lineIndex === 0 ? 0 : headlines[0].length);
              const active = position === typedCount - 1 && typedCount < headlineLength;
              return (
                <span className={`brand-story__letter${active ? ' brand-story__letter--active' : ''}`}
                  style={{ visibility: position < typedCount ? 'visible' : 'hidden' }} key={index}>
                  {letter}
                </span>
              );
            })}
          </span>
        ))}
      </h2>
      <div className="brand-story__copy">
        <p ref={storyRef} className={`brand-story__english${hasEntered ? ' brand-story__english--entered' : ''}`} lang="en" data-node-id="1:272">
          {storyLines.map((line, index) => (
            <Fragment key={line}>
              {index > 0 && ' '}
              <span className="brand-story__copy-line">
                {line.split(' ').map((word, wordIndex) => (
                  <Fragment key={wordIndex}>
                    {wordIndex > 0 && ' '}
                    <span className="brand-story__word">{word}</span>
                  </Fragment>
                ))}
              </span>
            </Fragment>
          ))}
        </p>
        <div className="brand-story__korean" lang="ko">
          <p data-node-id="1:275">이야기는 흔들리지 않는 기준을 찾을 때 그 방향이 브랜드가 됩니다.</p>
          <p data-node-id="1:274">그 기준이 자리를 잃지 않은 채 앞으로 나아갈 때 브랜드는 디자인이 됩니다.</p>
          <p data-node-id="1:273">POLARIS AXIS는 방향이 시작되는 지점이자 그 방향이 실제로 나아가는 길입니다.</p>
        </div>
      </div>
    </section>
  );
}
