import React, { useEffect } from 'react';
import { youTubeEngine } from '../../services/youtube/YouTubeEngine';

export const YouTubePlayerContainer: React.FC = () => {
  useEffect(() => {
    youTubeEngine.mountPlayer('spotibai-yt-player');
  }, []);

  return null;
};
