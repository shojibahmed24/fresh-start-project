import { m } from "framer-motion";

interface Props {
  text: string;
  accent?: string; // last word(s) get the gradient
  className?: string;
}

/**
 * Word-by-word reveal heading. Splits text on whitespace and staggers
 * each word in with a y-translate + blur cleanup. Optionally renders
 * the trailing `accent` portion with the brand gradient on its own line.
 */
export const HeroReveal = ({ text, accent, className }: Props) => {
  const words = text.split(/\s+/);
  const accentWords = accent ? accent.split(/\s+/) : [];

  const variants = {
    hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { delay: i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    }),
  };

  return (
    <h1 className={className}>
      <span className="inline-block">
        {words.map((w, i) => (
          <m.span
            key={`w-${i}`}
            custom={i}
            variants={variants}
            initial="hidden"
            animate="show"
            className="inline-block mr-[0.25em]"
          >
            {w}
          </m.span>
        ))}
      </span>
      {accent && (
        <>
          <br className="hidden sm:block" />
          <span className="inline-block">
            {accentWords.map((w, i) => (
              <m.span
                key={`a-${i}`}
                custom={words.length + i}
                variants={variants}
                initial="hidden"
                animate="show"
                className="inline-block mr-[0.25em] text-gradient"
              >
                {w}
              </m.span>
            ))}
          </span>
        </>
      )}
    </h1>
  );
};
