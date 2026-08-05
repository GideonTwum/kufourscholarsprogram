"""Generate Kufuor Scholars (KS) favicon and app icons from brand colors."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
APP = ROOT / "app"
ROYAL = (0x14, 0x53, 0x2D)
GOLD = (0xC8, 0xA9, 0x51)


def load_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        Path(r"C:\Windows\Fonts\arialbd.ttf"),
        Path(r"C:\Windows\Fonts\segoeuib.ttf"),
        Path(r"C:\Windows\Fonts\calibrib.ttf"),
        Path(r"C:\Windows\Fonts\arial.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def make_icon(size: int, radius_ratio: float = 0.18) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = max(2, int(size * radius_ratio))
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=ROYAL)

    font_size = int(size * 0.42)
    font = load_font(font_size)
    text = "KS"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1] - size * 0.02
    draw.text((x, y), text, font=font, fill=GOLD)
    return img


def main() -> None:
    PUBLIC.mkdir(exist_ok=True)
    APP.mkdir(exist_ok=True)

    targets = {
        PUBLIC / "icon-32x32.png": 32,
        PUBLIC / "icon-192.png": 192,
        PUBLIC / "icon-512.png": 512,
        PUBLIC / "apple-touch-icon.png": 180,
        APP / "icon.png": 512,
        APP / "apple-icon.png": 180,
    }

    for path, size in targets.items():
        make_icon(size).save(path, "PNG", optimize=True)
        print(f"wrote {path} ({size}x{size})")

    # Multi-resolution favicon
    ico_path_app = APP / "favicon.ico"
    ico_path_public = PUBLIC / "favicon.ico"
    make_icon(32).save(
        ico_path_app,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    make_icon(32).save(
        ico_path_public,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print(f"wrote {ico_path_app}")
    print(f"wrote {ico_path_public}")

    svg = """<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="92" fill="#14532D"/>
  <text x="256" y="330" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="700" font-size="220" fill="#C8A951">KS</text>
</svg>
"""
    (PUBLIC / "icon.svg").write_text(svg, encoding="utf-8")
    print(f"wrote {PUBLIC / 'icon.svg'}")


if __name__ == "__main__":
    main()
