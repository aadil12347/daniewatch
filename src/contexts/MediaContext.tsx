import React from 'react';
import { createContext, useContext, useState, ReactNode } from 'react';

interface CurrentMedia {
  title: string;
  type: 'movie' | 'tv';
  tmdbId: number;
  seasonNumber?: number;
}

interface MediaContextType {
  currentMedia: CurrentMedia | null;
  setCurrentMedia: (media: CurrentMedia | null) => void;
  clearCurrentMedia: () => void;
  isVideoPlaying: boolean;
  setIsVideoPlaying: (playing: boolean) => void;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export const MediaProvider = ({ children }: { children: ReactNode }) => {
  const [currentMedia, setCurrentMedia] = useState<CurrentMedia | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const clearCurrentMedia = () => setCurrentMedia(null);

  return (
    <MediaContext.Provider value={{ 
      currentMedia, 
      setCurrentMedia, 
      clearCurrentMedia,
      isVideoPlaying,
      setIsVideoPlaying
    }}>
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => {
  const context = useContext(MediaContext);
  if (context === undefined) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
};
