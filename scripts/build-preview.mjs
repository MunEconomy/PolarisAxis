import { readFile, writeFile } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const source = await readFile(new URL('index.html', dist), 'utf8');
const scriptPath = source.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/)?.[1];
const stylePath = source.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/)?.[1];
if (!scriptPath || !stylePath) throw new Error('Could not find the built script and stylesheet. Run npm run build first.');
let script = await readFile(new URL(scriptPath.replace(/^\//, ''), dist), 'utf8');
let style = await readFile(new URL(stylePath.replace(/^\//, ''), dist), 'utf8');
for (const [path, mime] of [
  ['/assets/hero-particles.png', 'image/png'],
  ['/assets/roboto-serif-italic-variable.ttf', 'font/ttf'],
]) {
  const bytes = await readFile(new URL(path.replace(/^\//, ''), dist));
  const embedded = `data:${mime};base64,${bytes.toString('base64')}`;
  script = script.replaceAll(path, embedded);
  style = style.replaceAll(path, embedded);
}
const html = source
  .replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/, () => `<script type="module">${script.replaceAll('</script', '<\\/script')}</script>`)
  .replace(/<link[^>]+href="[^"]+\.css"[^>]*>/, () => `<style>${style}</style>`);
await writeFile(new URL('../preview.html', import.meta.url), html);
console.log('Created preview.html — open this file directly in Chrome.');
