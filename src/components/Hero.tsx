import { HeroAtmosphere } from './HeroAtmosphere';

const statements = [
  'TRACES OF A STEADY DIRECTION',
  'THE ONE WHO READS THE STAR',
  'A SIGNAL TOWARD THE FIXED POINT',
];

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title" data-node-id="1:252">
      <HeroAtmosphere />
      <h1 className="hero__title" id="hero-title">
        <span className="hero__polaris" data-node-id="1:256">POLARIS</span>
        <span className="hero__axis" data-node-id="1:257">Axis</span>
      </h1>
      <ol className="hero__statements" aria-label="Design approach">
        {statements.map((statement, index) => (
          <li key={statement}>
            <span className="hero__number" aria-hidden="true">(0{index + 1})</span>
            <span>{statement}</span>
          </li>
        ))}
      </ol>
      <div className="hero__intro">
        <p className="hero__motto" data-node-id="1:258">A FIXED POINT IN<br />A MOVING WORLD.</p>
        <p className="hero__description" data-node-id="1:269">
          <span>UX/UI design, interactive exhibition concepts, brand identity,</span>{' '}
          <span>presentation-driven storytelling, digital media experiments.</span>{' '}
          <span>Steady observer, quiet perfectionist and unwavering</span>{' '}
          <span>direction-seeker these are the core approaches.</span>
        </p>
        <p className="hero__signature" data-node-id="1:268">STEADY<br />AS POLARIS.</p>
      </div>
    </section>
  );
}
