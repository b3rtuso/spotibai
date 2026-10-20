import { EqualizerPreset, Track } from '../../types';

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS: EqualizerPreset[] = [
  { id: 'flat', name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'bass_boost', name: 'Bass Boost', gains: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0] },
  { id: 'bass_reducer', name: 'Bass Reducer', gains: [-7, -6, -5, -3, -1, 0, 0, 0, 0, 0] },
  { id: 'electronic', name: 'Electronic / EDM', gains: [5, 4, 2, 0, -2, 2, 1, 3, 4, 5] },
  { id: 'rock', name: 'Rock', gains: [5, 3, 2, 1, -1, -1, 1, 2, 4, 5] },
  { id: 'pop', name: 'Pop', gains: [-1, 1, 3, 4, 4, 3, 1, 0, -1, -2] },
  { id: 'vocal_boost', name: 'Vocal Boost', gains: [-3, -2, -1, 2, 5, 5, 4, 2, 0, -2] },
  { id: 'acoustic', name: 'Acoustic', gains: [3, 2, 1, 1, 2, 2, 2, 3, 3, 2] },
  { id: 'treble_boost', name: 'Treble Boost', gains: [-3, -2, -1, 0, 1, 2, 4, 6, 7, 8] },
  { id: 'hiphop', name: 'Hip-Hop', gains: [6, 5, 3, 2, -1, 0, 1, -1, 3, 4] },
  { id: 'dance', name: 'Dance', gains: [6, 5, 3, 1, 0, 2, 3, 4, 4, 2] },
  { id: 'classical', name: 'Classical', gains: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4] },
];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private audioA: HTMLAudioElement;
  private audioB: HTMLAudioElement;
  private currentAudioIndex: 0 | 1 = 0; // 0 for audioA, 1 for audioB

  private sourceNodeA: MediaElementAudioSourceNode | null = null;
  private sourceNodeB: MediaElementAudioSourceNode | null = null;
  private gainNodeA: GainNode | null = null;
  private gainNodeB: GainNode | null = null;

  private eqFilters: BiquadFilterNode[] = [];
  private vocalFilter: BiquadFilterNode | null = null;
  private isVocalMuted = false;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private currentTrack: Track | null = null;
  private isInitialized = false;
  private volume = 0.8;
  private isMuted = false;
  public crossfadeDuration = 2; // seconds
  private crossfadeTimeout: ReturnType<typeof setTimeout> | null = null;
  private isOutgoing: [boolean, boolean] = [false, false];

  // AI Demucs Karaoke Stem Playback
  private stemInstrumentalAudio: HTMLAudioElement;
  private stemVocalsAudio: HTMLAudioElement;
  private stemInstrumentalSource: MediaElementAudioSourceNode | null = null;
  private stemVocalsSource: MediaElementAudioSourceNode | null = null;
  private stemInstrumentalGain: GainNode | null = null;
  private stemVocalsGain: GainNode | null = null;
  private isStemModeActive = false;
  private vocalLevel = 1.0; // 0.0 to 1.0 (0% - 100%)

  // Callbacks
  public onTimeUpdate?: (currentTime: number, duration: number) => void;
  public onPlayStateChange?: (isPlaying: boolean) => void;
  public onTrackEnded?: () => void;
  public onError?: (err: any) => void;

  constructor() {
    this.audioA = new Audio();
    this.audioB = new Audio();
    this.audioA.volume = 1.0;
    this.audioB.volume = 1.0;
    this.setupAudioElement(this.audioA, 0);
    this.setupAudioElement(this.audioB, 1);

    this.stemInstrumentalAudio = new Audio();
    this.stemVocalsAudio = new Audio();
    this.stemInstrumentalAudio.volume = 1.0;
    this.stemVocalsAudio.volume = 1.0;
    this.setupStemElement(this.stemInstrumentalAudio, true);
    this.setupStemElement(this.stemVocalsAudio, false);

    // Auto-resume suspended AudioContext when tab becomes active again
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      });
    }
  }

  private cancelCrossfade() {
    if (this.crossfadeTimeout) {
      clearTimeout(this.crossfadeTimeout);
      this.crossfadeTimeout = null;
    }
  }

  public finalizeCrossfade() {
    this.cancelCrossfade();
    const outgoingIndex: 0 | 1 = this.currentAudioIndex === 0 ? 1 : 0;
    const outgoingAudio = outgoingIndex === 0 ? this.audioA : this.audioB;
    const outgoingGain = outgoingIndex === 0 ? this.gainNodeA : this.gainNodeB;
    const activeGain = this.currentAudioIndex === 0 ? this.gainNodeA : this.gainNodeB;

    this.isOutgoing[outgoingIndex] = true;
    try {
      outgoingAudio.pause();
      outgoingAudio.currentTime = 0;
    } catch {
      // ignore
    }
    if (outgoingGain && this.ctx) {
      try {
        outgoingGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch {
        // ignore
      }
    }
    if (activeGain && this.ctx) {
      try {
        activeGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      } catch {
        // ignore
      }
    }
    this.isOutgoing[outgoingIndex] = false;
  }

  private async safePlay(audio: HTMLAudioElement): Promise<boolean> {
    try {
      await audio.play();
      return true;
    } catch (err: any) {
      // Gracefully suppress AbortError / DOMException: play request interrupted by pause
      if (
        err?.name === 'AbortError' ||
        err?.name === 'NotAllowedError' ||
        err?.message?.includes('pause') ||
        err?.message?.includes('interrupted')
      ) {
        return false;
      }
      console.warn('HTMLAudioElement play() warning:', err);
      return false;
    }
  }

  private setupAudioElement(audio: HTMLAudioElement, index: 0 | 1) {
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';

    const notifyTime = () => {
      if (this.isOutgoing[index]) return;
      if (this.currentAudioIndex === index && this.onTimeUpdate) {
        const cur = Number.isFinite(audio.currentTime) && !isNaN(audio.currentTime) && audio.currentTime >= 0
          ? audio.currentTime
          : 0;
        const dur =
          Number.isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0
            ? audio.duration
            : (this.currentTrack?.duration && Number.isFinite(this.currentTrack.duration) && this.currentTrack.duration > 0
              ? this.currentTrack.duration
              : 180);
        this.onTimeUpdate(cur, dur);
      }
    };

    audio.addEventListener('timeupdate', notifyTime);
    audio.addEventListener('loadedmetadata', notifyTime);
    audio.addEventListener('durationchange', notifyTime);
    audio.addEventListener('canplay', notifyTime);

    audio.addEventListener('play', () => {
      if (this.isOutgoing[index]) return;
      if (this.currentAudioIndex === index && this.onPlayStateChange) {
        this.onPlayStateChange(true);
      }
    });

    audio.addEventListener('pause', () => {
      if (this.isOutgoing[index]) return;
      if (this.currentAudioIndex === index && this.onPlayStateChange) {
        this.onPlayStateChange(false);
      }
    });

    audio.addEventListener('ended', () => {
      if (this.isOutgoing[index]) return;
      if (this.currentAudioIndex === index && this.onTrackEnded) {
        this.onTrackEnded();
      }
    });

    audio.addEventListener('error', (e) => {
      if (this.isOutgoing[index]) return;
      // If error happened with crossOrigin anonymous, retry direct without crossOrigin
      if (audio.crossOrigin) {
        audio.removeAttribute('crossOrigin');
        audio.load();
        audio.play().catch(() => {});
        return;
      }
      if (this.currentAudioIndex === index && this.onError) {
        console.warn('Audio element error:', e);
        this.onError(e);
      }
    });
  }

  private setupStemElement(audio: HTMLAudioElement, isMaster: boolean) {
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';

    if (isMaster) {
      const notifyTime = () => {
        if (!this.isStemModeActive) return;
        if (this.onTimeUpdate) {
          const cur = Number.isFinite(audio.currentTime) && !isNaN(audio.currentTime) && audio.currentTime >= 0
            ? audio.currentTime
            : 0;
          const dur = Number.isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0
            ? audio.duration
            : (this.currentTrack?.duration || 180);
          this.onTimeUpdate(cur, dur);
        }
        this.correctStemDrift();
      };

      audio.addEventListener('timeupdate', notifyTime);
      audio.addEventListener('loadedmetadata', notifyTime);
      audio.addEventListener('durationchange', notifyTime);
      audio.addEventListener('canplay', notifyTime);

      audio.addEventListener('play', () => {
        if (this.isStemModeActive && this.onPlayStateChange) this.onPlayStateChange(true);
      });
      audio.addEventListener('pause', () => {
        if (this.isStemModeActive && this.onPlayStateChange) this.onPlayStateChange(false);
      });
      audio.addEventListener('ended', () => {
        if (this.isStemModeActive && this.onTrackEnded) this.onTrackEnded();
      });
    }

    audio.addEventListener('error', () => {
      if (audio.crossOrigin) {
        audio.removeAttribute('crossOrigin');
        audio.load();
        audio.play().catch(() => {});
      }
    });
  }

  private correctStemDrift() {
    if (!this.isStemModeActive || this.stemInstrumentalAudio.paused) return;
    const diff = Math.abs(this.stemVocalsAudio.currentTime - this.stemInstrumentalAudio.currentTime);
    if (diff > 0.04) {
      this.stemVocalsAudio.currentTime = this.stemInstrumentalAudio.currentTime;
    }
  }

  private initAudioContext() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;

      // Analyser for 60fps Visualizer
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.82;

      // Build 10-Band EQ Filters
      this.eqFilters = EQ_FREQUENCIES.map((freq, idx) => {
        const filter = this.ctx!.createBiquadFilter();
        if (idx === 0) {
          filter.type = 'lowshelf';
        } else if (idx === EQ_FREQUENCIES.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.4;
        }
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });

      // Chain EQ Filters together: filter[0] -> filter[1] -> ... -> filter[9]
      for (let i = 0; i < this.eqFilters.length - 1; i++) {
        this.eqFilters[i].connect(this.eqFilters[i + 1]);
      }

      // Build Vocal Suppression Filter (Apple Music Sing / Beat Mode)
      this.vocalFilter = this.ctx.createBiquadFilter();
      this.vocalFilter.type = 'peaking';
      this.vocalFilter.frequency.value = 1100;
      this.vocalFilter.Q.value = 1.0;
      this.vocalFilter.gain.value = this.isVocalMuted ? -26 : 0;

      // Connect last EQ filter -> Vocal Filter -> Master Gain -> Analyser -> Destination
      const lastFilter = this.eqFilters[this.eqFilters.length - 1];
      lastFilter.connect(this.vocalFilter);
      this.vocalFilter.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Connect Audio A
      this.sourceNodeA = this.ctx.createMediaElementSource(this.audioA);
      this.gainNodeA = this.ctx.createGain();
      this.gainNodeA.gain.value = 1.0;
      this.sourceNodeA.connect(this.gainNodeA);
      this.gainNodeA.connect(this.eqFilters[0]);

      // Connect Audio B
      this.sourceNodeB = this.ctx.createMediaElementSource(this.audioB);
      this.gainNodeB = this.ctx.createGain();
      this.gainNodeB.gain.value = 0.0;
      this.sourceNodeB.connect(this.gainNodeB);
      this.gainNodeB.connect(this.eqFilters[0]);

      // Connect Stem Instrumental
      this.stemInstrumentalSource = this.ctx.createMediaElementSource(this.stemInstrumentalAudio);
      this.stemInstrumentalGain = this.ctx.createGain();
      this.stemInstrumentalGain.gain.value = 1.0;
      this.stemInstrumentalSource.connect(this.stemInstrumentalGain);
      this.stemInstrumentalGain.connect(this.eqFilters[0]);

      // Connect Stem Vocals
      this.stemVocalsSource = this.ctx.createMediaElementSource(this.stemVocalsAudio);
      this.stemVocalsGain = this.ctx.createGain();
      this.stemVocalsGain.gain.value = this.vocalLevel;
      this.stemVocalsSource.connect(this.stemVocalsGain);
      this.stemVocalsGain.connect(this.eqFilters[0]);

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API hardware nodes initialization failed (may run direct):', e);
    }
  }

  public async resumeContext() {
    this.initAudioContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public async playTrack(track: Track, startTime = 0) {
    if (this.isStemModeActive) {
      this.unloadKaraokeStems(false);
    }
    this.finalizeCrossfade();
    await this.resumeContext();
    this.currentTrack = track;

    // Pick active and incoming audio elements
    const activeAudio = this.currentAudioIndex === 0 ? this.audioA : this.audioB;
    const incomingAudio = this.currentAudioIndex === 0 ? this.audioB : this.audioA;
    const activeGain = this.currentAudioIndex === 0 ? this.gainNodeA : this.gainNodeB;
    const incomingGain = this.currentAudioIndex === 0 ? this.gainNodeB : this.gainNodeA;
    const outgoingIndex = this.currentAudioIndex;
    const incomingIndex: 0 | 1 = outgoingIndex === 0 ? 1 : 0;

    // If crossfade is enabled and current track is already playing:
    if (this.crossfadeDuration > 0 && !activeAudio.paused && activeAudio.currentTime > 0) {
      // Crossfade transition:
      // 1. Prepare incoming
      let src = track.audioBlob ? URL.createObjectURL(track.audioBlob) : (track.audioUrl || track.previewUrl || '');
      incomingAudio.src = src;
      incomingAudio.currentTime = Math.max(0, startTime);

      if (this.ctx && activeGain && incomingGain) {
        const now = this.ctx.currentTime;
        const fade = this.crossfadeDuration;

        // Mark outgoing channel so it cannot send timeupdate or pause events
        this.isOutgoing[outgoingIndex] = true;
        // Switch active index immediately to incoming
        this.currentAudioIndex = incomingIndex;

        // Fade out active cleanly without clicks/pops
        activeGain.gain.setValueAtTime(activeGain.gain.value, now);
        activeGain.gain.linearRampToValueAtTime(0.001, now + fade);

        // Fade in incoming starting audibly from 0.4 to 1.0 smoothly
        incomingGain.gain.setValueAtTime(0.4, now);
        incomingGain.gain.linearRampToValueAtTime(1.0, now + fade);

        // Immediately report the new track's start time to prevent stale >3s timestamps
        if (this.onTimeUpdate) {
          const trackDur = track.duration && Number.isFinite(track.duration) && track.duration > 0
            ? track.duration
            : 180;
          this.onTimeUpdate(startTime, trackDur);
        }

        await this.safePlay(incomingAudio);

        this.crossfadeTimeout = setTimeout(() => {
          this.crossfadeTimeout = null;
          try {
            activeAudio.pause();
            activeAudio.currentTime = 0;
          } catch {
            // ignore
          }
          if (activeGain && this.ctx) {
            try {
              activeGain.gain.setValueAtTime(0, this.ctx.currentTime);
            } catch {
              // ignore
            }
          }
          this.isOutgoing[outgoingIndex] = false;
        }, fade * 1000);
      } else {
        // Fallback without crossfade nodes
        this.isOutgoing[outgoingIndex] = true;
        try {
          activeAudio.pause();
        } catch {
          // ignore
        }
        this.isOutgoing[outgoingIndex] = false;

        const fallbackSrc = track.audioBlob ? URL.createObjectURL(track.audioBlob) : (track.audioUrl || track.previewUrl || '');
        activeAudio.src = fallbackSrc;
        activeAudio.currentTime = Math.max(0, startTime);
        await this.safePlay(activeAudio);
      }
    } else {
      // Immediate play on activeAudio
      const src = track.audioBlob ? URL.createObjectURL(track.audioBlob) : (track.audioUrl || track.previewUrl || '');
      activeAudio.src = src;
      activeAudio.currentTime = Math.max(0, startTime);
      if (activeGain && this.ctx) {
        try {
          activeGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        } catch {
          activeGain.gain.value = 1.0;
        }
      }
      await this.safePlay(activeAudio);
    }

    this.updateMediaSession(track);
  }

  public pause() {
    this.cancelCrossfade();
    try {
      this.audioA.pause();
      this.audioB.pause();
      if (this.isStemModeActive) {
        this.stemInstrumentalAudio.pause();
        this.stemVocalsAudio.pause();
      }
    } catch {
      // ignore
    }
  }

  public async play(trackFallback?: Track, startTimeFallback?: number): Promise<boolean> {
    await this.resumeContext();
    if (this.isStemModeActive) {
      const [p1, p2] = await Promise.all([
        this.safePlay(this.stemInstrumentalAudio),
        this.safePlay(this.stemVocalsAudio)
      ]);
      return p1 || p2;
    }
    const activeAudio = this.currentAudioIndex === 0 ? this.audioA : this.audioB;
    const isBlank = !activeAudio.src || activeAudio.src === '' || (typeof window !== 'undefined' && activeAudio.src === window.location?.href);
    const targetTrack = this.currentTrack || trackFallback;
    if (isBlank && targetTrack) {
      const startTime = Number.isFinite(startTimeFallback) ? startTimeFallback! : (activeAudio.currentTime || 0);
      await this.playTrack(targetTrack, startTime);
      return !activeAudio.paused;
    }
    const ok = await this.safePlay(activeAudio);
    return ok;
  }

  public async togglePlay(): Promise<boolean> {
    if (this.isStemModeActive) {
      if (this.stemInstrumentalAudio.paused) {
        return await this.play();
      } else {
        this.pause();
        return false;
      }
    }
    const activeAudio = this.currentAudioIndex === 0 ? this.audioA : this.audioB;
    if (activeAudio.paused) {
      return await this.play();
    } else {
      this.pause();
      return false;
    }
  }

  public seek(timeInSeconds: number) {
    this.finalizeCrossfade();
    if (!Number.isFinite(timeInSeconds) || isNaN(timeInSeconds) || timeInSeconds < 0) {
      timeInSeconds = 0;
    }

    if (this.isStemModeActive) {
      try {
        this.stemInstrumentalAudio.currentTime = timeInSeconds;
        this.stemVocalsAudio.currentTime = timeInSeconds;
      } catch (err) {
        console.warn('Stem seek error:', err);
      }
      return;
    }

    const activeAudio = this.currentAudioIndex === 0 ? this.audioA : this.audioB;
    const rawDur = activeAudio.duration;
    const safeDur = Number.isFinite(rawDur) && !isNaN(rawDur) && rawDur > 0
      ? rawDur
      : (this.currentTrack?.duration && Number.isFinite(this.currentTrack.duration) && this.currentTrack.duration > 0
        ? this.currentTrack.duration
        : 0);

    let targetTime = timeInSeconds;
    if (safeDur > 0) {
      targetTime = Math.min(targetTime, safeDur);
    }
    targetTime = Math.max(0, targetTime);
    if (Number.isFinite(targetTime)) {
      try {
        activeAudio.currentTime = targetTime;
      } catch (err) {
        console.warn('AudioEngine seek error:', err);
      }
    }
  }

  public setVolume(vol: number) {
    if (!Number.isFinite(vol) || isNaN(vol)) vol = 0.8;
    this.volume = Math.max(0, Math.min(1, vol));
    const targetGain = this.isMuted ? 0 : this.volume;

    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
      } catch {
        this.masterGain.gain.value = targetGain;
      }
      // Audio elements remain at 1.0 unity gain to prevent double attenuation (vol^2)
      this.audioA.volume = 1.0;
      this.audioB.volume = 1.0;
    } else {
      // Fallback when Web Audio masterGain is unavailable
      this.audioA.volume = targetGain;
      this.audioB.volume = targetGain;
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    this.setVolume(this.volume);
  }

  public setPlaybackRate(rate: number) {
    this.audioA.playbackRate = rate;
    this.audioB.playbackRate = rate;
  }

  public setVocalMuted(muted: boolean) {
    this.isVocalMuted = muted;
    this.setVocalLevel(muted ? 0 : 100);
  }

  public async loadKaraokeStems(vocalsUrl: string, instrumentalUrl: string, startTime = 0, shouldPlay = true) {
    await this.resumeContext();
    this.cancelCrossfade();
    try {
      this.audioA.pause();
      this.audioB.pause();
    } catch {}

    this.isStemModeActive = true;
    this.stemInstrumentalAudio.src = instrumentalUrl;
    this.stemVocalsAudio.src = vocalsUrl;

    this.stemInstrumentalAudio.currentTime = Math.max(0, startTime);
    this.stemVocalsAudio.currentTime = Math.max(0, startTime);

    if (this.stemVocalsGain && this.ctx) {
      this.stemVocalsGain.gain.setValueAtTime(this.vocalLevel, this.ctx.currentTime);
    }
    if (this.stemInstrumentalGain && this.ctx) {
      this.stemInstrumentalGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    }

    if (shouldPlay) {
      await Promise.all([
        this.safePlay(this.stemInstrumentalAudio),
        this.safePlay(this.stemVocalsAudio)
      ]);
    }
  }

  public unloadKaraokeStems(resumeSingleTrack = true, currentTime = 0) {
    if (!this.isStemModeActive) return;
    this.isStemModeActive = false;
    try {
      this.stemInstrumentalAudio.pause();
      this.stemVocalsAudio.pause();
    } catch {}

    if (resumeSingleTrack && this.currentTrack) {
      this.seek(currentTime);
      this.play(this.currentTrack, currentTime);
    }
  }

  public setVocalLevel(level: number) {
    // level: 0 to 100
    this.vocalLevel = Math.max(0, Math.min(100, level)) / 100;
    if (this.stemVocalsGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.stemVocalsGain.gain.cancelScheduledValues(now);
      this.stemVocalsGain.gain.linearRampToValueAtTime(this.vocalLevel, now + 0.04);
    }

    // In single-track mode, smoothly modulate the vocalFilter peaking notch filter
    if (this.vocalFilter && this.ctx) {
      const attenDb = (1 - this.vocalLevel) * -28;
      try {
        this.vocalFilter.gain.setValueAtTime(attenDb, this.ctx.currentTime);
      } catch {
        this.vocalFilter.gain.value = attenDb;
      }
    }
  }

  public getIsStemMode(): boolean {
    return this.isStemModeActive;
  }

  public getVocalLevel(): number {
    return Math.round(this.vocalLevel * 100);
  }

  public setEqBandGain(bandIndex: number, gainDb: number) {
    if (this.eqFilters[bandIndex] && this.ctx) {
      const clampedGain = Math.max(-12, Math.min(12, gainDb));
      this.eqFilters[bandIndex].gain.setValueAtTime(clampedGain, this.ctx.currentTime);
    }
  }

  public applyPreset(preset: EqualizerPreset) {
    preset.gains.forEach((gain, idx) => {
      this.setEqBandGain(idx, gain);
    });
  }

  public getVisualizerData(): { frequency: Uint8Array; waveform: Uint8Array } {
    if (!this.analyser) {
      return {
        frequency: new Uint8Array(64).fill(0),
        waveform: new Uint8Array(64).fill(128),
      };
    }
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    const waveData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);
    this.analyser.getByteTimeDomainData(waveData);
    return { frequency: freqData, waveform: waveData };
  }

  private updateMediaSession(track: Track) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'Spotibai',
        artwork: [
          { src: track.artworkUrl, sizes: '512x512', type: 'image/jpeg' },
          { src: track.artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: track.artworkUrl, sizes: '96x96', type: 'image/jpeg' },
        ],
      });
    }
  }

  public bindMediaSessionActions(handlers: {
    onPlay: () => void;
    onPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    onSeek: (seconds: number) => void;
  }) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => handlers.onPlay());
    navigator.mediaSession.setActionHandler('pause', () => handlers.onPause());
    navigator.mediaSession.setActionHandler('nexttrack', () => handlers.onNext());
    navigator.mediaSession.setActionHandler('previoustrack', () => handlers.onPrev());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        handlers.onSeek(details.seekTime);
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const activeAudio = this.currentAudioIndex === 0 ? this.audioA : this.audioB;
      handlers.onSeek(activeAudio.currentTime + (details.seekOffset || 10));
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const activeAudio = this.currentAudioIndex === 0 ? this.audioA : this.audioB;
      handlers.onSeek(Math.max(0, activeAudio.currentTime - (details.seekOffset || 10)));
    });
  }

  public getCurrentTime(): number {
    const activeAudio = this.currentAudioIndex === 0 ? this.audioA : this.audioB;
    const cur = activeAudio.currentTime;
    return Number.isFinite(cur) && !isNaN(cur) && cur >= 0 ? cur : 0;
  }

  public getDuration(): number {
    const activeAudio = this.currentAudioIndex === 0 ? this.audioA : this.audioB;
    const dur = activeAudio.duration;
    if (Number.isFinite(dur) && !isNaN(dur) && dur > 0) {
      return dur;
    }
    return this.currentTrack?.duration && Number.isFinite(this.currentTrack.duration) && this.currentTrack.duration > 0
      ? this.currentTrack.duration
      : 180;
  }
}

export const audioEngine = new AudioEngine();
