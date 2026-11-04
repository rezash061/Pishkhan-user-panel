import type { SVGProps } from "react";

/** Instagram glyph (lucide-react no longer ships brand icons). */
export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

/** Bale (بله): a speech bubble with a check, a generic mark rather than the brand's logo. */
export function BaleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.9A8.5 8.5 0 1 1 21 11.5Z" />
      <path d="m8.5 11.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

/** The icon of a channel kind; Instagram when unknown. */
export function ChannelIcon({ kind, ...props }: SVGProps<SVGSVGElement> & { kind: string | null | undefined }) {
  return kind === "bale" ? <BaleIcon {...props} /> : <InstagramIcon {...props} />;
}
