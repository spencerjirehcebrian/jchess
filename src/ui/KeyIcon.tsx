import { useGameStore } from "../store";
import { ICONS, IconName } from "../render/voxel/icons";
import { THEMES, inkPalette } from "../render/voxel/palette";
import { voxelSpriteUrl } from "../render/voxel/sprite";

/**
 * A legend printed on a keycap.
 *
 * Always beside its word, never instead of it. Partly because the machine this
 * is imitating had text on its keys and an icon-only keypad is the web pattern
 * it is trying not to be — and partly because the specs identify these buttons
 * by their accessible names, which is exactly the property an icon-only control
 * throws away. `alt=""` keeps the picture out of the name.
 *
 * No hover state. A screen-printed legend does not change colour when a finger
 * approaches it, and the key underneath already lights. Disabled is handled for
 * free by the button's own opacity.
 */
export function KeyIcon({ name }: { name: IconName }) {
  const themeId = useGameStore((s) => s.theme) ?? "lacquer";
  const theme = THEMES[themeId] ?? THEMES.lacquer!;

  const url = voxelSpriteUrl(
    `icon-${name}`,
    ICONS[name],
    inkPalette(theme.cssTokens),
    // 8 voxels at 2 device pixels each: 16px, even, so it centres on a whole
    // pixel in the 40px key. No halo — an icon only ever sits on one surface.
    // The lit face tints toward the theme's sheen rather than shading the rest
    // down, because on a dark key shading down is contrast spent, not gained.
    { pixel: 2, halo: false, litTint: theme.white.base },
  );
  if (!url) return null;

  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      width={16}
      height={16}
      style={{
        imageRendering: "pixelated",
        display: "block",
        flexShrink: 0,
      }}
    />
  );
}
