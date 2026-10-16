type AboutIllustrationName = 'globe' | 'innovation' | 'location';

export default function AboutIllustration({ name }: { name: AboutIllustrationName }) {
  return (
    <img
      className="about-illustration"
      src={`/assets/img/about-icons/${name}-v1.webp`}
      width={384}
      height={384}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
    />
  );
}
