#!/bin/sh
# Writes AI-disclosure metadata into every voice clip (Space Apps SI rule for audio).
find assets/voice -name "*.mp3" | while read f; do
  ffmpeg -nostdin -loglevel error -y -i "$f" -map 0:a -c copy -id3v2_version 3 \
    -metadata artist="Synthetic voice (AI text-to-speech)" \
    -metadata comment="AI-generated speech: Kokoro-82M (Apache-2.0) via kokoro-onnx. No real person's voice." \
    -metadata album="Mars Colony: Command Center" "$f.tmp.mp3" && mv "$f.tmp.mp3" "$f"
done
