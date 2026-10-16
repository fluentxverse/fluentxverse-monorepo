export function getPosterCrop(sourceWidth: number, sourceHeight: number, aspect: number, zoom = 1.12) {
  const sourceAspect = sourceWidth / sourceHeight;
  const width = Math.min(1, aspect / sourceAspect) / zoom;
  const height = Math.min(1, sourceAspect / aspect) / zoom;
  return { width, height, x: (1 - width) / 2, y: (1 - height) / 2 };
}

export function getHeroRenderSize(width: number, height: number, devicePixelRatio: number, maxDimension: number) {
  const requestedScale = Math.min(Math.max(devicePixelRatio, 1.5), 3);
  const pixelBudget = width <= 768 ? 4_000_000 : 9_000_000;
  const scale = Math.min(requestedScale, Math.sqrt(pixelBudget / (width * height)), maxDimension / width, maxDimension / height);
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}
