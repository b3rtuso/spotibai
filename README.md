# Spotibai 🎵
> A High-Fidelity Spotify-like Web Application & PWA with Premium Features for Everyday Listening.

Spotibai combines online streaming and discovery with local audio file imports (MP3, FLAC, WAV, M4A, OGG), backed by a studio-grade Web Audio DSP engine (10-band EQ, 60 FPS real-time visualizer, crossfade), synchronized karaoke lyrics, and complete offline download capabilities.

---

## ✨ Premium Features

### 1. 📥 Offline Downloads (Just like Spotify Premium)
* **One-Click Download**: Toggle download on individual tracks or entire playlists with a single click.
* **Persistent In-Browser Storage**: Complete audio streams and cover artworks are saved directly to your browser's persistent `IndexedDB` database.
* **Offline Mode Toggle**: Listen on flights or without internet connection—downloaded and local tracks play seamlessly without buffering.
* **Export MP3 to PC**: Bonus feature in the track `...` menu to save physical MP3 files straight into your operating system's `Downloads` folder!

### 2. 🎛️ 10-Band Equalizer & 60 FPS Visualizer (Studio DSP)
* **10-Band BiquadFilter Frequencies**: `32 Hz`, `64 Hz`, `125 Hz`, `250 Hz`, `500 Hz`, `1 kHz`, `2 kHz`, `4 kHz`, `8 kHz`, `16 kHz`.
* **12 Audio Presets**: *Flat*, *Bass Boost*, *Bass Reducer*, *Electronic / EDM*, *Rock*, *Pop*, *Vocal Boost*, *Acoustic*, *Treble Boost*, *Hip-Hop*, *Dance*, and *Classical*.
* **Real-time 60 FPS Visualizer**: Switch between dynamic **Spectrum Bars**, glowing **Oscilloscope Waveform**, or **Pulsing Beat Orb**.
* **Smooth Crossfade**: Configure between 0s and 10s of exponential volume crossfade between songs.

### 3. 🎤 Real-Time Synchronized Lyrics (LRCLIB API)
* **Karaoke Scrolling**: Large typography that smoothly auto-scrolls to the current singing line.
* **Active Line Glow**: Current line highlights with a vibrant glow against a blurred ambient album art backdrop.
* **Interactive Seeking**: Click any line of lyrics to jump playback immediately to that timestamp!

### 4. 📂 Local Music Importer (Drag & Drop)
* Drag and drop audio files (MP3, FLAC, WAV, M4A, OGG) or select folders from your PC.
* In-browser ID3 tag & embedded album cover art extraction via `music-metadata-browser`.
* 100% private: Audio files remain on your device and are never uploaded to any remote server.

### 5. 🎨 Authentic Spotify Dark UI & Ambient Glow
* Pixel-perfect Spotify desktop theme (`#121212`, `#181818`, `#242424`, `#1DB954` accents).
* **Dynamic Ambient Glow**: Extracts dominant color from the active album cover art to render a smooth top gradient.
* **Smart Queue & History**: Drag-and-drop reorder, clear queue, and "Now Playing" vs. "Up Next" preview.
* **Floating Mini-Player**: Picture-in-picture compact player widget.

### 6. ⌨️ Windows Media Session & Keyboard Shortcuts
Spotibai binds directly to your Windows hardware media keys and volume flyout.

| Shortcut | Action |
| :--- | :--- |
| `Space` | Play / Pause |
| `Ctrl + Right Arrow` | Next Track |
| `Ctrl + Left Arrow` | Previous Track |
| `Ctrl + Up / Down` | Volume Up / Down (+/- 10%) |
| `M` | Mute / Unmute Toggle |
| `L` | Toggle Synchronized Lyrics View |
| `E` | Toggle 10-Band Equalizer & Visualizer |
| `F` | Toggle Fullscreen Mode |

---

## 🚀 Getting Started

### 1. Launch Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 2. Build for Production
```bash
npm run build
```

### 3. Preview Production Build
```bash
npm run preview
```

---

## 📱 Installing as a Desktop PWA
Spotibai includes a full Web App Manifest and Service Worker:
1. Open Spotibai in Google Chrome, Microsoft Edge, or Brave.
2. Click the **Install** button in your browser's address bar (or menu > **Apps** > **Install Spotibai**).
3. Spotibai will now run in its own clean desktop window with native OS taskbar integration!
