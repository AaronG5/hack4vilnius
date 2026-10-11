// Files a resident attaches to a report or to an answer: photos, videos or
// audio clips, taken with the camera or picked from the gallery, each one
// removable before sending. The strip that shows them is
// `components/AttachmentStrip.tsx`.

import { useCallback, useEffect, useRef, useState } from "react";

/** Everything a sheet needs to collect files; see `AttachmentStrip` for the UI. */
export interface Attachments {
  files: File[];
  /** Adds what a file input produced, up to the limit. */
  add: (picked: FileList | null) => void;
  remove: (file: File) => void;
  clear: () => void;
  /** Object URL for an image, or undefined for anything not worth previewing. */
  previewFor: (file: File) => string | undefined;
}

/**
 * @param max    How many files one submission may carry.
 * @param onFull Called when a pick is turned away because the limit is reached.
 */
export function useAttachments(max: number, onFull?: (max: number) => void): Attachments {
  const [files, setFiles] = useState<File[]>([]);
  // Previews live as long as their file; all of them are released on unmount.
  const previews = useRef(new Map<File, string>());

  useEffect(() => {
    const open = previews.current;
    return () => {
      for (const url of open.values()) URL.revokeObjectURL(url);
      open.clear();
    };
  }, []);

  const previewFor = useCallback((file: File): string | undefined => {
    if (!file.type.startsWith("image/")) return undefined;
    let url = previews.current.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      previews.current.set(file, url);
    }
    return url;
  }, []);

  const add = useCallback(
    (picked: FileList | null) => {
      // Copy now: callers clear the input right after, which empties the live
      // FileList before React runs the updater below.
      const chosen = picked ? [...picked] : [];
      if (!chosen.length) return;
      setFiles((current) => {
        const room = max - current.length;
        if (room <= 0) {
          onFull?.(max);
          return current;
        }
        const fresh = chosen.filter(
          (file) => !current.some((had) => had.name === file.name && had.size === file.size),
        );
        if (fresh.length > room) onFull?.(max);
        return [...current, ...fresh.slice(0, room)];
      });
    },
    [max, onFull],
  );

  const forget = useCallback((file: File) => {
    const url = previews.current.get(file);
    if (url) {
      URL.revokeObjectURL(url);
      previews.current.delete(file);
    }
  }, []);

  const remove = useCallback(
    (file: File) => {
      forget(file);
      setFiles((current) => current.filter((had) => had !== file));
    },
    [forget],
  );

  const clear = useCallback(() => {
    setFiles((current) => {
      for (const file of current) forget(file);
      return [];
    });
  }, [forget]);

  return { files, add, remove, clear, previewFor };
}

/** Photos, videos or audio clips one report or one answer may carry. */
export const MAX_ATTACHMENTS = 5;
