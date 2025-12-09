import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Crown, Wifi, WifiOff, Trophy, Zap, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import MicroProgressGrid from "../mobile/MicroProgressGrid";

/**
 * UnifiedPlayerCard - Consolidates all player card variants
 * 
 * Variants:
 * - compact: Minimal card for tight spaces (mobile)
 * - detailed: Full-featured card with all info (desktop duel/shared)
 * - progress: Shows progress tiles (battle mode)
 * - spectate: Compact card for spectating (host view)
 */
export function UnifiedPlayerCard({
  // Player data
  name = "Player",
  wins = 0,
  streak = 0,
  avatar,
  guesses = [],
  maxGuesses = 6,
  
  // Status flags
  host = false,
  isTyping = false,
  hasSecret = false,
  disconnected = false,
  done = false,
  
  // Visual states
  highlight = "none", // "none" | "active" | "winner"
  active = false,
  
  // Variant and sizing
  variant = "detailed", // "compact" | "detailed" | "progress" | "spectate"
  size = "md", // "xs" | "sm" | "md" | "lg"
  
  // Feature flags
  showConnectionStatus = true,
  showTypingIndicator = true,
  showSecretStatus = true,
  showProgressTiles = false,
  showMicroGrid = false,
  
  // Customization
  className,
  rightExtras,
  onClick,
  theme = {}, // Mode-specific theme colors
  
  // Mobile-specific
  isMobile = false,
  onSelect, // For mobile selection
}) {
  const isActive = highlight === "active" || active;
  const isWinner = highlight === "winner";
  
  // Generate avatar/initials
  const avatarContent = useMemo(() => {
    if (avatar) return avatar;
    const parts = (name || "").trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
  }, [avatar, name]);
  
  // Size configurations
  const sizeConfig = {
    xs: {
      pad: "p-2",
      gap: "gap-2",
      name: "text-sm",
      sub: "text-[10px]",
      avatar: "w-8 h-8 text-base",
      icon: 12,
      dot: "w-2 h-2",
    },
    sm: {
      pad: "p-3",
      gap: "gap-3",
      name: "text-base",
      sub: "text-[11px]",
      avatar: "w-9 h-9 text-lg",
      icon: 14,
      dot: "w-2.5 h-2.5",
    },
    md: {
      pad: "p-4",
      gap: "gap-3",
      name: "text-lg",
      sub: "text-xs",
      avatar: "w-10 h-10 text-xl",
      icon: 16,
      dot: "w-3 h-3",
    },
    lg: {
      pad: "p-5",
      gap: "gap-4",
      name: "text-xl",
      sub: "text-sm",
      avatar: "w-12 h-12 text-2xl",
      icon: 18,
      dot: "w-3.5 h-3.5",
    },
  }[size];
  
  // Variant-specific rendering
  if (variant === "compact" || (isMobile && variant !== "detailed")) {
    return (
      <Card
        className={cn(
          "border bg-card/90 backdrop-blur-sm transition-all duration-200",
          isActive && "ring-2 ring-primary shadow-lg scale-105",
          onClick || onSelect ? "cursor-pointer hover:shadow-md hover:scale-102" : "",
          sizeConfig.pad,
          "min-w-[140px]",
          className
        )}
        onClick={onClick || onSelect}
      >
        <div className={cn("flex items-center", sizeConfig.gap)}>
          {/* Avatar */}
          <div
            className={cn(
              "rounded-full grid place-items-center border bg-muted text-foreground/80 shrink-0 relative",
              sizeConfig.avatar,
              isWinner && "border-emerald-500",
              host && !isWinner && "border-indigo-500",
              disconnected && "opacity-60 grayscale",
              isActive && "shadow-[0_0_12px_rgba(99,102,241,0.8)] transition-all animate-pulse"
            )}
          >
            {avatarContent}
            {showConnectionStatus && (
              <div className="absolute -bottom-0.5 -right-0.5">
                {disconnected ? (
                  <WifiOff className="text-rose-500" size={sizeConfig.icon - 4} />
                ) : (
                  <Wifi className="text-emerald-600" size={sizeConfig.icon - 4} />
                )}
              </div>
            )}
            {/* Visual indicators for typing and ready states */}
            {showTypingIndicator && isTyping && !disconnected && (
              <div className="absolute -top-0.5 -right-0.5 bg-blue-500 rounded-full p-0.5 animate-pulse">
                <Loader2 className="text-white" size={sizeConfig.icon - 6} />
              </div>
            )}
            {showSecretStatus && hasSecret && !disconnected && !isTyping && (
              <div className="absolute -top-0.5 -right-0.5 bg-emerald-500 rounded-full p-0.5">
                <CheckCircle2 className="text-white" size={sizeConfig.icon - 6} />
              </div>
            )}
          </div>
          
          {/* Name and stats */}
          <div className="flex-1 min-w-0">
            <div className={cn("flex items-center gap-1.5 truncate", sizeConfig.name)}>
              <span className="font-semibold truncate">{name}</span>
              {isWinner && <Trophy size={sizeConfig.icon} className="text-emerald-600 shrink-0" />}
              {host && !isWinner && <Crown size={sizeConfig.icon} className="text-indigo-600 shrink-0" />}
            </div>
            <div className={cn("flex items-center flex-wrap gap-1.5 mt-0.5", sizeConfig.sub)}>
              <Badge variant="outline" className="px-1 py-0 h-4">
                W:{wins}
              </Badge>
              <Badge
                variant="outline"
                className={cn("px-1 py-0 h-4", streak > 0 && "border-accent text-accent-foreground")}
              >
                <span className="inline-flex items-center gap-1">
                  {streak > 0 && <Zap size={sizeConfig.icon - 2} />}
                  Stk:{streak}
                </span>
              </Badge>
              {/* Typing and ready states shown via visual indicators on avatar - no text badges */}
              {disconnected && (
                <Badge variant="destructive" className="px-1 py-0 h-4">
                  offline
                </Badge>
              )}
            </div>
            {/* Micro progress grid for opponent card on mobile - always show */}
            {showMicroGrid && (
              <div className="mt-2 flex justify-center">
                <MicroProgressGrid
                  rows={3}
                  cols={5}
                  size={8}
                  gap={1.5}
                  radius={2}
                  patterns={guesses && guesses.length > 0 ? guesses.map((g) => g.pattern || []) : null}
                  fallbackFilled={guesses?.length || 0}
                  showWrapper={false}
                  showCellBorder={false}
                />
              </div>
            )}
          </div>
          
          {/* Status dot */}
          <div className="shrink-0">
            <div
              className={cn(
                "rounded-full",
                sizeConfig.dot,
                hasSecret
                  ? isWinner
                    ? "bg-emerald-600"
                    : "bg-emerald-500"
                  : "bg-muted-foreground/20"
              )}
              title={hasSecret ? "Ready" : "Not ready"}
            />
          </div>
        </div>
      </Card>
    );
  }
  
  if (variant === "progress") {
    // Battle mode progress card
    const recentGuesses = guesses?.slice(-3) || [];
    const totalGuesses = guesses?.length || 0;
    
    return (
      <Card
        className={cn(
          "border bg-card transition-all duration-200",
          isActive && "ring-2 ring-primary shadow-lg",
          sizeConfig.pad,
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className={cn(
              "rounded-full grid place-items-center text-sm font-semibold shrink-0",
              sizeConfig.avatar,
              isActive
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-700"
            )}
          >
            {avatarContent}
          </div>
          <div className="flex-1 min-w-0">
            <div className={cn("font-medium truncate", sizeConfig.name, isActive && "text-blue-800")}>
              {name}
              {isActive && " (You)"}
            </div>
            <div className={cn("text-muted-foreground", sizeConfig.sub)}>
              {done ? "Done!" : `${totalGuesses}/${maxGuesses}`}
            </div>
          </div>
          {done && (
            <div className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
              ✓
            </div>
          )}
        </div>
        
        {/* Progress Tiles */}
        {showProgressTiles && (
          <div className="space-y-2">
            {recentGuesses.map((guess, rowIndex) => (
              <div key={rowIndex} className="flex gap-1">
                {guess.pattern?.map((result, colIndex) => {
                  const getTileColor = (state) => {
                    if (state === "green" || state === "correct") return "bg-green-500 text-white";
                    if (state === "yellow" || state === "present") return "bg-yellow-500 text-white";
                    if (state === "gray" || state === "grey" || state === "absent") return "bg-slate-400 text-white";
                    return "bg-slate-200 text-slate-400";
                  };
                  return (
                    <div
                      key={colIndex}
                      className={cn("w-6 h-6 rounded-sm flex items-center justify-center text-xs font-bold", getTileColor(result))}
                    >
                      <div className="w-2 h-2 rounded-full bg-current opacity-80"></div>
                    </div>
                  );
                })}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 3 - recentGuesses.length) }).map((_, rowIndex) => (
              <div key={`empty-${rowIndex}`} className="flex gap-1">
                {Array.from({ length: 5 }).map((_, colIndex) => (
                  <div
                    key={colIndex}
                    className="w-6 h-6 rounded-sm border border-tile-empty-border bg-tile-empty-bg"
                  />
                ))}
              </div>
            ))}
          </div>
        )}
        
        {/* Micro Grid (mobile alternative) */}
        {showMicroGrid && !showProgressTiles && (
          <div className="flex justify-center">
            <MicroProgressGrid
              rows={3}
              cols={5}
              size={9}
              gap={1.5}
              radius={2}
              patterns={guesses?.map((g) => g.pattern || [])}
              showWrapper={false}
              showCellBorder={false}
            />
          </div>
        )}
      </Card>
    );
  }
  
  if (variant === "spectate") {
    // Host spectate view
    return (
      <Card
        className={cn(
          "border bg-card transition-all duration-200",
          sizeConfig.pad,
          className
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className={cn(
              "rounded-full grid place-items-center text-xs font-semibold shrink-0",
              sizeConfig.avatar,
              host ? "bg-blue-100 text-blue-700" : "bg-muted"
            )}
          >
            {host ? "👑" : avatarContent}
          </div>
          <div className="flex-1 min-w-0">
            <div className={cn("font-semibold truncate", sizeConfig.name)}>
              {name || "—"}
              {host && <span className="text-xs text-blue-600 font-medium ml-1">(Host)</span>}
            </div>
            <div className={cn("text-muted-foreground", sizeConfig.sub)}>
              {host ? "Spectating" : done ? "Done" : `${guesses?.length ?? 0}/${maxGuesses}`}
            </div>
          </div>
        </div>
      </Card>
    );
  }
  
  // Default: detailed variant (desktop)
  return (
    <Card
      data-active={isActive}
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        isActive
          ? "ring-2 ring-primary shadow-lg ring-opacity-80"
          : "opacity-85 hover:opacity-95",
        className
      )}
      style={{
        background: theme.background || "var(--gradient-card)",
        boxShadow: theme.shadow || "var(--shadow-card)",
      }}
      onClick={onClick}
    >
      <div className={sizeConfig.pad}>
        <div className={cn("flex items-start", sizeConfig.gap)}>
          {/* Avatar */}
          <div
            className={cn(
              "flex-shrink-0 rounded-xl grid place-items-center font-bold transition-all relative",
              sizeConfig.avatar,
              isActive
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground"
            )}
          >
            {avatarContent}
            {showConnectionStatus && (
              <div className="absolute -bottom-1 -right-1">
                {disconnected ? (
                  <WifiOff className="text-rose-500" size={sizeConfig.icon - 4} />
                ) : (
                  <Wifi className="text-emerald-600" size={sizeConfig.icon - 4} />
                )}
              </div>
            )}
            {/* Visual indicators for typing and ready states */}
            {showTypingIndicator && isTyping && !disconnected && (
              <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5 animate-pulse">
                <Loader2 className="text-white" size={sizeConfig.icon - 6} />
              </div>
            )}
            {showSecretStatus && hasSecret && !disconnected && !isTyping && (
              <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5">
                <CheckCircle2 className="text-white" size={sizeConfig.icon - 6} />
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <h3 className={cn("font-bold text-foreground truncate", sizeConfig.name, size === "md" && "text-xl")}>
                {name}
              </h3>
              {/* Active state shown via visual highlighting only - no text badge */}
              {isWinner && (
                <Badge variant="outline" className="text-[10px] px-2 py-0">
                  Winner
                </Badge>
              )}
              {host && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0">
                  Host
                </Badge>
              )}
              {disconnected && (
                <Badge variant="destructive" className="text-[10px] px-2 py-0">
                  Offline
                </Badge>
              )}
            </div>
            
            {/* Typing and ready states shown via visual indicators on avatar - no text badges */}
            
            <div className={cn("mt-3 grid grid-cols-2 gap-x-4 gap-y-1", sizeConfig.sub)}>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Wins</span>
                <span className="font-semibold text-foreground">{wins ?? 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Streak</span>
                <span className="font-semibold text-foreground">{streak ?? 0}</span>
              </div>
            </div>
          </div>
          
          {rightExtras && <div className="shrink-0">{rightExtras}</div>}
        </div>
      </div>
      
      {/* Active indicator - enhanced visual highlighting */}
      {isActive && (
        <>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 animate-pulse" />
          <div className="absolute inset-0 border-2 border-primary/40 rounded-xl pointer-events-none animate-pulse" />
        </>
      )}
      {isWinner && !isActive && (
        <div className="absolute inset-0 border border-emerald-500/40 pointer-events-none rounded-xl" />
      )}
    </Card>
  );
}

export default UnifiedPlayerCard;

