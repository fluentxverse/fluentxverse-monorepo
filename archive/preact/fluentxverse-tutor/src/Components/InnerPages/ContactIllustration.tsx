type ContactIllustrationName = 'email' | 'phone';

export default function ContactIllustration({ name }: { name: ContactIllustrationName }) {
  return (
    <img
      className="contact-illustration"
      src={`/assets/img/contact-icons/${name}-v1.webp`}
      width={384}
      height={384}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
    />
  );
}
