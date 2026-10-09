import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { mediaUrl } from '../../utils/mediaUrl';

export default function ProfileAvatar({ src, alt, className, fallbackClassName, style, fallback }: {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  style?: JSX.CSSProperties;
  fallback: ComponentChildren;
}) {
  const url = mediaUrl(src);
  const [failedUrl, setFailedUrl] = useState<string>();
  if (!url || failedUrl === url) return <div className={[className, fallbackClassName].filter(Boolean).join(' ')} style={style} role="img" aria-label={alt}>{fallback}</div>;
  return <img key={url} src={url} alt={alt} className={className} style={style} onError={() => setFailedUrl(url)} />;
}
