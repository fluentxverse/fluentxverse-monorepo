# Tutor About Illustrations

The About page extends the homepage's custom illustration family with three
transparent raster assets. Original PNGs are in `output/imagegen/tutor-about/`;
the page loads 384px WebP versions from `public/assets/img/about-icons/`.
Homepage schedule, growth, community, and training artwork is reused.

Generated with the built-in image generator using this shared art direction:

> Premium website icon, refined tactile ivory porcelain, cobalt blue #0245ae
> satin enamel, mint #4cc6a6 frosted glass, tiny restrained brass detail.
> Isometric three-quarter front view, soft upper-left studio light, crisp
> silhouette readable at 64px. Square canvas centered whole object filling
> 76%, 12% transparent padding. No text, numbers, lettering, logos,
> surroundings, backdrop, platform, particles. Truly transparent alpha
> background with subtle contact shadow only. Not plastic emoji or flat vector.

Subjects:

- `globe-v1`: miniature ivory globe with cobalt continents and a mint orbit
  linking two small speech bubbles, representing global language connection.
- `innovation-v1`: mint frosted-glass light bulb, ivory base and brass filament,
  cradled in a cobalt enamel open book; no glow outside the object.
- `location-v1`: ivory folded map with mint paths and a cobalt location pin
  with a brass center; no text or specific geographic outlines.

WebP conversion: `magick source.png -resize 384x384 -quality 86 target.webp`.
Browser coverage: `tests/browser/aboutPage.cjs` checks mobile/tablet/desktop,
light-mode boot, hidden selectors, preserved preferences, image transparency,
nonblank image pixels, and horizontal overflow.
