/**
 * Spotibai Test Environment Mock Harness
 * Provides full, opaque-box simulation of Browser Audio, Web Audio API,
 * LocalStorage, IndexedDB (via fake-indexeddb), and Fetch.
 */
import 'fake-indexeddb/auto';
import { db, INITIAL_TRACKS, INITIAL_PLAYLISTS, initializeDatabase } from '../../src/services/db/database';

export class MockAudioElement {
  public src = '';
  public currentTime = 0;
  public duration = 180;
  public paused = true;
  public volume = 1.0;
  public muted = false;
  public crossOrigin = '';
  public preload = 'auto';

  private listeners: Record<string, Array<EventListenerOrEventListenerObject>> = {};

  public addEventListener(event: string, callback: EventListenerOrEventListenerObject) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  public removeEventListener(event: string, callback: EventListenerOrEventListenerObject) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
  }

  public dispatchEvent(event: { type: string } | Event): boolean {
    const type = event.type;
    const callbacks = this.listeners[type] || [];
    for (const cb of callbacks) {
      if (typeof cb === 'function') {
        cb(event as any);
      } else if (cb && typeof cb.handleEvent === 'function') {
        cb.handleEvent(event as any);
      }
    }
    return true;
  }

  public async play(): Promise<void> {
    this.paused = false;
    this.dispatchEvent({ type: 'play' });
    this.dispatchEvent({ type: 'playing' });
  }

  public pause(): void {
    this.paused = true;
    this.dispatchEvent({ type: 'pause' });
  }

  public emitTimeUpdate(current: number, dur?: number) {
    this.currentTime = current;
    if (dur !== undefined) this.duration = dur;
    this.dispatchEvent({ type: 'timeupdate' });
  }

  public emitEnded() {
    this.paused = true;
    this.dispatchEvent({ type: 'ended' });
  }

  public emitError(err: any) {
    this.dispatchEvent({ type: 'error', ...err });
  }

  public removeAttribute(attr: string) {
    if (attr === 'crossOrigin') this.crossOrigin = '';
  }

  public load(): void {}
}

export class MockAudioParam {
  public value: number;
  constructor(initial = 1.0) {
    this.value = initial;
  }
  public setValueAtTime(val: number, _time: number) {
    this.value = val;
  }
  public linearRampToValueAtTime(val: number, _time: number) {
    this.value = val;
  }
  public cancelScheduledValues(_time: number) {}
}

export class MockAudioNode {
  public connect(_target: any) {
    return _target;
  }
  public disconnect() {}
}

export class MockGainNode extends MockAudioNode {
  public gain = new MockAudioParam(1.0);
}

export class MockBiquadFilterNode extends MockAudioNode {
  public type = 'peaking';
  public frequency = new MockAudioParam(1000);
  public gain = new MockAudioParam(0);
  public Q = new MockAudioParam(1.0);
}

export class MockAnalyserNode extends MockAudioNode {
  public fftSize = 128;
  public frequencyBinCount = 64;
  public smoothingTimeConstant = 0.8;
  public getByteFrequencyData(array: Uint8Array) {
    array.fill(128);
  }
  public getByteTimeDomainData(array: Uint8Array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = 128 + Math.round(Math.sin(i) * 30);
    }
  }
}

export class MockAudioContext {
  public state: 'suspended' | 'running' = 'running';
  public currentTime = 0;
  public destination = new MockAudioNode();

  public createGain() {
    return new MockGainNode();
  }

  public createBiquadFilter() {
    return new MockBiquadFilterNode();
  }

  public createAnalyser() {
    return new MockAnalyserNode();
  }

  public createMediaElementSource(_element: any) {
    return new MockAudioNode();
  }

  public async resume() {
    this.state = 'running';
  }

  public async suspend() {
    this.state = 'suspended';
  }

  public async close() {}
}

export class MockLocalStorage implements Storage {
  private store: Record<string, string> = {};

  public getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  public setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  public removeItem(key: string): void {
    delete this.store[key];
  }

  public clear(): void {
    this.store = {};
  }

  public key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }

  public get length(): number {
    return Object.keys(this.store).length;
  }
}

export class MockMediaMetadata {
  public title = '';
  public artist = '';
  public album = '';
  public artwork: any[] = [];
  constructor(init: any = {}) {
    this.title = init.title || '';
    this.artist = init.artist || '';
    this.album = init.album || '';
    this.artwork = init.artwork || [];
  }
}

