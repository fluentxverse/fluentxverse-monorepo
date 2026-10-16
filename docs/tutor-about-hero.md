# About Hero Artwork

The About hero uses generated illustrative photography of an online tutoring
session, not a portrait of actual FluentXVerse staff. Separate wide and mobile
compositions leave natural negative space for the hero copy. Original images
are retained under `output/imagegen/tutor-about-hero/`; deployed WebP images
are in `public/assets/img/banner/about-lesson-wide-v2.webp` and
`public/assets/img/banner/about-lesson-mobile-v1.webp`.

Wide art direction: bright editorial photo of a friendly Filipino woman tutor
in an ivory blouse and headset, teaching at a white desk. Silver laptop with
an adult Japanese learner on screen, blue notebook, mint cup. People and
devices on the right, uncluttered cool-white wall and desk on the left for
dark copy. Natural daylight, crisp faces/hands, no words, logos, dark overlay,
gradient, bokeh, or decorative particles.

Mobile art direction: portrait composition with the tutoring session in the
upper part and a continuous empty white desk foreground below for the text.
No collage or separate text panel.

The wide composition was revised with the image generator to move the entire
teaching scene into the middle horizontal strip on the right, leaving clear
space above and below for responsive banner crops. The previous wide draft is
retained as `wide-v1.png`; the selected revision is `wide-v2.png`.

Converted with ImageMagick at quality 86 (wide max 2048px, mobile max 900px).
`tests/browser/aboutHero.cjs` checks image selection/pixels, responsive fit,
light mode, visible next section, and the application and mission links.
