# SPDX-License-Identifier: GPL-3.0-or-later
"""Generate bilingual neural narration locally; no paid service or voice clone.

Install tools/requirements-gamescam-voice.txt in a private virtual environment.
First run --download-models (network); subsequent synthesis is entirely local.
Do not copy models, raw WAVs or this tool into the public website.
"""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import urllib.request
import wave


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = json.loads((ROOT / "tools/gamescam-narration.json").read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--models", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--download-models", action="store_true")
parser.add_argument("--download-only", action="store_true")
args = parser.parse_args()
for folder in (args.models, args.output):
    if folder.resolve().is_relative_to(ROOT / "services/game-scam-guard/public"):
        raise ValueError("Keep synthesis intermediates outside the public website")
    folder.mkdir(parents=True, exist_ok=True)


def digest(path, algorithm="sha256"):
    data = path.read_bytes()
    if algorithm == "git":
        return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
    return hashlib.sha256(data).hexdigest()


for locale in ("en", "fa"):
    voice = SCRIPT[locale]
    files = [
        (voice["voiceId"] + ".onnx", voice["modelSha256"], "sha256"),
        (voice["voiceId"] + ".onnx.json", voice["configGitBlob"], "git"),
        ("MODEL_CARD", voice["cardGitBlob"], "git"),
    ]
    target_dir = args.models / locale
    target_dir.mkdir(exist_ok=True)
    for name, expected, algorithm in files:
        target = target_dir / name
        if not target.exists():
            if not args.download_models:
                raise FileNotFoundError(f"Missing {locale}/{name}; use --download-models once")
            source = SCRIPT["source"]
            url = (f"https://huggingface.co/{source['repo']}/resolve/"
                   f"{source['revision']}/{voice['directory']}/{name}")
            partial = target.with_suffix(target.suffix + ".partial")
            try:
                with urllib.request.urlopen(url, timeout=120) as response, partial.open("wb") as output:
                    received = 0
                    while chunk := response.read(1024 * 1024):
                        received += len(chunk)
                        if received > 160 * 1024 * 1024:
                            raise ValueError("Unexpectedly large voice model")
                        output.write(chunk)
                if digest(partial, algorithm) != expected:
                    raise ValueError(f"Downloaded voice checksum mismatch: {locale}/{name}")
                partial.replace(target)
            finally:
                partial.unlink(missing_ok=True)
        if digest(target, algorithm) != expected:
            raise ValueError(f"Voice checksum mismatch: {locale}/{name}")
    print(f"Verified pinned {locale} model, configuration and model card.", flush=True)
if args.download_only:
    raise SystemExit(0)

# Imported only after the voice files are verified. No network is used below.
import onnxruntime as ort
from piper import PiperVoice, SynthesisConfig
from piper.config import PiperConfig

assert importlib.metadata.version("piper-tts") == "1.8.0"
ort.disable_telemetry_events()
ort.set_seed(7)
manifest = {
    "engine": SCRIPT["model"],
    "offline": True,
    "syntheticTestOnly": False,
    "source": SCRIPT["source"],
}
for locale in ("en", "fa"):
    spec = SCRIPT[locale]
    model = args.models / locale / (spec["voiceId"] + ".onnx")
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"])
    voice = PiperVoice(session=session, config=PiperConfig.from_dict(json.loads(model.with_suffix(".onnx.json").read_text())))
    config = SynthesisConfig(length_scale=spec["lengthScale"], noise_scale=0.6, noise_w_scale=0.8)
    segments, chapters, total_frames, params = [], [], 0, None
    for index, text in enumerate(spec["chapters"]):
        assert text.strip() and len(text) < 2000
        path = args.output / f"{locale}-chapter-{index + 1:02}.wav"
        with wave.open(str(path), "wb") as output:
            voice.synthesize_wav(text, output, syn_config=config)
        with wave.open(str(path), "rb") as audio:
            assert audio.getnchannels() == 1 and audio.getsampwidth() == 2
            current = (audio.getnchannels(), audio.getsampwidth(), audio.getframerate())
            params = params or current
            assert params == current
            frames = audio.getnframes()
            assert 0.8 < frames / params[2] < 45
            segments.append(audio.readframes(frames))
            chapters.append({"start": total_frames / params[2], "end": (total_frames + frames) / params[2]})
            total_frames += frames
        print(f"Synthesized {locale} chapter {index + 1}/9 locally.", flush=True)
    target = args.output / f"narration-{locale}.wav"
    with wave.open(str(target), "wb") as output:
        output.setnchannels(params[0])
        output.setsampwidth(params[1])
        output.setframerate(params[2])
        for data in segments:
            output.writeframes(data)
    manifest[locale] = {
        "language": locale,
        "file": target.name,
        "voice": spec["voice"],
        "datasetLicense": spec["datasetLicense"],
        "modelSha256": spec["modelSha256"],
        "audioSha256": digest(target),
        "transcript": "\n\n".join(spec["chapters"]),
        "chapters": chapters,
    }
    (args.output / "narration-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Completed {locale}: {total_frames / params[2]:.1f} seconds of neural narration.", flush=True)
