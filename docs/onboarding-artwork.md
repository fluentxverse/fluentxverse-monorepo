# Onboarding Artwork

Generated with the built-in image generation tool, with transparent backgrounds. Runtime exports are 360x360 WebP files with alpha, about 24 KB each. Original PNGs are preserved in `output/imagegen/onboarding-icons-20261028/`. The selected runtime assets are stored in both apps' `public/assets/img/home-icons/` directories to honor the shared artwork contract.

## Assets

Runtime directory: `fluentxverse-tutor-solid-prototype/public/assets/img/home-icons/`.
Matching shared-artwork copies: `fluentxverse-student-solid-prototype/public/assets/img/home-icons/`.

- `written-test-v1.webp`: written assessment clipboard and pencil.
- `speaking-test-v1.webp`: microphone and speech bubble.
- `contact-check-v1.webp`: phone, profile silhouette and check badge.
- `interview-guide-v1.webp`: open guide book and conversation symbol.

Tutor Home uses these through `shared/appArtwork.ts`. Interview result and booking use the existing `schedule-v1.webp`. Full-size card illustrations have no background tile; small functional status symbols remain unchanged. Assessment scores, grading, actions and approval rules are not changed.

## Generation Prompts

### Written Test

Use case: stylized-concept. Asset type: one polished 3D application icon for FluentXVerse tutor onboarding, WRITTEN ENGLISH TEST. Subject: a single royal-blue clipboard with a warm white sheet, three simple embossed blue answer lines and a mint checkmark, a small golden yellow pencil resting diagonally at the lower-right. Match a premium existing set of friendly miniature glossy 3D education icons: rich cobalt/royal blue enamel, ivory paper, small gold metal trim, subtle mint secondary accents, softly rounded substantial forms, realistic studio highlights and soft ambient shadows. Three-quarter view facing slightly right, fully visible centered isolated object filling about 85 percent of a square canvas. Designed to remain recognizable at 44 pixels. True transparent alpha background, no solid backdrop, no floor plane, no enclosing rounded-square tile. No letters, text, numbers, logos or watermark. Only this one icon.

### Speaking Test

Use case: stylized-concept. Asset type: one polished 3D application icon for FluentXVerse tutor onboarding, SPEAKING ENGLISH TEST. Subject: a friendly compact royal-blue desktop microphone in a blue U-shaped stand, a warm ivory rounded microphone grille with fine gold horizontal grille details, a small mint speech bubble tucked at the right with three simple raised ivory dots. Match a premium set of miniature glossy 3D education icons: rich cobalt/royal blue enamel, ivory, small gold metal trim, restrained mint accents; softly rounded substantial forms, clean studio highlights and gentle ambient shadows. Three-quarter front view facing slightly right, entire object centered and fully visible filling 85 percent of a square canvas, recognizable at 44 pixels. Actual transparent alpha background. No backdrop, no floor plane, no square tile around the icon. No letters, numbers, text, logos, watermark or extra objects.

### Contact Details

Use case: stylized-concept. Asset type: one polished miniature 3D application icon for FluentXVerse tutor onboarding, VERIFIED CONTACT DETAILS. Subject: a royal-blue smartphone standing slightly tilted, with gold edge trim and a warm ivory screen containing a simple embossed blue generic person silhouette; a small mint-green circular badge with a clear ivory checkmark overlaps the lower-right of the phone. Match premium friendly glossy 3D education icons: cobalt and royal blue enamel, warm ivory, tiny gold metal trim, mint secondary accent, rounded substantial forms, clean studio highlights, soft ambient shading. Three-quarter front view facing slightly right, centered fully visible object occupying 85 percent of a square canvas. This is a UI icon intended to read clearly at 44 pixels. True transparent alpha background, no backdrop or floor plane, no rounded-square containing tile. No actual human face, no letters, text, numbers, app brand logos, watermark or extra objects.

### Interview Guide

Use case: stylized-concept. Asset type: one polished miniature 3D application icon for FluentXVerse tutor onboarding, INTERVIEW PREPARATION GUIDE. Subject: an open hardcover book with a rich royal-blue cover, warm ivory curved pages with a few simple embossed blue lines, gold metal-edged cover corners, one mint ribbon bookmark hanging from the center. A small raised blue-and-gold speech bubble on the right page suggests interview conversation; no question mark or lettering. Match a premium friendly glossy 3D education icon family: cobalt/royal blue enamel, warm ivory, small gold trim, restrained mint accents, softly rounded substantial forms, clean studio highlights, soft ambient shading. Three-quarter front view facing slightly right, fully visible centered composition occupying 85 percent of square canvas. Readable silhouette at 44 pixels. Actual transparent alpha background; no backdrop, no floor plane, no rounded-square tile. No letters, words, numbers, logos or watermark. Only the book and its integrated bookmark and speech bubble.
