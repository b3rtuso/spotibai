import os
import sys
import shutil
import subprocess
import hashlib
import asyncio
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import httpx
import imageio_ffmpeg

# Ensure bundled imageio-ffmpeg is on PATH so demucs and subcommands can find ffmpeg
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
ffmpeg_dir = str(Path(ffmpeg_exe).parent)
if ffmpeg_dir not in os.environ.get("PATH", ""):
    os.environ["PATH"] = ffmpeg_dir + os.path.pathsep + os.environ.get("PATH", "")

app = FastAPI(title="Spotibai Demucs AI Karaoke Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Mount cache directory for serving separated stems
app.mount("/stems", StaticFiles(directory=str(CACHE_DIR)), name="stems")

# Track in-flight processing jobs
processing_jobs = {}

class SeparationRequest(BaseModel):
    trackId: str
    audioUrl: Optional[str] = None
    title: Optional[str] = None
    artist: Optional[str] = None


def sanitize_track_id(raw_id: str) -> str:
    # Stable sanitized id safe for directory names
    clean = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in raw_id)
    if not clean:
        clean = hashlib.md5(raw_id.encode("utf-8")).hexdigest()[:12]
    return clean[:64]


def get_cached_stems(clean_id: str):
    track_dir = CACHE_DIR / clean_id
    vocals_file = track_dir / "vocals.mp3"
    inst_file = track_dir / "instrumental.mp3"

    if vocals_file.exists() and inst_file.exists():
        return {
            "vocals": f"/stems/{clean_id}/vocals.mp3",
            "instrumental": f"/stems/{clean_id}/instrumental.mp3",
        }
    return None


def convert_wav_to_mp3(wav_path: Path, mp3_path: Path):
    """Convert WAV stem to high quality MP3 using bundled FFmpeg."""
    cmd = [
        ffmpeg_exe,
        "-y",
        "-i", str(wav_path),
        "-codec:a", "libmp3lame",
        "-b:a", "256k",
        str(mp3_path),
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)


