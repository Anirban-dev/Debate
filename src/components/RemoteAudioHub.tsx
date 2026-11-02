'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { MatchRoomState } from '@/types';

interface RemoteAudioHubProps {
  roomState: MatchRoomState | null;
  remoteStreams: Record<string, MediaStream>;
  currentUsername?: string | null;
}

interface RemoteAudioProps {
  userKey: string;
  stream: MediaStream;
  muted: boolean;
  unlockTick: number;
  onBlockedChange: (userKey: string, blocked: boolean) => void;
}

// One hidden <audio> element per remote person. Lives for as long as the stream exists,
// independent of which video tiles happen to be on screen.
const RemoteAudio: React.FC<RemoteAudioProps> = ({ userKey, stream, muted, unlockTick, onBlockedChange }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }
    audio.muted = muted;
    audio.volume = 1;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => onBlockedChange(userKey, false))
        .catch(() => onBlockedChange(userKey, true));
    }
  }, [stream, muted, unlockTick, userKey, onBlockedChange]);

  // Forget this user's "blocked" status when their audio element goes away
  useEffect(() => {
    return () => onBlockedChange(userKey, false);
  }, [userKey, onBlockedChange]);

  return <audio ref={audioRef} autoPlay playsInline />;
};

/**
 * Plays the voice of every remote participant exactly once.
 * Browsers block audio until the page has had a click/keypress, so if playback is
 * blocked this shows a small "enable sound" button and retries on the next interaction.
 */
export const RemoteAudioHub: React.FC<RemoteAudioHubProps> = ({ roomState, remoteStreams, currentUsername }) => {
  const [unlockTick, setUnlockTick] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const blockedUsers = useRef<Set<string>>(new Set());

  const onBlockedChange = useCallback((userKey: string, blocked: boolean) => {
    if (blocked) blockedUsers.current.add(userKey);
    else blockedUsers.current.delete(userKey);
    setBlockedCount(blockedUsers.current.size);
  }, []);

  // Any click / key press while audio is blocked retries playback
  useEffect(() => {
    const retry = () => {
      if (blockedUsers.current.size > 0) setUnlockTick((t) => t + 1);
    };
    window.addEventListener('pointerdown', retry);
    window.addEventListener('keydown', retry);
    return () => {
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('keydown', retry);
    };
  }, []);

  const players = roomState?.players || {};
  const me = (currentUsername || '').toLowerCase();

  const entries = Object.entries(remoteStreams).filter(([key]) => key !== me && !!players[key]);

  return (
    <>
      {entries.map(([key, stream]) => (
        <RemoteAudio
          key={key}
          userKey={key}
          stream={stream}
          muted={!!players[key].isMuted}
          unlockTick={unlockTick}
          onBlockedChange={onBlockedChange}
        />
      ))}

      {blockedCount > 0 && (
        <button
          type="button"
          onClick={() => setUnlockTick((t) => t + 1)}
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-2xl animate-pulse"
        >
          <Volume2 className="w-4 h-4" />
          Click here to enable sound
        </button>
      )}
    </>
  );
};
