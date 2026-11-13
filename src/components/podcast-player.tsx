"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { AudioLines, Maximize2, Minimize2, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Episode = { id: string; title: string; embedUrl: string };

type PlayerState = { episode: Episode | null; play: (episode: Episode) => void };

const PlayerContext = createContext<PlayerState | null>(null);

/**
 * The floating podcast player. Lives in the (app) layout, so it stays mounted (and keeps playing) while the user moves
 * between pages. One episode at a time: playing another replaces it. A full reload or sign-out stops it.
 */
export function PodcastPlayerProvider({ children }: { children: ReactNode }) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [minimized, setMinimized] = useState(false);
  const play = (next: Episode) => {
    setEpisode(next);
    setMinimized(false);
  };
  return (
    <PlayerContext.Provider value={{ episode, play }}>
      {children}
      {episode && (
        <PlayerDock episode={episode} minimized={minimized} onToggle={() => setMinimized((m) => !m)} onClose={() => setEpisode(null)} />
      )}
    </PlayerContext.Provider>
  );
}

/**
 * Not a modal: the page stays usable. Top right under the header on desktop, along the bottom on phones. Minimised,
 * the video is hidden but still mounted, so it keeps playing; YouTube's own controls pause and play it.
 */
function PlayerDock({ episode, minimized, onToggle, onClose }: { episode: Episode; minimized: boolean; onToggle: () => void; onClose: () => void }) {
  const ToggleIcon = minimized ? Maximize2 : Minimize2;
  return (
    <section
      aria-label="Podcast player"
      className="bg-card fixed inset-x-2 bottom-2 z-40 overflow-hidden rounded-xl border shadow-lg sm:inset-x-auto sm:top-[4.5rem] sm:right-4 sm:bottom-auto sm:w-[360px]"
      data-testid="podcast-player"
      data-minimized={minimized}
    >
      <div className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
        <div className="min-w-0 flex-1">
          <p className="text-meta text-muted-foreground">Now playing</p>
          <p className="truncate text-sm font-medium" title={episode.title}>
            {episode.title}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={onToggle} aria-expanded={!minimized} data-testid="player-toggle">
          <ToggleIcon className="size-4" aria-hidden />
          <span className="sr-only">{minimized ? "Show the video" : "Hide the video"}</span>
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} data-testid="player-close">
          <X className="size-4" aria-hidden />
          <span className="sr-only">Close the player</span>
        </Button>
      </div>
      <div className={cn("aspect-video bg-black", minimized && "pointer-events-none h-0 opacity-0")}>
        <iframe
          key={episode.id}
          src={episode.embedUrl}
          title={`YouTube player: ${episode.title}`}
          className="size-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  );
}

/** "Play" on an episode card: opens it in the floating player. "Playing" while it's the one in the player (pressing it shows the video again). */
export function PlayEpisodeButton({ episode }: { episode: Episode }) {
  const player = useContext(PlayerContext);
  if (!player) return null;
  const playing = player.episode?.id === episode.id;
  const Icon = playing ? AudioLines : Play;
  return (
    <Button
      variant={playing ? "default" : "outline"}
      size="sm"
      className="h-7 px-2.5 text-xs"
      onClick={() => player.play(episode)}
      data-testid="play-episode"
    >
      <Icon className="size-3.5" aria-hidden />
      {playing ? "Playing" : "Play"}
      <span className="sr-only"> {episode.title}</span>
    </Button>
  );
}
