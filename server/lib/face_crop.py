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
        ext = os.path.splitext(input_path)[1] or '.jpg'

        def has_black_corners(img_path, threshold=10):
            """Check if the image has black (unfilled) corners."""
            img = Image.open(img_path)
            pixels = img.load()
            w, h = img.size
            corners = [(0, 0), (w-1, 0), (0, h-1), (w-1, h-1)]
            for x, y in corners:
                p = pixels[x, y]
                if isinstance(p, tuple):
                    if all(c < threshold for c in p[:3]):
                        return True
                elif p < threshold:
                    return True
            return False

        def try_crop(ff):
            """Run face_crop_plus with given face_factor, return output path or None."""
            # Clean temp dirs
            for f in os.listdir(tmp_in):
                os.remove(os.path.join(tmp_in, f))
            for f in os.listdir(tmp_out):
                os.remove(os.path.join(tmp_out, f))
            shutil.copy2(input_path, os.path.join(tmp_in, f"photo{ext}"))
            cropper = Cropper(face_factor=ff, output_size=size, strategy="largest")
            cropper.process_dir(input_dir=tmp_in, output_dir=tmp_out)
            results = [f for f in os.listdir(tmp_out) if not f.startswith('.')]
            if results:
                return os.path.join(tmp_out, results[0])
            return None

        # Try with requested face_factor, increase if black corners appear
        result_path = None
        used_ff = face_factor
        for ff in [face_factor, 0.5, 0.6, 0.7, 0.8]:
            result_path = try_crop(ff)
            if result_path and not has_black_corners(result_path):
                used_ff = ff
                break
            used_ff = ff

        if result_path:
            shutil.copy2(result_path, output_path)
            print(f"OK:face_detected:ff={used_ff}")
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
