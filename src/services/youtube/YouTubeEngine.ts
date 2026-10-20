declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const INVIDIOUS_INSTANCES = [
  'https://invidious.f5.si',
  'https://invidious.nerdvpn.de',
  'https://invidious.private.coffee',
  'https://iv.nboeck.de',
];

export class YouTubeEngine {
  private player: any = null;
  private isReady = false;
  private isMounted = false;
  private timeUpdateInterval: any = null;
  private pendingVideoId: string | null = null;
  public currentVideoId: string | null = null;
  private videoCache = new Map<string, string>();
  private isPlayingDesired = false;

  public onTimeUpdate?: (currentTime: number, duration: number) => void;
  public onPlayStateChange?: (isPlaying: boolean) => void;
  public onTrackEnded?: () => void;
  public onError?: (err: any) => void;

  constructor() {
    this.initApi();
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && (!this.isMounted || !this.player)) {
          this.mountPlayer('spotibai-yt-player');
        }
        if (this.isPlayingDesired && this.player && typeof this.player.playVideo === 'function') {
          setTimeout(() => {
            if (this.isPlayingDesired && this.player && typeof this.player.playVideo === 'function') {
              try {
                this.player.playVideo();
              } catch {}
            }
          }, 50);
        }
      });
    }
  }

  private initApi() {
    if (typeof window === 'undefined') return;

    if (window.YT && window.YT.Player) {
      this.isReady = true;
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      this.isReady = true;
      if (!this.isMounted && typeof document !== 'undefined') {
        this.mountPlayer('spotibai-yt-player');
      }
      if (this.pendingVideoId && this.player && typeof this.player.loadVideoById === 'function') {
        const vid = this.pendingVideoId;
        this.pendingVideoId = null;
        this.loadVideoById(vid);
      }
    };
  }

  public mountPlayer(containerId: string) {
    if (typeof window === 'undefined') return;
    if (this.isMounted && this.player) return;

    if (!window.YT || !window.YT.Player) {
      setTimeout(() => this.mountPlayer(containerId), 250);
      return;
    }

    const targetEl = document.getElementById(containerId);
    if (!targetEl) {
      setTimeout(() => this.mountPlayer(containerId), 250);
      return;
    }

    try {
      this.isMounted = true;
      this.player = new window.YT.Player(containerId, {
        height: '100%',
        width: '100%',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            this.player = event.target || this.player;
            this.isReady = true;
            try {
              if (this.player && typeof this.player.unMute === 'function') {
                this.player.unMute();
              }
            } catch {
              // ignore
            }
            if (this.pendingVideoId) {
              const vid = this.pendingVideoId;
              this.pendingVideoId = null;
              this.loadVideoById(vid);
            }
          },
          onStateChange: (event: any) => {
            const state = event.data;
            // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
            if (state === 1) {
              this.isPlayingDesired = true;
              this.startTimeTracking();
              if (this.onPlayStateChange) this.onPlayStateChange(true);
            } else if (state === 2) {
              // If the browser backgrounded the tab or throttled iframe execution while playback was active:
              if (this.isPlayingDesired && typeof document !== 'undefined' && document.hidden) {
                // Attempt immediate resume and do NOT broadcast false to playerStore
                setTimeout(() => {
                  if (this.isPlayingDesired && this.player && typeof this.player.playVideo === 'function') {
                    try {
                      this.player.playVideo();
                    } catch {}
                  }
                }, 80);
                return;
              }
              this.isPlayingDesired = false;
              this.stopTimeTracking();
              if (this.onPlayStateChange) this.onPlayStateChange(false);
            } else if (state === 0) {
              this.isPlayingDesired = false;
              this.stopTimeTracking();
              if (this.onPlayStateChange) this.onPlayStateChange(false);
              if (this.onTrackEnded) this.onTrackEnded();
            }
          },
          onError: (e: any) => {
            console.warn('YouTube Player notice:', e);
            if (this.onError) this.onError(e);
          },
        },
      });
    } catch (e) {
      console.warn('Failed mounting YouTube player:', e);
    }
  }

  /**
   * Resolves a song query (e.g. "Coldplay Yellow") to a YouTube video ID using Vite endpoint or public fallbacks
   */
  public async resolveVideoId(query: string): Promise<string | null> {
    const normalized = query.trim().toLowerCase();
    if (this.videoCache.has(normalized)) {
      return this.videoCache.get(normalized)!;
    }

    // 1. Primary: Local Vite dev proxy / Vercel Serverless API search
    try {
      const res = await fetch(`/api/yt-search?q=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.videoId) {
          this.videoCache.set(normalized, data.videoId);
          return data.videoId;
        }
      }
    } catch {
      // fallback
    }

    // 2. Secondary: Public Invidious instances via CORS proxy to avoid browser CORS blocks
    for (const inst of INVIDIOUS_INSTANCES) {
      try {
        const targetUrl = `${inst}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data[0] && data[0].videoId) {
            this.videoCache.set(normalized, data[0].videoId);
            return data[0].videoId;
          }
        }
      } catch {
        // try next instance
      }
    }
    return null;
  }

  /**
   * Preloads a video ID in the background to ensure 0ms instant playback when switching songs
   */
  public async preloadVideoId(query: string): Promise<string | null> {
    const audioQuery = query.toLowerCase().includes('audio') || query.toLowerCase().includes('lyrics')
      ? query
      : `${query} audio`;
    const normalized = audioQuery.trim().toLowerCase();
    if (this.videoCache.has(normalized)) {
      return this.videoCache.get(normalized)!;
    }
    const vid = await this.resolveVideoId(audioQuery);
    if (vid) {
      this.videoCache.set(query.trim().toLowerCase(), vid);
    }
    return vid;
  }

  public async searchAndPlay(query: string): Promise<string | null> {
    const audioQuery = query.toLowerCase().includes('audio') || query.toLowerCase().includes('lyrics')
      ? query
      : `${query} audio`;
    let videoId = await this.resolveVideoId(audioQuery);
    if (!videoId && audioQuery !== query) {
      videoId = await this.resolveVideoId(query);
    }
    if (videoId) {
      this.loadVideoById(videoId);
      return videoId;
    } else {
      console.warn('Could not resolve video ID for query:', query);
      return null;
    }
  }

  /**
   * Searches for and plays the instrumental / karaoke beat version of the track at the exact current second
   */
  public async searchAndPlayInstrumental(query: string, startTime = 0): Promise<string | null> {
    const instrumentalQueries = [
      `${query} instrumental`,
      `${query} karaoke backing track`,
      `${query} beat instrumental`,
      `${query} karaoke`,
    ];
    for (const q of instrumentalQueries) {
      const vid = await this.resolveVideoId(q);
      if (vid && vid !== this.currentVideoId) {
        this.loadVideoById(vid, startTime);
        return vid;
      }
    }
    return null;
  }

  public loadVideoById(videoId: string, startTime = 0) {
    this.currentVideoId = videoId;
    this.isPlayingDesired = true;
    if (!this.player || typeof this.player.loadVideoById !== 'function') {
      this.pendingVideoId = videoId;
      if (!this.isMounted && typeof document !== 'undefined') {
        this.mountPlayer('spotibai-yt-player');
      }
      return;
    }
    try {
      if (typeof this.player.unMute === 'function') {
        this.player.unMute();
      }
      this.player.loadVideoById({
        videoId,
        startSeconds: startTime,
      });
      if (typeof this.player.playVideo === 'function') {
        this.player.playVideo();
      }
      this.startTimeTracking();
    } catch (err) {
      console.warn('Error loading video by ID:', err);
    }
  }

  public play() {
    this.isPlayingDesired = true;
    try {
      if (this.player && typeof this.player.playVideo === 'function') {
        if (typeof this.player.unMute === 'function') this.player.unMute();
        this.player.playVideo();
        this.startTimeTracking();
      }
    } catch (err) {
      console.warn('Error playing video:', err);
    }
  }

  public pause() {
    this.isPlayingDesired = false;
    try {
      if (this.player && typeof this.player.pauseVideo === 'function') {
        this.player.pauseVideo();
      }
    } catch (err) {
      console.warn('Error pausing video:', err);
    }
  }

  public togglePlay(): boolean {
    if (!this.player || typeof this.player.getPlayerState !== 'function') {
      return false;
    }
    try {
      const state = this.player.getPlayerState();
      if (state === 1) {
        this.pause();
        return false;
      } else {
        this.play();
        return true;
      }
    } catch {
      return false;
    }
  }

  public seekTo(seconds: number) {
    if (!Number.isFinite(seconds) || isNaN(seconds) || seconds < 0) {
      seconds = 0;
    }
    try {
      if (this.player && typeof this.player.seekTo === 'function') {
        this.player.seekTo(seconds, true);
      }
    } catch (err) {
      console.warn('Error seeking video:', err);
    }
  }

  private rawVolume = 1.0;
  private eqScale = 1.0;

  public setVolume(volume: number) {
    this.rawVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.8));
    this.applyEffectiveVolume();
  }

  public setEqScale(scale: number) {
    this.eqScale = Math.max(0.2, Math.min(2.0, scale));
    this.applyEffectiveVolume();
  }

  private applyEffectiveVolume() {
    try {
      if (this.player && typeof this.player.setVolume === 'function') {
        if (typeof this.player.unMute === 'function') this.player.unMute();
        const effective = Math.round(Math.min(100, Math.max(0, this.rawVolume * this.eqScale * 100)));
        this.player.setVolume(effective);
      }
    } catch (err) {
      console.warn('Error setting volume:', err);
    }
  }

  public setMute(muted: boolean) {
    if (!this.player) return;
    try {
      if (muted && typeof this.player.mute === 'function') {
        this.player.mute();
      } else if (!muted && typeof this.player.unMute === 'function') {
        this.player.unMute();
      }
    } catch (err) {
      console.warn('Error setting mute:', err);
    }
  }

  public getCurrentTime(): number {
    try {
      const cur = this.player && typeof this.player.getCurrentTime === 'function'
        ? this.player.getCurrentTime()
        : 0;
      return Number.isFinite(cur) && !isNaN(cur) && cur >= 0 ? cur : 0;
    } catch {
      return 0;
    }
  }

  public getDuration(): number {
    try {
      const dur = this.player && typeof this.player.getDuration === 'function'
        ? this.player.getDuration()
        : 0;
      return Number.isFinite(dur) && !isNaN(dur) && dur > 0 ? dur : 0;
    } catch {
      return 0;
    }
  }

  private startTimeTracking() {
    this.stopTimeTracking();
    this.timeUpdateInterval = setInterval(() => {
      try {
        if (this.player && typeof this.player.getCurrentTime === 'function' && this.onTimeUpdate) {
          const rawCur = this.player.getCurrentTime();
          const rawDur = this.player.getDuration();
          const cur = Number.isFinite(rawCur) && !isNaN(rawCur) && rawCur >= 0 ? rawCur : 0;
          const dur = Number.isFinite(rawDur) && !isNaN(rawDur) && rawDur > 0 ? rawDur : 0;
          this.onTimeUpdate(cur, dur);
        }
      } catch {
        // ignore
      }
    }, 250);
  }

  private stopTimeTracking() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }
}

export const youTubeEngine = new YouTubeEngine();