export class MockImage {
  public src = '';
  public crossOrigin = '';
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  constructor() {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

export function installGlobalBrowserMocks() {
  const g = globalThis as any;

  if (!g.window) {
    g.window = g;
  }

  // Global event listeners for browser libraries like canvas-confetti
  const globalListeners: Record<string, Function[]> = {};
  g.addEventListener = (event: string, cb: Function) => {
    if (!globalListeners[event]) globalListeners[event] = [];
    globalListeners[event].push(cb);
  };
  g.removeEventListener = (event: string, cb: Function) => {
    if (!globalListeners[event]) return;
    globalListeners[event] = globalListeners[event].filter((l) => l !== cb);
  };
  g.dispatchEvent = (event: any) => {
    const type = typeof event === 'string' ? event : event?.type;
    const listeners = globalListeners[type] || [];
    for (const cb of listeners) cb(event);
    return true;
  };
  g.window.addEventListener = g.addEventListener;
  g.window.removeEventListener = g.removeEventListener;
  g.window.dispatchEvent = g.dispatchEvent;

  // Audio & Web Audio
  g.Audio = MockAudioElement as any;
  g.window.Audio = MockAudioElement as any;
  g.AudioContext = MockAudioContext as any;
  g.window.AudioContext = MockAudioContext as any;
  g.webkitAudioContext = MockAudioContext as any;
  g.window.webkitAudioContext = MockAudioContext as any;

  // MediaSession & MediaMetadata
  g.MediaMetadata = MockMediaMetadata as any;
  g.window.MediaMetadata = MockMediaMetadata as any;

  // Image & Canvas
  g.Image = MockImage as any;
  g.window.Image = MockImage as any;

  // LocalStorage
  const storage = new MockLocalStorage();
  g.localStorage = storage;
  g.window.localStorage = storage;

  // Location
  g.window.location = {
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000/',
  };

  // URL createObjectURL
  if (!g.URL) g.URL = {} as any;
  let objectUrlCounter = 1;
  g.URL.createObjectURL = (_blob: any) => `blob:spotibai-mock://${objectUrlCounter++}`;
  g.URL.revokeObjectURL = (_url: string) => {};

  // Navigator MediaSession
  if (!g.navigator) g.navigator = {} as any;
  g.navigator.mediaSession = {
    metadata: null,
    setActionHandler: (_action: string, _handler: any) => {},
  };

  // DOM mocks
  const mockElement: any = {
    style: {},
    appendChild: () => {},
    removeChild: () => {},
    click: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    getBoundingClientRect: () => ({ width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100 }),
    clientWidth: 1024,
    clientHeight: 768,
  };

  const docListeners: Record<string, Function[]> = {};
  g.document = {
    addEventListener: (event: string, cb: Function) => {
      if (!docListeners[event]) docListeners[event] = [];
      docListeners[event].push(cb);
    },
    removeEventListener: (event: string, cb: Function) => {
      if (!docListeners[event]) return;
      docListeners[event] = docListeners[event].filter((l) => l !== cb);
    },
    dispatchEvent: (event: any) => {
      const type = typeof event === 'string' ? event : event?.type;
      const listeners = docListeners[type] || [];
      for (const cb of listeners) cb(event);
      return true;
    },
    documentElement: {
      clientWidth: 1024,
      clientHeight: 768,
      style: {},
    },
    createElement: (tag: string) => {
      if (tag === 'audio') return new MockAudioElement();
      if (tag === 'canvas') {
        return {
          ...mockElement,
          width: 40,
          height: 40,
          getContext: () =>
            new Proxy(
              {
                drawImage: () => {},
                getImageData: () => ({
                  data: new Uint8ClampedArray(40 * 40 * 4).fill(120),
                }),
                canvas: mockElement,
              },
              {
                get(target: any, prop: string) {
                  if (prop in target) return target[prop];
                  return () => {};
                },
              }
            ),
        };
      }
      return { ...mockElement, tagName: tag.toUpperCase() };
    },
    getElementById: (_id: string) => mockElement,
    getElementsByTagName: (_tag: string) => [{ parentNode: { insertBefore: () => {} } }],
    body: {
      appendChild: () => {},
      removeChild: () => {},
      clientWidth: 1024,
      clientHeight: 768,
    },
  };
  g.window.document = g.document;

  // Always install mock fetch to support relative audio and artwork URLs in Node
  g.fetch = async (input: any) => {
    const mockBlob = new Blob(['mock-audio-data-binary'], { type: 'audio/mpeg' });
    return {
      ok: true,
      status: 200,
      blob: async () => mockBlob,
      json: async () => [],
      text: async () => '',
    };
  };
  g.window.fetch = g.fetch;
}

export async function resetDatabaseAndStores() {
  await db.tracks.clear();
  await db.playlists.clear();
  await db.history.clear();
  await db.settings.clear();

  for (const track of INITIAL_TRACKS) {
    await db.tracks.put({ ...track });
  }
  for (const pl of INITIAL_PLAYLISTS) {
    await db.playlists.put({ ...pl });
  }

  // Clear localStorage
  globalThis.localStorage.clear();
}
