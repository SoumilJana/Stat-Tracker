/**
 * Image processing utilities for StatTracker.
 *
 * Supports independent cropping, resizing, and compression presets:
 * - Portrait: 3:4 ratio, target 600 x 800 px.
 * - Ranking banner: wide horizontal crop (~4:1), target 1200 x 300 px.
 */

export interface ImageCropPreset {
  targetWidth: number;
  targetHeight: number;
  aspectRatio: number; // width / height
  quality?: number; // 0.0 - 1.0 (default 0.85)
}

export const PORTRAIT_PRESET: ImageCropPreset = {
  targetWidth: 600,
  targetHeight: 800,
  aspectRatio: 3 / 4, // 0.75
  quality: 0.85,
};

export const RANKING_BANNER_PRESET: ImageCropPreset = {
  targetWidth: 1200,
  targetHeight: 300,
  aspectRatio: 1200 / 300, // 4.0
  quality: 0.85,
};

export async function processImageFile(
  file: File,
  preset: ImageCropPreset
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image into element'));
      img.onload = () => {
        try {
          const naturalWidth = img.naturalWidth;
          const naturalHeight = img.naturalHeight;
          const currentAspect = naturalWidth / naturalHeight;
          const targetAspect = preset.aspectRatio;

          let cropX = 0;
          let cropY = 0;
          let cropWidth = naturalWidth;
          let cropHeight = naturalHeight;

          if (currentAspect > targetAspect) {
            // Wider than target ratio: crop sides (center horizontally)
            cropWidth = naturalHeight * targetAspect;
            cropHeight = naturalHeight;
            cropX = (naturalWidth - cropWidth) / 2;
            cropY = 0;
          } else if (currentAspect < targetAspect) {
            // Taller than target ratio: crop top/bottom
            cropWidth = naturalWidth;
            cropHeight = naturalWidth / targetAspect;
            cropX = 0;
            // Bias slightly towards top-center (25% down) for portraits if tall, center for banners
            const verticalSlack = naturalHeight - cropHeight;
            cropY = targetAspect < 1 ? verticalSlack * 0.25 : verticalSlack * 0.5;
          }

          const canvas = document.createElement('canvas');
          canvas.width = preset.targetWidth;
          canvas.height = preset.targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas 2D context not available');
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(
            img,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            preset.targetWidth,
            preset.targetHeight
          );

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create image blob'));
                return;
              }
              const outputName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
              const processedFile = new File([blob], outputName, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(processedFile);
            },
            'image/jpeg',
            preset.quality ?? 0.85
          );
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
