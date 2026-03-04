#!/usr/bin/env python3
"""Face-crop helper: reads an image, crops around the detected face at face_factor=0.8, writes result.

Usage:
    python face_crop.py <input_path> <output_path> [size] [face_factor]

Falls back to center-top crop if no face is detected.
"""
import sys
import os

def main():
    if len(sys.argv) < 3:
        print("Usage: face_crop.py <input> <output> [size] [face_factor]", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    size = int(sys.argv[3]) if len(sys.argv) > 3 else 200
    face_factor = float(sys.argv[4]) if len(sys.argv) > 4 else 0.8

    from face_crop_plus import Cropper
    from PIL import Image
    import tempfile, shutil

    # face-crop-plus works on directories, so use temp dirs
    tmp_in = tempfile.mkdtemp()
    tmp_out = tempfile.mkdtemp()

    try:
        # Copy input to temp dir
        ext = os.path.splitext(input_path)[1] or '.jpg'
        tmp_input = os.path.join(tmp_in, f"photo{ext}")
        shutil.copy2(input_path, tmp_input)

        cropper = Cropper(
            face_factor=face_factor,
            output_size=size,
            strategy="largest",
        )
        cropper.process_dir(input_dir=tmp_in, output_dir=tmp_out)

        # Check if face-crop-plus produced output
        results = [f for f in os.listdir(tmp_out) if not f.startswith('.')]
        if results:
            shutil.copy2(os.path.join(tmp_out, results[0]), output_path)
            print("OK:face_detected")
        else:
            # Fallback: center-top crop with PIL
            img = Image.open(input_path)
            w, h = img.size
            short = min(w, h)
            left = (w - short) // 2
            top = 0  # top-aligned for portraits
            img = img.crop((left, top, left + short, top + short))
            img = img.resize((size, size), Image.LANCZOS)
            img.save(output_path, "JPEG", quality=95)
            print("OK:fallback_crop")
    finally:
        shutil.rmtree(tmp_in, ignore_errors=True)
        shutil.rmtree(tmp_out, ignore_errors=True)

if __name__ == "__main__":
    main()
