import React from "react";
import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { useAudio } from "../../hooks/useAudio";
import { cn } from "../../lib/utils";

/**
 * AudioControls - UI component for controlling audio settings
 * 
 * Provides:
 * - Toggle audio on/off
 * - Volume slider
 * - Visual feedback
 */
export function AudioControls({ className }) {
  const { enabled, setEnabled, volume, setVolume } = useAudio();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Toggle button */}
      <button
        onClick={() => setEnabled(!enabled)}
        className={cn(
          "p-2 rounded-lg transition-colors",
          enabled
            ? "bg-primary/20 text-primary hover:bg-primary/30"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        )}
        aria-label={enabled ? "Disable audio" : "Enable audio"}
        title={enabled ? "Disable audio" : "Enable audio"}
      >
        {enabled ? (
          volume > 0.5 ? (
            <Volume2 size={20} />
          ) : (
            <Volume1 size={20} />
          )
        ) : (
          <VolumeX size={20} />
        )}
      </button>

      {/* Volume slider */}
      {enabled && (
        <div className="flex items-center gap-2 flex-1 min-w-[100px] max-w-[150px]">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            aria-label="Volume"
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
          <span className="text-xs text-muted-foreground w-8 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}

export default AudioControls;

