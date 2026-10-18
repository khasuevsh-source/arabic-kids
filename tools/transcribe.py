"""Распознаёт арабскую речь в аудиофайле и сохраняет строки с таймкодами в JSON.

Использование:
    python transcribe.py audio.webm out.json [--model large-v3] [--cpu]
"""
import argparse, glob, json, os, site, sys


def add_cuda_dlls():
    # pip-пакеты nvidia-cublas-cu12 / nvidia-cudnn-cu12 кладут DLL в site-packages/nvidia/*/bin
    for sp in site.getsitepackages():
        for d in glob.glob(os.path.join(sp, "nvidia", "*", "bin")):
            os.add_dll_directory(d)
            os.environ["PATH"] = d + os.pathsep + os.environ["PATH"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("out")
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--cpu", action="store_true")
    a = ap.parse_args()

    if not a.cpu:
        add_cuda_dlls()
    from faster_whisper import WhisperModel

    device = "cpu" if a.cpu else "cuda"
    # GTX 10xx: float16 медленный, поэтому int8; на RTX — float16
    compute = "int8" if a.cpu else os.environ.get("WHISPER_COMPUTE", "float16")
    model = WhisperModel(a.model, device=device, compute_type=compute)

    segments, info = model.transcribe(
        a.audio,
        language="ar",
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 400},
        beam_size=5,
        condition_on_previous_text=False,
    )
    out = []
    for s in segments:
        out.append({
            "start": round(s.start, 2),
            "end": round(s.end, 2),
            "ar": s.text.strip(),
            "words": [{"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2)} for w in (s.words or [])],
        })
        print(f"[{s.start:7.2f}] {s.text.strip()}", flush=True)

    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"duration": info.duration, "lines": out}, f, ensure_ascii=False, indent=1)
    print(f"Готово: {len(out)} строк -> {a.out}")


if __name__ == "__main__":
    sys.exit(main())
