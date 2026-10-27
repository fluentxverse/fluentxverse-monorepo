const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export const imageContentIdentity = image => JSON.stringify(canonical({
  os: image.Os, architecture: image.Architecture, rootfs: image.RootFS, config: image.Config,
}));

// Use URL parsing rather than embedding escaped regular expressions in remote JS.
export const screeningStatusProbe = `const r=await fetch(new URL('/v1/screening/prover',process.env.GMR_SCREENING_ENGINE_API_BASE),{
headers:{'X-GMR-Engine-Key':process.env.GMR_SCREENING_ENGINE_API_KEY},signal:AbortSignal.timeout(15000)});
const j=await r.json();console.log(JSON.stringify({http:r.status,ready:j.ready,state:j.state}));`;
