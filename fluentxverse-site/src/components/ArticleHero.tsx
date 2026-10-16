type ArticleHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  alt: string;
  caption: string;
  subjectPosition?: 'left' | 'right';
};

export function ArticleHero(props: ArticleHeroProps) {
  return (
    <section class="article-hero" classList={{ 'article-hero-person-left': props.subjectPosition === 'left', 'article-hero-person-right': props.subjectPosition === 'right' }} aria-labelledby="article-title">
      <img class="article-hero-photo" src={props.image} alt={props.alt} width="1122" height="630" fetchpriority="high" />
      <div class="article-hero-wash" />
      <div class="container article-hero-content">
        <span class="eyebrow">{props.eyebrow}</span>
        <h1 id="article-title">{props.title}<span class="brand-period">.</span></h1>
        <p>{props.description}</p>
      </div>
      <div class="container article-hero-caption">{props.caption}</div>
    </section>
  );
}
