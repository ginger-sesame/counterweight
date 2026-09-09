#!/usr/bin/env python3
"""Validate basic upload media properties; human narration needs manual review."""
import argparse
import json
import subprocess
from pathlib import Path
p = argparse.ArgumentParser()
p.add_argument('video', type=Path)
a = p.parse_args()
try:
    result = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
        'format=duration:stream=codec_type,width,height', '-of', 'json', str(a.video)],
        capture_output=True, text=True, check=True, timeout=30)
    data = json.loads(result.stdout)
    duration = float(data['format']['duration'])
    videos = [s for s in data['streams'] if s['codec_type'] == 'video']
    audio = any(s['codec_type'] == 'audio' for s in data['streams'])
    assert 120 <= duration <= 240, 'Video must be between 120 and 240 seconds'
    assert videos and videos[0]['width'] >= 1280 and videos[0]['height'] >= 720, 'Record at 1280x720 or higher'
    assert audio, 'Audio stream missing'
    print(json.dumps(dict(result='PASS', durationSeconds=duration, width=videos[0]['width'],
        height=videos[0]['height'], audioStream=True,
        manualReviewRequired=['Audible human narration; no AI/TTS', 'No speed-up', 'No exposed credentials',
                              'Correct recorded/live labeling', 'Dashboard upload acceptance'])))
except (FileNotFoundError, subprocess.SubprocessError, ValueError, KeyError, AssertionError) as e:
    print(json.dumps(dict(result='FAIL', message='Install ffprobe and provide a valid video; check duration, resolution and audio.', category=type(e).__name__)))
    raise SystemExit(1)
