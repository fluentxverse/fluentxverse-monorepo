import './HomeIllustration.css';

type HomeIllustrationName = 'schedule' | 'home' | 'pay' | 'training' | 'community' | 'growth';

interface HomeIllustrationProps {
  name: HomeIllustrationName;
  loading?: 'eager' | 'lazy';
}

export default function HomeIllustration({ name, loading = 'lazy' }: HomeIllustrationProps) {
  return (
    <img
      className="home-illustration"
      src={`/assets/img/home-icons/${name}-v1.webp`}
      width={384}
      height={384}
      alt=""
      aria-hidden="true"
      loading={loading}
      decoding="async"
    />
  );
}
