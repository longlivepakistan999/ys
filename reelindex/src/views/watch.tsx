/**
 * Watch pages (reserved for playable content):
 *   /movie/{id}-{slug}/watch
 *   /tv/{id}-{slug}/season-{n}/episode-{m}/watch
 * With sources in the VideoSource table the page shows the player; without,
 * it says so and lists where to watch instead (and is kept out of the index).
 *
 * Vidy (https://vidy.st) is injected as the primary embed source using TMDB IDs.
 * Anime uses AniList ID when available (route /anime/{anilistId}/{episode}).
 */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { episodesWithVideo, videoSources } from "@/lib/data/sources";
import { paths } from "@/lib/slug";
import { buildMeta } from "@/lib/seo/meta";
import { breadcrumbLd, JsonLd } from "@/lib/seo/jsonld";
import { fmtDate, fmtRuntime, getSite, img } from "@/lib/site";
import { Ad } from "@/components/Ad";
import { Player, type PlayableSource } from "@/components/Player";
import { Providers } from "@/components/Providers";
import { Crumbs } from "@/components/ui";
import { loadMovie } from "./movie";
import { loadEpisode } from "./tv";

const code = (s: number, e: number) => `S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")}`;

function Unavailable({ title, back }: { title: string; back: [string, string] }) {
  return (
    <div className="player player-empty">
      <div>
        <strong style={{ fontSize: 18 }}>{title} isn&apos;t available to play here yet</strong>
        <p>Check the streaming services below, or come back later.</p>
        <Link className="btn btn-primary" href={back[1]}>{back[0]}</Link>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Movie
export async function movieWatchMetadata(segment: string) {
  const { m, canonical } = await loadMovie(segment, "/watch");
  const sources = await videoSources("movie", m.id);
  return buildMeta({
    title: `Watch ${m.title}${m.year ? ` (${m.year})` : ""}`, path: `${canonical}/watch`, index: m.isIndexable,
    description: `Watch ${m.title}${m.year ? ` (${m.year})` : ""}${m.runtime ? `, ${fmtRuntime(m.runtime)}` : ""}. Cast, details and other ways to watch.`,
    ogType: "video.movie", image: img(m.backdropPath, "w1280"),
  });
}

export async function MovieWatchPage({ segment }: { segment: string }) {
  const { m, d, canonical } = await loadMovie(segment, "/watch");
  const site = await getSite();
  const dbSources = await videoSources("movie", m.id);
  const vidySource: PlayableSource = {
    id: -1,
    kind: "iframe",
    url: `https://vidy.st/movie/${m.id}?color=DC2626&autoplay=true`,
    label: "Vidy",
  };
  const sources = [vidySource, ...dbSources];
  const path = `${canonical}/watch`;
  const label = `${m.title}${m.year ? ` (${m.year})` : ""}`;
  const crumbs: [string, string][] = [["Home", "/"], ["Movies", "/movies"], [label, canonical], ["Watch", path]];
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbLd(site.url, crumbs)} />
      <Crumbs items={crumbs} />
      <div className="watch-head">
        <div><span className="eyebrow">Movie{m.runtime ? ` · ${fmtRuntime(m.runtime)}` : ""}{d.certification ? ` · ${d.certification}` : ""}</span><h1>Watch {m.title}</h1></div>
        <Link className="section-link" href={canonical}>Details, cast &amp; reviews &rarr;</Link>
      </div>
      <Player sources={sources} title={m.title} poster={img(m.backdropPath, "w1280")} />
      <Ad slot="content-bottom" page="watch" />
      <Providers data={d.providers} title={m.title} />
    </div>
  );
}

