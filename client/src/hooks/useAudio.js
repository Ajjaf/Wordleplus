import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Audio hook for managing game sound effects
 * 
 * Features:
 * - Play sound effects for game events
 * - Volume control
 * - Enable/disable toggle
 * - Preload audio files
 * - Respect user preferences (localStorage)
 */
export function useAudio() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("wordleplus_audio_enabled");
    return stored !== null ? stored === "true" : true; // Default: enabled
  });

  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return 0.7;
    const stored = localStorage.getItem("wordleplus_audio_volume");
    return stored ? parseFloat(stored) : 0.7; // Default: 70%
  });

  const audioCache = useRef(new Map());

  // Load audio file into cache
  const loadAudio = useCallback((soundName) => {
    if (!enabled) return null;

    if (audioCache.current.has(soundName)) {
      return audioCache.current.get(soundName);
    }

    try {
      const audio = new Audio(`/sounds/${soundName}.mp3`);
      audio.volume = volume;
      audio.preload = "auto";
      audioCache.current.set(soundName, audio);
      return audio;
    } catch (error) {
      console.warn(`Failed to load audio: ${soundName}`, error);
      return null;
    }
  }, [enabled, volume]);

  // Play a sound effect
  const playSound = useCallback((soundName, options = {}) => {
    if (!enabled) return;

    const {
      volume: overrideVolume = volume,
      loop = false,
      onEnded = null,
    } = options;

    try {
      let audio = audioCache.current.get(soundName);
      
      if (!audio) {
        audio = loadAudio(soundName);
      }

      if (!audio) return;

      // Clone audio to allow overlapping sounds
      const audioClone = audio.cloneNode();
      audioClone.volume = overrideVolume;
      audioClone.loop = loop;
      
      if (onEnded) {
        audioClone.addEventListener("ended", onEnded);
      }

      // Play the sound
      audioClone.play().catch((error) => {
        // User interaction may be required for autoplay
        // Silently fail - this is expected behavior
        if (error.name !== "NotAllowedError") {
          console.warn(`Failed to play sound: ${soundName}`, error);
        }
      });

      return audioClone;
    } catch (error) {
      console.warn(`Error playing sound: ${soundName}`, error);
    }
  }, [enabled, volume, loadAudio]);

  // Stop a specific sound
  const stopSound = useCallback((audioInstance) => {
    if (audioInstance) {
      audioInstance.pause();
      audioInstance.currentTime = 0;
    }
  }, []);

  // Stop all sounds
  const stopAllSounds = useCallback(() => {
    audioCache.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  }, []);

  // Update volume for all cached audio
  useEffect(() => {
    audioCache.current.forEach((audio) => {
      audio.volume = volume;
    });
    localStorage.setItem("wordleplus_audio_volume", volume.toString());
  }, [volume]);

  // Save enabled state
  useEffect(() => {
    localStorage.setItem("wordleplus_audio_enabled", enabled.toString());
    if (!enabled) {
      stopAllSounds();
    }
  }, [enabled, stopAllSounds]);

  // Preload common sounds on mount
  useEffect(() => {
    if (enabled) {
      const commonSounds = [
        "correct",
        "present",
        "absent",
        "error",
        "victory",
        "defeat",
        "typing",
        "submit",
      ];
      commonSounds.forEach((sound) => {
        loadAudio(sound);
      });
    }
  }, [enabled, loadAudio]);

  return {
    enabled,
    setEnabled,
    volume,
    setVolume,
    playSound,
    stopSound,
    stopAllSounds,
    loadAudio,
  };
}

export default useAudio;