def process_with_demucs(input_audio_path: Path, output_dir: Path):
    """
    Run Demucs 2-stem separation (vocals + no_vocals) using htdemucs model.
    Produces high-fidelity instrumental and vocal tracks.
    """
    cmd = [
        sys.executable,
        "-m", "demucs",
        "--two-stems=vocals",
        "-n", "htdemucs",
        "-o", str(output_dir),
        str(input_audio_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Demucs separation failed: {result.stderr or result.stdout}")

    # Output directory structure from demucs:
    # output_dir / htdemucs / <filename_stem> / vocals.wav & no_vocals.wav
    model_dir = output_dir / "htdemucs" / input_audio_path.stem
    vocals_wav = model_dir / "vocals.wav"
    inst_wav = model_dir / "no_vocals.wav"

    if not vocals_wav.exists() or not inst_wav.exists():
        # Check subdirectories if filename was altered
        for sub in (output_dir / "htdemucs").glob("*"):
            if (sub / "vocals.wav").exists():
                vocals_wav = sub / "vocals.wav"
                inst_wav = sub / "no_vocals.wav"
                break

    if not vocals_wav.exists() or not inst_wav.exists():
        raise FileNotFoundError(f"Demucs output files not found in {model_dir}")

    target_vocals = output_dir / "vocals.mp3"
    target_inst = output_dir / "instrumental.mp3"

    convert_wav_to_mp3(vocals_wav, target_vocals)
    convert_wav_to_mp3(inst_wav, target_inst)

    # Clean up intermediate heavy WAV files to conserve disk space
    if (output_dir / "htdemucs").exists():
        shutil.rmtree(output_dir / "htdemucs", ignore_errors=True)


def create_dsp_fallback_stems(input_audio_path: Path, output_dir: Path):
    """
    High-quality DSP fallback in case Demucs is busy or unavailable.
    Uses center-channel extraction / mid-side phase processing with FFmpeg.
    """
    target_vocals = output_dir / "vocals.mp3"
    target_inst = output_dir / "instrumental.mp3"

    # Instrumental: subtract center channel (vocal cancellation) + retain stereo side & low-end bass
    inst_filter = (
        "stereotools=mlev=0.08:slev=1.1,"
        "lowpass=f=12000"
    )
    subprocess.run([
        ffmpeg_exe, "-y", "-i", str(input_audio_path),
        "-af", inst_filter,
        "-b:a", "256k",
        str(target_inst)
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    # Vocals: isolate center mid-frequencies (250Hz - 4500Hz vocal formant band)
    vocal_filter = (
        "stereotools=slev=0.1:mlev=1.2,"
        "highpass=f=220,lowpass=f=4800,"
        "equalizer=f=1200:t=q:w=1.5:g=4"
    )
    subprocess.run([
        ffmpeg_exe, "-y", "-i", str(input_audio_path),
        "-af", vocal_filter,
        "-b:a", "256k",
        str(target_vocals)
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)


def execute_separation_task(clean_id: str, source_path: Path):
    track_dir = CACHE_DIR / clean_id
    track_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        processing_jobs[clean_id] = "processing"
        
        # Check if Demucs is available
        demucs_available = False
        try:
            import demucs
            demucs_available = True
        except ImportError:
            demucs_available = False

        if demucs_available:
            try:
                process_with_demucs(source_path, track_dir)
            except Exception as e:
                print(f"[Demucs Warning] Demucs failed: {e}. Falling back to high-grade DSP stems.", file=sys.stderr)
                create_dsp_fallback_stems(source_path, track_dir)
        else:
            print(f"[Notice] Demucs not loaded, creating DSP stems.", file=sys.stderr)
            create_dsp_fallback_stems(source_path, track_dir)

        processing_jobs[clean_id] = "ready"
    except Exception as e:
        print(f"[Separation Error] Failed for {clean_id}: {e}", file=sys.stderr)
        processing_jobs[clean_id] = f"error: {str(e)}"
    finally:
        # Clean up temporary source file if created in temp
        if "temp_" in source_path.name and source_path.exists():
            try:
                source_path.unlink()
            except Exception:
                pass


@app.get("/api/karaoke/health")
async def health_check():
    demucs_installed = False
    try:
        import demucs
        demucs_installed = True
    except ImportError:
        pass

    ffmpeg_installed = Path(ffmpeg_exe).exists()

    return {
        "status": "ok",
        "demucs": demucs_installed,
        "ffmpeg": ffmpeg_installed,
        "cache_dir": str(CACHE_DIR),
        "active_jobs": len([k for k, v in processing_jobs.items() if v == "processing"])
    }


@app.get("/api/karaoke/status/{track_id}")
async def get_track_status(track_id: str):
    clean_id = sanitize_track_id(track_id)
    cached = get_cached_stems(clean_id)

    if cached:
        return {
            "trackId": track_id,
            "status": "ready",
            "ready": True,
            "vocals": cached["vocals"],
            "instrumental": cached["instrumental"],
        }

    job_status = processing_jobs.get(clean_id)
    if job_status == "processing":
        return {
            "trackId": track_id,
            "status": "processing",
            "ready": False,
        }
    elif job_status and job_status.startswith("error"):
        return {
            "trackId": track_id,
            "status": "error",
            "ready": False,
            "error": job_status,
        }

    return {
        "trackId": track_id,
        "status": "not_found",
        "ready": False,
    }


@app.post("/api/karaoke/separate")
async def separate_audio(
    request: Request,
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
):
    target_id = None
    target_url = None

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            target_id = body.get("trackId")
            target_url = body.get("audioUrl")
        except Exception:
            pass
    else:
        try:
            form = await request.form()
            target_id = form.get("trackId")
            target_url = form.get("audioUrl")
            if not file and "file" in form and hasattr(form["file"], "file"):
                file = form["file"]
        except Exception:
            pass

    if not target_id:
        raise HTTPException(status_code=400, detail="Missing trackId")

    clean_id = sanitize_track_id(target_id)
    cached = get_cached_stems(clean_id)
    if cached:
        return {
            "success": true_or_bool(True),
            "trackId": target_id,
            "cached": True,
            "vocals": cached["vocals"],
            "instrumental": cached["instrumental"],
        }

    # If already processing, notify client
    if processing_jobs.get(clean_id) == "processing":
        return {
            "success": True,
            "trackId": target_id,
            "status": "processing",
            "message": "Separation already in progress",
        }

    # Resolve input audio file
    track_dir = CACHE_DIR / clean_id
    track_dir.mkdir(parents=True, exist_ok=True)
    temp_source = track_dir / f"input_{clean_id}.mp3"

    if file:
        with open(temp_source, "wb") as f:
            shutil.copyfileobj(file.file, f)
    else:
        # Check candidate local files in public/ and public/audio/
        filename = Path(target_url).name if target_url else f"{target_id}.mp3"
        candidates = [
            BASE_DIR.parent / "public" / "audio" / filename,
            BASE_DIR.parent / "public" / filename,
            BASE_DIR.parent / "public" / target_url.lstrip("/") if target_url else None,
            BASE_DIR.parent / "public" / "audio" / f"{target_id}.mp3",
            BASE_DIR.parent / "public" / f"{target_id}.mp3",
        ]
        found = False
        for c in candidates:
            if c and c.exists() and c.is_file():
                shutil.copy(c, temp_source)
                found = True
                break

        if not found and target_url and (target_url.startswith("http://") or target_url.startswith("https://")):
            try:
                async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as client:
                    resp = await client.get(target_url)
                    if resp.status_code == 200:
                        with open(temp_source, "wb") as f:
                            f.write(resp.content)
                        found = True
            except Exception as e:
                print(f"[Warning] Failed remote download: {e}", file=sys.stderr)

        if not found and target_url and target_url.startswith("/"):
            for port in [5173, 3000, 8080]:
                try:
                    full_url = f"http://127.0.0.1:{port}{target_url}"
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.get(full_url)
                        if resp.status_code == 200:
                            with open(temp_source, "wb") as f:
                                f.write(resp.content)
                            found = True
                            break
                except Exception:
                    pass

        if not found or not temp_source.exists() or temp_source.stat().st_size == 0:
            raise HTTPException(status_code=400, detail="Audio file could not be located or downloaded")

    # Launch separation in background so client receives fast response
    if background_tasks:
        background_tasks.add_task(execute_separation_task, clean_id, temp_source)
    else:
        asyncio.create_task(asyncio.to_thread(execute_separation_task, clean_id, temp_source))

    processing_jobs[clean_id] = "processing"

    return {
        "success": True,
        "trackId": target_id,
        "status": "processing",
        "message": "Separation started",
    }


def true_or_bool(val):
    return bool(val)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
