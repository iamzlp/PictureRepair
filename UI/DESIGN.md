---
name: Nostalgic Professional
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#504441'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#827470'
  outline-variant: '#d4c3be'
  surface-tint: '#77574d'
  primary: '#442a22'
  on-primary: '#ffffff'
  primary-container: '#5d4037'
  on-primary-container: '#d4ada1'
  inverse-primary: '#e7bdb1'
  secondary: '#5e604d'
  on-secondary: '#ffffff'
  secondary-container: '#e1e1c9'
  on-secondary-container: '#636451'
  tertiary: '#002e68'
  on-tertiary: '#ffffff'
  tertiary-container: '#004493'
  on-tertiary-container: '#90b5ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#e7bdb1'
  on-primary-fixed: '#2c160e'
  on-primary-fixed-variant: '#5d4037'
  secondary-fixed: '#e4e4cc'
  secondary-fixed-dim: '#c8c8b0'
  on-secondary-fixed: '#1b1d0e'
  on-secondary-fixed-variant: '#474836'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc7ff'
  on-tertiary-fixed: '#001a41'
  on-tertiary-fixed-variant: '#004493'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  headline-lg:
    fontFamily: Newsreader
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
  headline-md:
    fontFamily: Newsreader
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  headline-sm:
    fontFamily: Newsreader
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  headline-lg-mobile:
    fontFamily: Newsreader
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  margin-page: 20px
  gutter: 12px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

The brand personality bridges the gap between cherished memories and cutting-edge restoration technology. It evokes an emotional response of warmth, reverence, and technical reliability. The target audience includes individuals preserving family legacies, requiring an interface that feels as precious as the photographs themselves while remaining intuitively functional within the WeChat ecosystem.

The UI style is a **Tactile-Modern hybrid**. It utilizes subtle paper textures and grain overlays to ground the digital experience in the physical world of analog photography. This is balanced with a high degree of "Professionalism" through structured layouts, precise line-work icons, and a sophisticated color palette that avoids "retro kitsch" in favor of "museum-quality preservation."

## Colors

The palette is rooted in the "Nostalgic Professional" theme:
- **Deep Sepia (Primary):** Used for primary branding, heavy typography, and structural elements to ground the app in a photographic history context.
- **Warm Creams (Secondary/Background):** The base of the application uses varying tones of cream and off-white to mimic aged photo paper and archival mats, reducing eye strain compared to pure white.
- **Trustworthy Tech-Blue (Tertiary):** Reserved exclusively for high-priority actions, restoration progress indicators, and "AI-powered" feature highlights to signal modern reliability.
- **Accents:** Muted tan and gold tones are used for decorative elements and "Premium" status indicators.

## Typography

This design system employs a dual-typeface strategy to reinforce the "Nostalgic Professional" narrative:
- **Serif Accents (Newsreader):** Used for headlines and section titles to provide an authoritative, editorial, and historical feel. It mimics the typography found in old newspapers and photo albums.
- **Clean Sans-Serif (Manrope):** Used for all functional UI elements, body text, and labels. Its modern, balanced geometric shapes ensure high readability on mobile screens and maintain the "Tech" side of the brand promise.
- **Hierarchy:** Maintain high contrast between Serif headlines and Sans-Serif body text to guide the user through the restoration workflow.

## Layout & Spacing

The layout follows a fluid-grid philosophy optimized for WeChat Mini Program dimensions (usually 375pt width). 
- **Margins:** A generous 20px side margin is maintained to create an "album-like" framing effect for the content.
- **Rhythm:** An 8px baseline grid ensures vertical consistency. 
- **Safe Areas:** Adhere strictly to WeChat's top navigation bar and bottom "home indicator" safe areas.
- **Mobile-First Reflow:** Content should stack vertically, prioritizing the "Before/After" photo viewer which should take up at least 60% of the viewport height on the primary restoration screen.

## Elevation & Depth

Visual hierarchy is conveyed through **Tonal Layers** and **Ambient Shadows**:
- **Base Layer:** The "Warm Cream" background features a subtle, non-tiling paper grain texture.
- **Surface Layer:** White or light-cream cards sit atop the background with very soft, diffused shadows (Blur: 15px, Y: 4px, Color: Sepia-tinted black at 8% opacity).
- **Interactive Depth:** Buttons use a slight inner shadow when pressed to mimic physical depression.
- **Overlay Layer:** Modal dialogs use a backdrop blur (10px) paired with a 40% opacity sepia-toned scrim to maintain the nostalgic atmosphere even during modern UI interactions.

## Shapes

The shape language is "Rounded," reflecting the friendly and accessible nature of WeChat apps while remaining professional.
- **Standard Elements:** Buttons and input fields use a 0.5rem (8px) radius.
- **Cards & Images:** Use a 1rem (16px) radius to create a soft, photographic print aesthetic.
- **Avatars & Chips:** Utilize pill-shaped (full-round) geometry to distinguish them from functional content containers.
- **Framing:** Large image previews may occasionally use a "deckle edge" or thin white border to simulate physical photo prints.

## Components

- **Action Buttons:** Primary buttons use the "Trustworthy Tech-Blue" with white text for clear conversion. Secondary buttons use a Deep Sepia outline with a subtle cream fill.
- **Comparison Slider:** A bespoke component for this design system, featuring a thin vertical line with a circular handle to swipe between "Before" and "After" states.
- **Instructional Chips:** Small, semi-transparent labels used over images (e.g., "AI Enhancing...") utilizing the label-sm typography.
- **Process List:** A vertical stepper with line-art icons. Completed steps use the tech-blue, while pending steps use a muted sepia.
- **Photo Cards:** Elegant containers with a thin 1px border (#E0D7C6) and the standard soft shadow, designed to house user uploads and restored results.
- **Line Icons:** Use a consistent 2px stroke weight with rounded caps. Icons should represent "Clarity," "Colorize," and "Sharpen" using clean, modern metaphors to signify technical precision.