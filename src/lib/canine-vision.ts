// Canine vision simulation based on actual dog cone fundamentals
// Dogs have dichromatic vision with two cone types:
// - S-cones (short wavelength, peak ~440nm, similar to human blue)
// - L-cones (long wavelength, peak ~555nm, between human green/red)
// - Rod cells (peak ~498nm) contribute to scotopic vision
// 
// Sources:
// - Neitz, J., Geist, T., & Jacobs, G.H. (1989). Color vision in the dog. Visual Neuroscience, 3(2), 119-125.
// - Miller, P.E., & Murphy, C.J. (1995). Vision in dogs. Journal of the American Veterinary Medical Association, 207(12), 1623-1634.
// - Hunt, D.M., et al. (2009). The evolution of mammalian photopigments. Progress in Retinal and Eye Research, 28(6), 464-482.

// Canine cone spectral sensitivities approximated for sRGB conversion
// This matrix transforms sRGB to approximate canine LMS (Long-Short) space
// Note: These are simplified approximations. For maximum accuracy, future versions
// could use precise spectral sensitivity curves with multispectral image data.
const canineVisionMatrix = [
  // Dog S-cone response (blue-like, ~440nm peak)
  [0.05, 0.22, 0.73],
  // Dog L-cone response (yellow-green, ~555nm peak) 
  [0.68, 0.32, 0.00],
  // Luminance for rod contribution (scotopic, ~498nm peak)
  [0.30, 0.59, 0.11]
];

// Helper function to clamp a value between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyCanineVisionFilter(imageData: ImageData): ImageData {
  const data = imageData.data;
  const newImageData = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
  const newData = newImageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Convert from gamma-corrected sRGB to linear RGB for more accurate processing
    const r = Math.pow(data[i] / 255, 2.2);
    const g = Math.pow(data[i + 1] / 255, 2.2);
    const b = Math.pow(data[i + 2] / 255, 2.2);

    // Apply canine vision transformation to get dog cone responses
    const dogS = canineVisionMatrix[0][0] * r + canineVisionMatrix[0][1] * g + canineVisionMatrix[0][2] * b;
    const dogL = canineVisionMatrix[1][0] * r + canineVisionMatrix[1][1] * g + canineVisionMatrix[1][2] * b;
    const rodResponse = canineVisionMatrix[2][0] * r + canineVisionMatrix[2][1] * g + canineVisionMatrix[2][2] * b;

    // Dogs see a world dominated by blue/yellow distinction
    // Map dog cone responses back to human-visible RGB approximation
    // Blue-yellow axis is primary, with reduced red-green discrimination
    let newR = dogL * 0.8 + dogS * 0.1;  // Mostly from L-cone, appears yellowish
    let newG = dogL * 0.6 + dogS * 0.3;  // Mix of both, appears yellow-green
    let newB = dogS * 0.9 + dogL * 0.0;  // Mostly from S-cone, appears blue

    // Add rod contribution for darker regions (scotopic vision)
    const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
    if (luminance < 0.3) {
      const rodContribution = Math.min(0.4, (0.3 - luminance) * 1.3);
      const rodColor = rodResponse * 0.7; // Rods contribute blue-green tint
      newR = newR * (1 - rodContribution) + rodColor * rodContribution;
      newG = newG * (1 - rodContribution) + rodColor * rodContribution * 1.2;
      newB = newB * (1 - rodContribution) + rodColor * rodContribution * 1.1;
    }

    // Convert back to gamma-corrected RGB and clamp to valid range
    newData[i] = clamp(Math.pow(newR, 1/2.2) * 255, 0, 255);
    newData[i + 1] = clamp(Math.pow(newG, 1/2.2) * 255, 0, 255);
    newData[i + 2] = clamp(Math.pow(newB, 1/2.2) * 255, 0, 255);
    // Alpha channel remains unchanged
  }

  return newImageData;
}

// Backward compatibility alias - maintains existing API
export const applyDeuteranopiaFilter = applyCanineVisionFilter;