// ------------------------------------------------------------------ Episode
export async function episodeWatchMetadata(segment: string, seasonSeg: string, epSeg: string) {
  const { t, name, season, e, epPath } = await loadEpisode(segment, seasonSeg, epSeg);
  const sources = await videoSources("episode", e.id);
  return buildMeta({
    title: `Watch ${name} Season ${season.seasonNumber} Episode ${e.episodeNumber}${e.name ? `: ${e.name}` : ""}`,
    path: `${epPath}/watch`, index: t.isIndexable && e.isIndexable,
    description: `Watch ${name} ${code(season.seasonNumber, e.episodeNumber)}${e.name ? ` "${e.name}"` : ""}${e.airDate ? `, first aired ${fmtDate(e.airDate)}` : ""}. Episode list and other ways to watch.`,
    ogType: "video.episode", image: img(e.stillPath, "w780"),
  });
}

export async function EpisodeWatchPage({ segment, seasonSeg, epSeg }: { segment: string; seasonSeg: string; epSeg: string }) {
  const { t, d, canonical, name, season, episodes, e, next, path, epPath } = await loadEpisode(segment, seasonSeg, epSeg);
  const site = await getSite();
  const sn = season.seasonNumber;
  const dbSources = await videoSources("episode", e.id);
  // TODO: for anime, if AniList ID is available (e.g. in detail JSON or a new column), use /anime/{anilistId}/{episode}
  const vidySource: PlayableSource = {
    id: -1,
    kind: "iframe",
    url: `https://vidy.st/tv/${t.id}/${sn}/${e.episodeNumber}?nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true&color=DC2626`,
    label: "Vidy",
  };
  const sources = [vidySource, ...dbSources];
  const playable = await episodesWithVideo(episodes.map((x) => x.id));
  const watchPath = `${epPath}/watch`;
  const seasonLabel = sn === 0 ? "Specials" : `Season ${sn}`;
  const crumbs: [string, string][] = [["Home", "/"], ["TV Shows", "/tv"], [name, canonical], [seasonLabel, path], [`Episode ${e.episodeNumber}`, epPath], ["Watch", watchPath]];
  const nextHasVideo = next ? (await prisma.videoSource.count({ where: { mediaType: "episode", tmdbId: next.id, enabled: true } })) > 0 : false;
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbLd(site.url, crumbs)} />
      <Crumbs items={crumbs} />
      <div className="watch-head">
        <div><span className="eyebrow">{name} · {code(sn, e.episodeNumber)}</span><h1>{seasonLabel} Episode {e.episodeNumber}{e.name ? `: ${e.name}` : ""}</h1></div>
        <Link className="section-link" href={epPath}>Episode details &rarr;</Link>
      </div>
      <div className="detail" style={{ paddingTop: 0 }}>
        <div>
          <Player sources={sources} title={`${name} ${code(sn, e.episodeNumber)}`} poster={img(e.stillPath, "w1280")} />
          {next && (
            <nav className="ep-nav" style={{ marginTop: 16 }} aria-label="Next episode">
              <span />
              <Link className="next" href={`${paths.episode(t.id, t.slug, next.seasonNumber, next.episodeNumber)}${nextHasVideo ? "/watch" : ""}`}>
                <small>Next episode &rarr;</small><strong>{code(next.seasonNumber, next.episodeNumber)}{next.name ? `: ${next.name}` : ""}</strong>
              </Link>
            </nav>
          )}
          <Ad slot="content-bottom" page="watch" />
          <Providers data={d.providers} title={`${name} ${seasonLabel}`} />
        </div>
        <aside className="side" aria-label={`${seasonLabel} episodes`}>
          <div className="side-block"><h2>{seasonLabel} · {episodes.length} episodes</h2>
            <ol className="side-eps">
              {episodes.map((x) => {
                const inner = <><span>E{String(x.episodeNumber).padStart(2, "0")}</span>{x.name ?? `Episode ${x.episodeNumber}`}</>;
                if (!x.hasPage) return <li key={x.id}><span className="muted" style={{ display: "grid", gridTemplateColumns: "30px 1fr", gap: 8, padding: 8, fontSize: 14 }}>{inner}</span></li>;
                const base = paths.episode(t.id, t.slug, sn, x.episodeNumber);
                return <li key={x.id}><Link href={playable.has(x.id) ? `${base}/watch` : base} aria-current={x.id === e.id ? "page" : undefined}>{inner}</Link></li>;
              })}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
