"use client";
import { useEffect, useRef, useState } from "react";

export interface PlayableSource { id: number; kind: "hls" | "mp4" | "iframe"; url: string; label: string }

/**
 * Video player for the watch pages. Plays your own HLS (.m3u8) or MP4 files,
 * or a licensed partner's embed player in an iframe. Several sources show as
 * server tabs. hls.js is only loaded when an HLS source needs it.
 * 
 * Prefer Vidy (https://vidy.st) iframe embeds constructed from TMDB / AniList IDs.
 */
export function Player({ sources, title, poster }: { sources: PlayableSource[]; title: string; poster?: string | null }) {
  const [i, setI] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const s = sources[i];

  useEffect(() => {
    const el = video.current;
    if (!el || !s || s.kind !== "hls") return;
    if (el.canPlayType("application/vnd.apple.mpegurl")) { el.src = s.url; return; } // Safari / iOS play HLS natively
    let destroyed = false;
    let hls: { destroy(): void } | null = null;
    import("hls.js").then(({ default: Hls }) => {
      if (destroyed || !Hls.isSupported()) return;
      const h = new Hls({ enableWorker: true });
      h.loadSource(s.url);
      h.attachMedia(el);
      hls = h;
    });
    return () => { destroyed = true; hls?.destroy(); };
  }, [s]);

  if (!s) return null;
  return (
    <div>
      <div className="player">
        {s.kind === "iframe" ? (
          <iframe
            key={s.id}
            src={s.url}
            title={`${title} player`}
            allow="encrypted-media; autoplay *; fullscreen *"
            allowFullScreen
            referrerPolicy="origin"
          />
        ) : (
          <video key={s.id} ref={video} controls playsInline preload="metadata" poster={poster ?? undefined} src={s.kind === "mp4" ? s.url : undefined} aria-label={`${title} video`} />
        )}
      </div>
      {sources.length > 1 && (
        <div className="servers" role="group" aria-label="Servers">
          {sources.map((x, n) => <button key={x.id} type="button" aria-pressed={n === i} onClick={() => setI(n)}>{x.label}</button>)}
        </div>
      )}
    </div>
  );
}
