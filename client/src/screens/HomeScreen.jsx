import React, { useState } from "react";
import BrandLogo from "../components/BrandLogo.jsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomeScreen({
  name,
  setName,
  roomId,
  setRoomId,
  mode,
  setMode,
  onCreate,
  onJoin,
  onPlayDaily,
  message,
}) {
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const isDaily = mode === "daily";

  const submitCreate = async () => {
    setCreating(true);
    try {
      if (isDaily && onPlayDaily) {
        await onPlayDaily();
      } else {
        await onCreate();
      }
    } finally {
      setCreating(false);
    }
  };
  const submitJoin = async () => {
    setJoining(true);
    try {
      await onJoin();
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-background via-background to-card overflow-y-auto">
      {/* Hero Section */}
      <main className="container mx-auto px-4 py-4 h-full flex flex-col justify-center max-w-4xl">
        <div className="text-center max-w-4xl mx-auto flex-1 flex flex-col justify-center">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center mb-4">
              <BrandLogo withText size="lg" className="drop-shadow-glow" />
            </div>
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
              WordlePlus
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-4 max-w-2xl mx-auto leading-relaxed">
              The ultimate competitive Wordle experience. Battle friends in
              duels or compete in battle royale mode. Locally
            </p>
          </div>

          {/* Game Setup Card */}
          <div className="mb-4 max-w-2xl mx-auto">
            <Card className="p-6 bg-gradient-card border-border/20 backdrop-blur-sm shadow-competitive">
              {/* Name Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Display name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-lg border border-input bg-background/50 px-3 py-3 min-h-[48px] text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
              </div>
              {/* Mode Selection */}
              <div className="mb-4">
                <div className="text-sm font-medium text-foreground mb-2">
                  Choose your mode
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => setMode("duel")}
                    variant={mode === "duel" ? "default" : "outline"}
                    className={`min-h-[48px] transition-all ${
                      mode === "duel"
                        ? "bg-gradient-primary hover:shadow-glow"
                        : "hover:bg-primary/10"
                    }`}
                  >
                    Duel (1v1)
                  </Button>
                  <Button
                    onClick={() => setMode("battle")}
                    variant={mode === "battle" ? "default" : "outline"}
                    className={`min-h-[48px] transition-all ${
                      mode === "battle"
                        ? "bg-gradient-primary hover:shadow-glow"
                        : "hover:bg-primary/10"
                    }`}
                  >
                    Battle Royale
                  </Button>
                  <Button
                    onClick={() => setMode("shared")}
                    variant={mode === "shared" ? "default" : "outline"}
                    className={`min-h-[48px] transition-all ${
                      mode === "shared"
                        ? "bg-gradient-primary hover:shadow-glow"
                        : "hover:bg-primary/10"
                    }`}
                  >
                    Shared Duel
                  </Button>
                  <Button
                    onClick={() => setMode("daily")}
                    variant={mode === "daily" ? "default" : "outline"}
                    className={`min-h-[48px] transition-all ${
                      mode === "daily"
                        ? "bg-gradient-primary hover:shadow-glow"
                        : "hover:bg-primary/10"
                    } flex items-center justify-center gap-1`}
                  >
                    Daily Challenge
                    <Badge
                      variant="secondary"
                      className="ml-1 hidden sm:inline-block text-[10px] uppercase tracking-[0.2em]"
                    >
                      New
                    </Badge>
                  </Button>
                </div>
              </div>
              {/* Actions */}
              {isDaily ? (
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    onClick={submitCreate}
                    disabled={creating || !name.trim()}
                    size="lg"
                    className="bg-gradient-primary hover:shadow-glow transition-all duration-300 min-h-[48px]"
                  >
                    {creating ? "Loading..." : "Play Daily Challenge"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    One puzzle per day. Progress resets at midnight.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={submitCreate}
                    disabled={creating || !name.trim()}
                    size="lg"
                    className="bg-gradient-primary hover:shadow-glow transition-all duration-300 min-h-[48px]"
                  >
                    {creating ? "Creating..." : "Create Room"}
                  </Button>

                  <div className="flex gap-2">
                    <input
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                      placeholder="Room code"
                      className="flex-1 min-h-[48px] rounded-lg border border-input bg-background/50 px-3 text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    />
                    <Button
                      onClick={submitJoin}
                      disabled={joining || !roomId.trim()}
                      size="lg"
                      variant="outline"
                      className="min-h-[48px] px-4 hover:bg-primary/10"
                    >
                      {joining ? "Joining..." : "Join"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Message */}
              {message && (
                <div className="mt-3 p-2 text-sm text-amber-700 bg-amber-50/50 border border-amber-200/50 rounded-lg">
                  {message}
                </div>
              )}
            </Card>
          </div>

          {/* Compact Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="flex items-center gap-2 p-2 bg-gradient-card border border-border/20 rounded-lg">
              <div className="w-6 h-6 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">⚔️</span>
              </div>
              <div>
                <h3 className="text-xs font-semibold">Friend Duels</h3>
                <p className="text-xs text-muted-foreground">1v1 battles</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 bg-gradient-card border border-border/20 rounded-lg">
              <div className="w-6 h-6 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">👑</span>
              </div>
              <div>
                <h3 className="text-xs font-semibold">Battle Royale</h3>
                <p className="text-xs text-muted-foreground">
                  Multiplayer mode
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 bg-gradient-card border border-border/20 rounded-lg">
              <div className="w-6 h-6 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">🎯</span>
              </div>
              <div>
                <h3 className="text-xs font-semibold">Skill-Based</h3>
                <p className="text-xs text-muted-foreground">
                  Competitive scoring
                </p>
              </div>
            </div>
          </div>

          {/* Footer hint */}
          <div className="text-center text-sm text-muted-foreground">
            Tip: Share the room code with friends to play together.
          </div>
        </div>
      </main>
    </div>
  );
}
