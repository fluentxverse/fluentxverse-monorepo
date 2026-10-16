import type { JSX } from 'preact';

export type TutorArtName = 'home' | 'schedule' | 'training' | 'community' | 'growth' | 'pay' | 'dispatch';

export default function TutorArt({ name, size = 40, className = '', ...props }: {
  name: TutorArtName; size?: number;
} & JSX.HTMLAttributes<HTMLImageElement>) {
  return <img {...props} className={`tutor-art ${className}`} src={`/assets/img/home-icons/${name === 'dispatch' ? 'dispatch-v1.png' : name + '-v1.webp'}`}
    width={size} height={size} alt="" aria-hidden="true" style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />;
}
