# Sound Effects Directory

This directory contains audio files for game sound effects.

## Required Sound Files

Place the following MP3 files in this directory:

1. **correct.mp3** - Sound for correct letter placement (green tile)
2. **present.mp3** - Sound for present letter (yellow tile)
3. **absent.mp3** - Sound for absent letter (gray tile)
4. **error.mp3** - Sound for invalid word/error
5. **victory.mp3** - Sound for winning the game
6. **defeat.mp3** - Sound for losing the game
7. **typing.mp3** - Optional: subtle typing sound
8. **submit.mp3** - Sound when submitting a guess

## Audio Specifications

- **Format**: MP3 (for browser compatibility)
- **Sample Rate**: 44.1kHz recommended
- **Bitrate**: 128kbps minimum
- **Duration**: Keep sounds short (0.1-0.5 seconds for most, 1-2 seconds for victory/defeat)
- **Volume**: Normalize all sounds to similar levels

## Free Sound Resources

You can find free sound effects at:

- Freesound.org (CC0/CC-BY licensed)
- Zapsplat.com
- OpenGameArt.org
- Incompetech.com (royalty-free music and sounds)

## Usage

Sounds are automatically loaded and played by the `useAudio` hook and `AudioFeedback` component. Users can control audio via the `AudioControls` component.
