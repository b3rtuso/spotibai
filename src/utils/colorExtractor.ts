export async function extractDominantColor(imageUrl: string): Promise<string> {
  const fallbackColor = '#242424';

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(fallbackColor);

        canvas.width = 40;
        canvas.height = 40;
        ctx.drawImage(img, 0, 0, 40, 40);

        const imageData = ctx.getImageData(0, 0, 40, 40).data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < imageData.length; i += 4) {
          const red = imageData[i];
          const green = imageData[i + 1];
          const blue = imageData[i + 2];

          // Skip near-black and near-white pixels for vibrant tint
          const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
          if (brightness > 25 && brightness < 230) {
            r += red;
            g += green;
            b += blue;
            count++;
          }
        }

        if (count === 0) return resolve(fallbackColor);

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Darken slightly to maintain contrast with white text
        r = Math.min(200, Math.max(30, Math.round(r * 0.8)));
        g = Math.min(200, Math.max(30, Math.round(g * 0.8)));
        b = Math.min(200, Math.max(30, Math.round(b * 0.8)));

        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        resolve(fallbackColor);
      }
    };

    img.onerror = () => resolve(fallbackColor);
    img.src = imageUrl;
  });
}

export function formatTime(seconds: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || isNaN(seconds) || seconds <= 0) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

