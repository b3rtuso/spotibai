import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

# Add bundled FFmpeg from imageio_ffmpeg to PATH
try:
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    ffmpeg_dir = str(Path(ffmpeg_exe).parent)
    if ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = ffmpeg_dir + os.path.pathsep + os.environ.get("PATH", "")
    print(f"[Spotibai] Using FFmpeg at: {ffmpeg_exe}")
except Exception as e:
    print(f"[Spotibai] FFmpeg discovery notice: {e}")

if __name__ == "__main__":
    import uvicorn
    print("[Spotibai] Starting Demucs AI Karaoke Backend on http://127.0.0.1:8000 ...")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
