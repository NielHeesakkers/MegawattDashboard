/**
 * Face-crop helper: detects face in an image and crops around it.
 * Uses @vladmandic/face-api (TensorFlow.js) for detection + Sharp for cropping.
 * Falls back to center-top crop if no face is detected.
 */
import path from 'path';
import util from 'util';
import sharp from 'sharp';

// Polyfill for Node.js v25+ which removed util.isNullOrUndefined
// (required by @tensorflow/tfjs-node)
if (!(util as any).isNullOrUndefined) {
  (util as any).isNullOrUndefined = (v: any) => v === null || v === undefined;
}

let faceApiLoaded = false;
let faceapi: typeof import('@vladmandic/face-api');
let tf: any;

const MODEL_DIR = path.resolve(
  require.resolve('@vladmandic/face-api'),
  '../../model'
);

async function ensureModelsLoaded() {
  if (faceApiLoaded) return;

  tf = require('@tensorflow/tfjs-node');
  await tf.ready();

  faceapi = require('@vladmandic/face-api');

  // Load only the tiny face detector (fast + lightweight)
  await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_DIR);
  faceApiLoaded = true;
}

interface FaceCropResult {
  method: 'face_detected' | 'fallback_crop';
}

/**
 * Crop an image around the detected face and save as JPEG.
 * @param inputPath  Path to the source image
 * @param outputPath Path for the cropped output
 * @param size       Output size in pixels (square)
 * @param faceFactor How much space around the face (0-1, higher = tighter crop)
 */
export async function faceCrop(
  inputPath: string,
  outputPath: string,
  size: number = 200,
  faceFactor: number = 0.4
): Promise<FaceCropResult> {
  await ensureModelsLoaded();

  // Read image metadata
  const metadata = await sharp(inputPath).metadata();
  const imgWidth = metadata.width!;
  const imgHeight = metadata.height!;

  // Decode image to raw RGB pixel buffer for face-api
  const { data, info } = await sharp(inputPath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Create tensor from raw pixels
  const tensor = tf.tensor3d(
    new Uint8Array(data),
    [info.height, info.width, 3] // RGB
  );

  // Detect face
  const detection = await faceapi.detectSingleFace(
    tensor as any,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 })
  );

  tensor.dispose();

  if (detection) {
    const box = detection.box;

    // Expand the crop area around the face
    const faceWidth = box.width;
    const faceHeight = box.height;
    const faceCenterX = box.x + faceWidth / 2;
    const faceCenterY = box.y + faceHeight / 2;

    // Calculate crop size: face takes up `faceFactor` of the final crop
    const cropSize = Math.max(faceWidth, faceHeight) / faceFactor;

    // Center crop on the face, offset slightly upward (forehead room)
    const cropCenterY = faceCenterY - cropSize * 0.05;

    let left = Math.round(faceCenterX - cropSize / 2);
    let top = Math.round(cropCenterY - cropSize / 2);
    let cropW = Math.round(cropSize);
    let cropH = Math.round(cropSize);

    // Clamp to image bounds
    left = Math.max(0, Math.min(left, imgWidth - 1));
    top = Math.max(0, Math.min(top, imgHeight - 1));
    cropW = Math.min(cropW, imgWidth - left);
    cropH = Math.min(cropH, imgHeight - top);

    // Make it square
    const side = Math.min(cropW, cropH);
    cropW = side;
    cropH = side;

    await sharp(inputPath)
      .extract({ left, top, width: cropW, height: cropH })
      .resize(size, size)
      .jpeg({ quality: 95 })
      .toFile(outputPath);

    return { method: 'face_detected' };
  }

  // Fallback: center-top crop
  const short = Math.min(imgWidth, imgHeight);
  const left = Math.round((imgWidth - short) / 2);
  const top = 0; // top-aligned for portraits

  await sharp(inputPath)
    .extract({ left, top, width: short, height: short })
    .resize(size, size)
    .jpeg({ quality: 95 })
    .toFile(outputPath);

  return { method: 'fallback_crop' };
}

export { faceCrop as processPhoto };
