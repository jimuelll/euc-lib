"""Build the original seven-glyph Library display face.

Requires fonttools[woff]. Run from any directory; the site needs only the
generated WOFF2 file, not Python or these build dependencies.
Outlines are authored here from scratch in a 1000-unit design space.
This is a word-specific display face, not a general-purpose text family.
"""
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path

# Upright sculptural forms: broad stems, fine joins, flared wedge terminals,
# a single-storey a, and a diamond i dot echoing the site's gold ornament.
LETTERS = {
    "L": (560, "M20 0 L60 42 L60 664 L20 700 L234 700 L195 664 L195 36 L343 36 Q443 36 516 171 L506 0 Z"),
    "i": (230, "M18 0 L56 35 L56 444 L22 474 L183 512 L183 35 L220 0 Z M54 624 L119 689 L184 624 L119 559 Z"),
    "b": (550, "M20 0 L55 37 L55 644 L20 672 L181 710 L181 435 Q229 511 326 511 Q515 511 515 254 Q515 -12 311 -12 Q222 -12 173 45 L151 0 Z M181 249 Q181 22 283 22 Q374 22 374 250 Q374 477 283 477 Q181 477 181 249 Z"),
    "r": (370, "M18 0 L56 35 L56 444 L22 474 L181 512 L181 386 Q222 512 297 512 Q353 512 353 456 Q353 401 301 401 Q263 401 242 440 Q181 401 181 282 L181 35 L228 0 Z"),
    "a": (540, "M396 0 L382 67 Q332 -12 241 -12 Q35 -12 35 249 Q35 511 242 511 Q334 511 381 437 L503 503 L503 36 L533 0 Z M175 249 Q175 22 277 22 Q382 22 382 249 Q382 477 277 477 Q175 477 175 249 Z"),
    "y": (535, "M5 500 L204 500 L175 465 L309 127 L433 465 L400 500 L523 500 L481 463 L289 -51 Q221 -229 93 -229 Q27 -229 27 -173 Q27 -125 77 -125 Q116 -125 140 -178 Q202 -158 251 -23 L45 464 Z"),
}


def build():
    builder = FontBuilder(1000, isTTF=True)
    order = [".notdef", "space", *LETTERS]
    builder.setupGlyphOrder(order)
    glyphs = {}
    metrics = {}
    for name in order:
        pen = TTGlyphPen(None)
        width, path = LETTERS.get(name, (300, ""))
        if path:
            parse_path(path, pen)
        glyphs[name] = pen.glyph()
        glyphs[name].recalcBounds(glyphs)
        metrics[name] = (width, glyphs[name].xMin if path else 0)
    builder.setupCharacterMap({ord(char): char for char in LETTERS} | {32: "space"})
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=800, descent=-240)
    builder.setupNameTable({
        "familyName": "Enverga Library Display",
        "styleName": "Regular",
        "uniqueFontIdentifier": "EnvergaLibraryDisplay-2.0",
        "fullName": "Enverga Library Display",
        "psName": "EnvergaLibraryDisplay-Regular",
        "version": "Version 2.0",
        "description": "Original lettering made for the Enverga-Candelaria Library hero.",
    })
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-240,
                    usWinAscent=800, usWinDescent=240, sxHeight=500,
                    sCapHeight=710, usWeightClass=600, fsSelection=64)
    builder.setupPost()
    builder.setupMaxp()
    builder.font.flavor = "woff2"
    target = Path(__file__).resolve().parents[1] / "public/fonts/enverga-library-display.woff2"
    builder.save(target)
    print(f"Built {target.name}: {target.stat().st_size} bytes")


if __name__ == "__main__":
    build()
