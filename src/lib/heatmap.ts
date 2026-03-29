import { RouterNode } from './gemini';

export function drawHeatmap(
  canvas: HTMLCanvasElement,
  imageElement: HTMLImageElement | null,
  routers: RouterNode[],
  widthMeters: number = 10
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 200;
  let height = 150;

  if (imageElement && imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0) {
    const aspect = imageElement.naturalWidth / imageElement.naturalHeight;
    height = Math.round(width / aspect);
  }

  canvas.width = width;
  canvas.height = height;

  const costMap = new Float32Array(width * height);
  costMap.fill(1.0); // Default open space cost

  // Read image pixels to detect walls (dark areas)
  if (imageElement && imageElement.complete && imageElement.naturalWidth > 0) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (tCtx) {
      tCtx.drawImage(imageElement, 0, 0, width, height);
      const imgData = tCtx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < width * height; i++) {
        const r = imgData[i * 4];
        const g = imgData[i * 4 + 1];
        const b = imgData[i * 4 + 2];
        const brightness = (r + g + b) / 3;
        // Dark pixels are walls.
        if (brightness < 120) {
          costMap[i] = 12.0; // High cost for walls (strong attenuation)
        } else if (brightness < 220) {
          costMap[i] = 2.5; // Medium cost for furniture/grey areas
        } else {
          costMap[i] = 1.0; // Open space
        }
      }
    }
  }

  const signalMap = new Float32Array(width * height);
  const metersPerPixel = widthMeters / width;

  for (const router of routers) {
    const rx = Math.floor((router.x / 100) * width);
    const ry = Math.floor((router.y / 100) * height);

    let power = 100;
    let coverageMeters = 14; // standard (increased to extend weak signal area)
    if (router.type === 'high-power') coverageMeters = 20;
    if (router.type === 'mesh') coverageMeters = 10;

    // Signal drop per meter
    const dropPerMeter = power / coverageMeters;
    const baseDropPerPixel = dropPerMeter * metersPerPixel;

    const tempSignal = new Float32Array(width * height);
    const inQueue = new Uint8Array(width * height);
    const queue: number[] = [];

    const startIndex = ry * width + rx;
    if (startIndex >= 0 && startIndex < width * height) {
        tempSignal[startIndex] = power;
        queue.push(startIndex);
        inQueue[startIndex] = 1;
    }

    let head = 0;
    const dirs = [-1, 1, -width, width, -width-1, -width+1, width-1, width+1];
    const dists = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];

    // SPFA Algorithm for signal propagation
    while (head < queue.length) {
      const currIdx = queue[head++];
      inQueue[currIdx] = 0;

      const cx = currIdx % width;
      const cy = Math.floor(currIdx / width);
      const currentSignal = tempSignal[currIdx];

      for (let i = 0; i < 8; i++) {
        const nx = cx + (dirs[i] === -1 || dirs[i] === -width-1 || dirs[i] === width-1 ? -1 : dirs[i] === 1 || dirs[i] === -width+1 || dirs[i] === width+1 ? 1 : 0);
        const ny = cy + (dirs[i] < -1 ? -1 : dirs[i] > 1 ? 1 : 0);

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          const drop = dists[i] * costMap[nIdx] * baseDropPerPixel;
          const newSignal = currentSignal - drop;

          if (newSignal > 0 && newSignal > tempSignal[nIdx]) {
            tempSignal[nIdx] = newSignal;
            if (!inQueue[nIdx]) {
              queue.push(nIdx);
              inQueue[nIdx] = 1;
            }
          }
        }
      }
    }

    // Combine signals (take max)
    for (let i = 0; i < width * height; i++) {
       signalMap[i] = Math.max(signalMap[i], tempSignal[i]);
    }
  }

  const outImageData = ctx.createImageData(width, height);
  const outData = outImageData.data;

  for (let i = 0; i < width * height; i++) {
    const sig = signalMap[i] / 100;
    let r = 0, g = 0, b = 0, a = 0;

    if (sig > 0) {
      a = 220;
      if (sig < 0.1) {
        const t = sig / 0.1;
        r = 128 * t; g = 0; b = 128 * t; a = 220 * t; // Transparent to Purple
      } else if (sig < 0.2) {
        const t = (sig - 0.1) / 0.1;
        r = 128 * (1 - t); g = 0; b = 128 + 127 * t; // Purple to Blue
      } else if (sig < 0.4) {
        const t = (sig - 0.2) / 0.2;
        r = 0; g = 255 * t; b = 255; // Blue to Cyan
      } else if (sig < 0.6) {
        const t = (sig - 0.4) / 0.2;
        r = 0; g = 255; b = 255 * (1 - t); // Cyan to Green
      } else if (sig < 0.7) {
        const t = (sig - 0.6) / 0.1;
        r = 255 * t; g = 255; b = 0; // Green to Yellow
      } else {
        const t = Math.min(1, (sig - 0.7) / 0.3);
        r = 255; g = 255 * (1 - t); b = 0; // Yellow to Red
      }
    }

    outData[i * 4] = r;
    outData[i * 4 + 1] = g;
    outData[i * 4 + 2] = b;
    outData[i * 4 + 3] = a;
  }

  ctx.putImageData(outImageData, 0, 0);
}
