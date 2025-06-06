// Deuteranopia (Green-Blind) simulation matrix
// This simulates how dogs see the world, as they have deuteranopia-like vision
// Source: Vienot, F., Brettel, H., Mollon, J. D. (1999).
// Digital video colourmaps for checking the legibility of displays by dichromats.
// Color Research & Application, 24(4), 243-252.
// Corrected for sRGB standard illuminant D65.
const deuteranopiaMatrix = [
  [0.360278, 0.706949, -0.067227],
  [0.278603, 0.673002,  0.048395],
  [-0.012328, 0.042811,  0.969517]
];

// Helper function to clamp a value between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyDeuteranopiaFilter(imageData: ImageData): ImageData {
  const data = imageData.data;
  const newImageData = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
  const newData = newImageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Apply the deuteranopia matrix
    const newR = deuteranopiaMatrix[0][0] * r + deuteranopiaMatrix[0][1] * g + deuteranopiaMatrix[0][2] * b;
    const newG = deuteranopiaMatrix[1][0] * r + deuteranopiaMatrix[1][1] * g + deuteranopiaMatrix[1][2] * b;
    const newB = deuteranopiaMatrix[2][0] * r + deuteranopiaMatrix[2][1] * g + deuteranopiaMatrix[2][2] * b;

    // Store the new RGB values, clamped to [0, 255]
    newData[i] = clamp(newR, 0, 255);
    newData[i + 1] = clamp(newG, 0, 255);
    newData[i + 2] = clamp(newB, 0, 255);
    // Alpha channel (newData[i + 3]) remains unchanged
  }

  return newImageData;
}
