import { useEffect, useState } from "react";

/**
 * Typewriter effect — reveals text character-by-character.
 * For AI streaming responses or hero subtitles.
 *
 * If `text` updates (e.g., streaming), it appends new chars without re-typing.
 */
export const Typewriter = ({
  text,
  speed = 18,
  className,
  cursor = true,
}: {
  text: string;
  speed?: number;
  className?: string;
  cursor?: boolean;
}) => {
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (shown === text) return;
    if (!text.startsWith(shown)) {
      // text changed completely — reset
      setShown("");
      return;
    }
    const timer = setTimeout(() => {
      setShown(text.slice(0, shown.length + 1));
    }, speed);
    return () => clearTimeout(timer);
  }, [text, shown, speed]);

  return (
    <span className={className}>
      {shown}
      {cursor && shown.length < text.length && (
        <span
          className="inline-block w-[2px] h-[1em] bg-primary align-middle ml-0.5 animate-pulse"
          aria-hidden
        />
      )}
    </span>
  );
};
