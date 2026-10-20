import React from 'react';
import { Play } from 'lucide-react';
import { Track } from '../../types';
import { usePlayerStore } from '../../store/playerStore';

interface TrackCardProps {
  track: Track;
  allTracks?: Track[];
}

export const TrackCard: React.FC<TrackCardProps> = ({ track, allTracks }) => {
  const { playTrack, currentTrack, isPlaying } = usePlayerStore();
  const isCurrent = currentTrack?.id === track.id;

  return (
    <div
      onClick={() => playTrack(track, allTracks)}
      className="group relative bg-spotify-card hover:bg-spotify-cardHover p-4 rounded-xl cursor-pointer transition-all duration-300 shadow-md hover:shadow-xl flex flex-col select-none"
    >
      {/* Artwork container */}
      <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-3 bg-neutral-800 shadow-lg">
        <img
          src={track.artworkUrl}
          alt={track.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80';
          }}
        />

        {/* Floating Play Button */}
        <div
          className={`absolute bottom-3 right-3 w-12 h-12 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-xl transition-all duration-300 transform ${
            isCurrent && isPlaying
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105'
          }`}
        >
          <Play className="w-5 h-5 fill-black stroke-black ml-0.5" />
        </div>
      </div>

      {/* Info */}
      <h3
        className={`font-bold text-sm truncate mb-1 ${
          isCurrent ? 'text-spotify-green' : 'text-white'
        }`}
      >
        {track.title}
      </h3>
      <p className="text-xs text-spotify-subtext truncate font-medium">
        {track.artist}
      </p>
    </div>
  );
};
