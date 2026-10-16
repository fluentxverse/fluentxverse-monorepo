# Tutor Contact Illustrations

The Contact page uses the homepage's community, training, schedule, payment,
and home artwork alongside two new custom support icons.
Original transparent PNGs: `output/imagegen/tutor-contact/`.
Deployed 384px WebP files: `public/assets/img/contact-icons/`.

Shared built-in image generation prompt:

> Premium website icon matching a refined tactile 3D illustration family:
> ivory porcelain, cobalt blue #0245ae satin enamel, mint #4cc6a6 frosted glass,
> tiny restrained brass detail. Isometric three-quarter front view, soft
> upper-left studio light, crisp silhouette readable at 64px. Square canvas
> centered whole object filling 76%, 12% transparent padding. No text, numbers,
> lettering, logos, surroundings, backdrop, platform, particles. Truly
> transparent alpha background with subtle contact shadow only. Not plastic
> emoji or flat vector.

- `email-v1`: open cobalt envelope with an ivory letter and mint speech-bubble
  seal; no lettering on the letter.
- `phone-v1`: cobalt smartphone with an ivory screen, mint speech bubble,
  and small brass earpiece; no brand logos or screen text.

Conversion: `magick source.png -resize 384x384 -quality 86 target.webp`.
`tests/browser/contactPage.cjs` covers responsive layouts, light-mode boot,
hidden theme selectors, preserved preferences, image pixels and transparency,
email/application links, and the disabled placeholder Viber contact.
