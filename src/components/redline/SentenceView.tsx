'use client';

/** The sentence with the replaceable span underlined. Falls back to plain text if the span isn't found. */
export default function SentenceView({ sentence, span }: { sentence: string; span: string | null }) {
  const at = span ? sentence.indexOf(span) : -1;
  if (!span || at === -1) return <p className="font-serif text-xl leading-relaxed text-exam-ink">{sentence}</p>;
  return (
    <p className="font-serif text-xl leading-relaxed text-exam-ink">
      {sentence.slice(0, at)}
      <span className="underline decoration-exam-gold decoration-2 underline-offset-[5px]">{span}</span>
      {sentence.slice(at + span.length)}
    </p>
  );
}
