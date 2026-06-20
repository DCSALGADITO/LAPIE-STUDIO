import re
import colorsys
import math
import time
from collections import Counter
from urllib.parse import urljoin

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from bs4 import BeautifulSoup

router = APIRouter()

# ─────────────────────────── Models ────────────────────────────

class ScrapeRequest(BaseModel):
    url: str

class ColorInfo(BaseModel):
    hex: str
    role: str  # "primary" | "accent" | "background" | "text" | "neutral"
    occurrences: int

class FontInfo(BaseModel):
    name: str
    role: str  # "heading" | "body" | "monospace" | "ui"
    weights: list[str]
    google_fonts_url: str | None

class SeoInfo(BaseModel):
    title: str | None
    description: str | None
    has_viewport: bool
    og_title: str | None
    og_description: str | None
    og_image: str | None
    canonical: str | None
    h1_count: int
    response_time_ms: int
    has_robots: bool

class AccessibilityInfo(BaseModel):
    images_with_alt: int
    images_without_alt: int
    color_contrasts: list[dict]
    has_lang: bool
    has_skip_link: bool

class ComponentInfo(BaseModel):
    buttons: int
    forms: int
    inputs: int
    nav_items: int
    has_header: bool
    has_footer: bool
    has_hero: bool
    cards_estimate: int
    modals_estimate: int

class SpacingInfo(BaseModel):
    max_container_width: str | None
    common_spacings: list[str]
    uses_grid: bool
    uses_flexbox: bool

class ResponsiveInfo(BaseModel):
    breakpoints: list[str]
    has_media_queries: bool
    viewport_units: bool

class ScrapeResponse(BaseModel):
    colors: list[ColorInfo]
    fonts: list[FontInfo]
    da_style: str
    seo: SeoInfo
    accessibility: AccessibilityInfo
    components: ComponentInfo
    spacing: SpacingInfo
    responsive: ResponsiveInfo

# ─────────────────────────── Color Helpers ──────────────────────

def hex_to_rgb(hex_str: str) -> tuple[int, int, int] | None:
    hex_str = hex_str.strip().lstrip('#')
    if len(hex_str) == 3:
        hex_str = ''.join(c * 2 for c in hex_str)
    if len(hex_str) != 6:
        return None
    try:
        return (int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16))
    except ValueError:
        return None

def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02x}{g:02x}{b:02x}"

def color_distance(c1: tuple, c2: tuple) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))

def relative_luminance(rgb: tuple) -> float:
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)

def calculate_contrast_ratio(hex1: str, hex2: str) -> float:
    rgb1, rgb2 = hex_to_rgb(hex1), hex_to_rgb(hex2)
    if not rgb1 or not rgb2:
        return 1.0
    l1, l2 = relative_luminance(rgb1), relative_luminance(rgb2)
    lighter, darker = max(l1, l2), min(l1, l2)
    return round((lighter + 0.05) / (darker + 0.05), 2)

def is_near_white_or_black(rgb: tuple) -> bool:
    r, g, b = rgb
    brightness = (r + g + b) / 3
    return brightness > 230 or brightness < 25

def is_near_gray(rgb: tuple) -> bool:
    r, g, b = rgb
    return max(r, g, b) - min(r, g, b) < 20

def cluster_colors(color_counts: Counter, max_colors: int = 8) -> list[tuple[tuple, int]]:
    """Cluster visually similar colors, returning (representative_rgb, total_count)."""
    items = []
    for hex_c, count in color_counts.items():
        rgb = hex_to_rgb(hex_c)
        if rgb is None:
            continue
        if is_near_white_or_black(rgb):
            continue
        if is_near_gray(rgb):
            continue
        items.append((rgb, count))

    if not items:
        return []

    items.sort(key=lambda x: x[1], reverse=True)

    THRESHOLD = 60
    clusters: list[list] = []
    for rgb, count in items:
        merged = False
        for cluster in clusters:
            if color_distance(rgb, cluster[0][0]) < THRESHOLD:
                cluster.append((rgb, count))
                merged = True
                break
        if not merged:
            clusters.append([(rgb, count)])

    result = []
    for cluster in clusters:
        total_count = sum(c for _, c in cluster)
        avg_r = int(sum(r * c for (r, _, __), c in cluster) / total_count)
        avg_g = int(sum(g * c for (_, g, __), c in cluster) / total_count)
        avg_b = int(sum(b * c for (_, __, b), c in cluster) / total_count)
        result.append(((avg_r, avg_g, avg_b), total_count))

    result.sort(key=lambda x: x[1], reverse=True)
    return result[:max_colors]

def assign_color_role(rgb: tuple, all_clustered: list) -> str:
    r, g, b = rgb
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if s > 0.7 and v > 0.5:
        return "accent"
    if v > 0.85 and s < 0.2:
        return "background"
    if v < 0.25:
        return "text"
    if s > 0.3 and v > 0.3:
        return "primary"
    return "neutral"

def detect_da_style(clustered_brand: list, all_color_counts: Counter) -> str:
    """
    Improved DA detection using BOTH the brand colors (filtered) AND the full raw palette.
    This fixes the issue where sites with mostly dark/neutral CSS return 'Indéterminé'.
    """
    # Build full palette from raw counts (top 30 colors by occurrence)
    full_palette = []
    for hex_c, count in all_color_counts.most_common(30):
        rgb = hex_to_rgb(hex_c)
        if rgb is None:
            continue
        r, g, b = rgb
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        full_palette.append((h, s, v, count))

    if not full_palette:
        return "Indéterminé"

    total_count = max(sum(c for _, _, _, c in full_palette), 1)

    # Weighted color metrics across the FULL palette
    avg_sat = sum(s * c for _, s, _, c in full_palette) / total_count
    avg_val = sum(v * c for _, _, v, c in full_palette) / total_count

    # Ratio of dark pixels (v < 0.25)
    dark_ratio = sum(c for _, _, v, c in full_palette if v < 0.25) / total_count
    # Ratio of light pixels (v > 0.85)
    light_ratio = sum(c for _, _, v, c in full_palette if v > 0.85) / total_count
    # Ratio of vivid (saturated + bright)
    vivid_ratio = sum(c for _, s, v, c in full_palette if s > 0.45 and v > 0.35) / total_count

    num_brand = len(clustered_brand)

    # — Dark-dominant designs
    if dark_ratio > 0.4 and avg_val < 0.45:
        if vivid_ratio > 0.08 or num_brand >= 2:
            return "Dark Premium"
        return "Minimaliste Monochrome"

    # — Essentially no saturation at all → minimalist
    if avg_sat < 0.06:
        if num_brand == 0 or light_ratio > 0.5:
            return "Minimaliste & Épuré"
        return "Minimaliste Monochrome"

    # — Very high saturation → bold / colorful
    if vivid_ratio > 0.18 or avg_sat > 0.55:
        if num_brand >= 5:
            return "Coloré & Dynamique"
        return "Bold & Impactant"

    # — Medium-high saturation
    if avg_sat > 0.28:
        return "Moderne & Affirmé"

    # — Medium saturation, professional tone
    if avg_sat > 0.10:
        return "Sobre & Professionnel"

    return "Minimaliste & Épuré"

# ─────────────────────────── Color Extraction ───────────────────

def extract_colors_with_count(text: str) -> Counter:
    """Extract ALL color formats from CSS: #hex, rgb(), rgba(), hsl(), hsla()."""
    counts: Counter = Counter()

    # 1. Hex colors
    hex_pattern = re.compile(r'#(?:[0-9a-fA-F]{3}){1,2}\b')
    for match in hex_pattern.findall(text):
        h = match.lower()
        if len(h) == 4:
            h = '#' + h[1] * 2 + h[2] * 2 + h[3] * 2
        counts[h] += 1

    # 2. rgb() / rgba()
    rgb_pat = re.compile(r'rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})', re.I)
    for m in rgb_pat.finditer(text):
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 0 <= r <= 255 and 0 <= g <= 255 and 0 <= b <= 255:
            counts[rgb_to_hex(r, g, b)] += 1

    # 3. hsl() / hsla()
    hsl_pat = re.compile(r'hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?', re.I)
    for m in hsl_pat.finditer(text):
        hue = float(m.group(1)) / 360
        sat = float(m.group(2)) / 100
        lig = float(m.group(3)) / 100
        r_f, g_f, b_f = colorsys.hls_to_rgb(hue, lig, sat)
        counts[rgb_to_hex(int(r_f * 255), int(g_f * 255), int(b_f * 255))] += 1

    return counts

# ─────────────────────────── Font Helpers ───────────────────────

GOOGLE_FONTS = {
    "inter", "roboto", "open sans", "lato", "montserrat", "poppins",
    "nunito", "raleway", "ubuntu", "source sans pro", "playfair display",
    "merriweather", "pt sans", "noto sans", "oswald", "mulish", "dm sans",
    "work sans", "rubik", "quicksand", "josefin sans", "figtree", "outfit",
    "plus jakarta sans", "geist", "space grotesk", "sora", "manrope",
    "lexend", "bricolage grotesque", "cabinet grotesk", "clash display",
    "crimson text", "eb garamond", "cormorant garamond", "libre baskerville",
    "fraunces", "dm serif display", "bodoni moda",
}

SYSTEM_FONTS = {
    'inherit', 'initial', 'unset', 'sans-serif', 'serif', 'monospace',
    'system-ui', '-apple-system', 'blinkmacsystemfont', 'segoe ui',
    'roboto', 'oxygen', 'ubuntu', 'cantarell', 'fira sans', 'droid sans',
    'helvetica neue', 'helvetica', 'arial', 'georgia', 'times new roman',
    'courier new', 'var(--font-sans)', 'var(--font-mono)',
}

MONOSPACE_KEYWORDS = {'mono', 'code', 'courier', 'consolas', 'menlo', 'fira code', 'jetbrains'}

def extract_font_info(css_text: str, html_soup: BeautifulSoup) -> list[FontInfo]:
    font_data: dict[str, dict] = {}

    # Phase 0: detect Google Fonts from <link> tags in HTML head
    gf_link_pat = re.compile(r'family=([^&:;"\']+)', re.I)
    for link in html_soup.find_all('link', href=True):
        href = link.get('href', '')
        if 'fonts.googleapis.com' in href or 'fonts.gstatic.com' in href:
            for m in gf_link_pat.finditer(href):
                raw = m.group(1).replace('+', ' ').split(':')[0].strip()
                name = raw.title()
                if name and name not in font_data:
                    font_data[name] = {"roles": set(), "weights": {"400"}, "gf_url": href}

    heading_pattern = re.compile(
        r'(h[1-6]|\.heading|\.title|\.display|\.headline)[^{]*\{([^}]*)\}', re.IGNORECASE
    )
    body_pattern = re.compile(
        r'(body\b|p\b|\.body|\.text|\.content|\.paragraph)[^{]*\{([^}]*)\}', re.IGNORECASE
    )
    ui_pattern = re.compile(
        r'(button\b|nav\b|\.btn|\.nav\b|header\b|\.menu\b|label\b|input\b)[^{]*\{([^}]*)\}',
        re.IGNORECASE
    )
    font_family_re = re.compile(r"font-family\s*:\s*([^;}'\"]+)")
    font_weight_re = re.compile(r"font-weight\s*:\s*([^;}'\"]+)")

    GARBAGE_PATTERNS = re.compile(
        r'^(var\(|--|\d|calc\(|inherit|initial|unset|normal|none|auto)',
        re.IGNORECASE
    )

    def clean_family_name(raw: str) -> str | None:
        name = raw.strip().strip("'\"").strip()
        if not name or len(name) < 2 or len(name) > 60:
            return None
        if GARBAGE_PATTERNS.match(name):
            return None
        if name.lower() in SYSTEM_FONTS:
            return None
        if ',' in name:
            return None
        if any(c in name for c in [';', '{', '}', '(', ')', '!']):
            return None
        return name

    def extract_from_block(block: str, role: str) -> None:
        family_match = font_family_re.search(block)
        weight_match = font_weight_re.search(block)
        if not family_match:
            return
        raw_families = family_match.group(1).split(',')
        weight = weight_match.group(1).strip() if weight_match else "400"
        for raw in raw_families:
            name = clean_family_name(raw)
            if name:
                if name not in font_data:
                    font_data[name] = {"roles": set(), "weights": set()}
                font_data[name]["roles"].add(role)
                font_data[name]["weights"].add(weight)
                break

    for m in heading_pattern.finditer(css_text):
        extract_from_block(m.group(2), "heading")
    for m in body_pattern.finditer(css_text):
        extract_from_block(m.group(2), "body")
    for m in ui_pattern.finditer(css_text):
        extract_from_block(m.group(2), "ui")

    if len(font_data) < 4:
        for m in font_family_re.finditer(css_text):
            if len(font_data) >= 8:
                break
            raw_families = m.group(1).split(',')
            for raw in raw_families:
                name = clean_family_name(raw)
                if name and name not in font_data:
                    font_data[name] = {"roles": set(), "weights": set()}
                    break

    results = []
    for name, data in font_data.items():
        roles = data.get("roles", set())
        if "heading" in roles:
            role = "heading"
        elif "body" in roles:
            role = "body"
        elif "ui" in roles:
            role = "ui"
        elif any(kw in name.lower() for kw in MONOSPACE_KEYWORDS):
            role = "monospace"
        else:
            role = "body"

        # Use pre-detected GF URL or build one
        gf_url = data.get("gf_url")
        if not gf_url:
            clean_name = name.strip().lower()
            if clean_name in GOOGLE_FONTS:
                url_name = name.strip().replace(" ", "+")
                gf_url = f"https://fonts.googleapis.com/css2?family={url_name}&display=swap"

        results.append(FontInfo(
            name=name.strip(),
            role=role,
            weights=sorted(list(data["weights"])) if data["weights"] else ["400"],
            google_fonts_url=gf_url,
        ))

    results.sort(key=lambda f: (0 if f.role in {"heading", "body", "ui", "monospace"} else 1))
    return results[:8]

# ─────────────────────────── SEO Extraction ─────────────────────

def extract_seo(soup: BeautifulSoup, response_time_ms: int) -> SeoInfo:
    title_tag = soup.find('title')
    title = title_tag.get_text().strip() if title_tag else None

    desc_tag = soup.find('meta', attrs={'name': re.compile(r'^description$', re.I)})
    description = desc_tag.get('content', '').strip() if desc_tag else None

    has_viewport = bool(soup.find('meta', attrs={'name': re.compile(r'^viewport$', re.I)}))

    og_title_tag = soup.find('meta', property='og:title') or soup.find('meta', attrs={'property': 'og:title'})
    og_desc_tag = soup.find('meta', property='og:description') or soup.find('meta', attrs={'property': 'og:description'})
    og_img_tag = soup.find('meta', property='og:image') or soup.find('meta', attrs={'property': 'og:image'})
    canonical_tag = soup.find('link', rel='canonical') or soup.find('link', attrs={'rel': 'canonical'})

    h1_count = len(soup.find_all('h1'))
    has_robots = bool(soup.find('meta', attrs={'name': re.compile(r'^robots$', re.I)}))

    return SeoInfo(
        title=title,
        description=description,
        has_viewport=has_viewport,
        og_title=og_title_tag.get('content') if og_title_tag else None,
        og_description=og_desc_tag.get('content') if og_desc_tag else None,
        og_image=og_img_tag.get('content') if og_img_tag else None,
        canonical=canonical_tag.get('href') if canonical_tag else None,
        h1_count=h1_count,
        response_time_ms=response_time_ms,
        has_robots=has_robots,
    )

# ─────────────────────────── Accessibility ──────────────────────

def extract_accessibility(soup: BeautifulSoup, colors: list[ColorInfo]) -> AccessibilityInfo:
    images = soup.find_all('img')
    imgs_with = sum(1 for img in images if img.get('alt', '').strip())
    imgs_without = len(images) - imgs_with

    html_tag = soup.find('html')
    has_lang = bool(html_tag and html_tag.get('lang'))
    has_skip = bool(soup.find('a', attrs={'href': re.compile(r'^#')}))

    # Contrast ratio between text and background colors
    contrasts = []
    text_cols = [c for c in colors if c.role in ('text', 'primary')]
    bg_cols = [c for c in colors if c.role in ('background', 'neutral')]

    for tc in text_cols[:3]:
        for bc in bg_cols[:3]:
            ratio = calculate_contrast_ratio(tc.hex, bc.hex)
            if ratio >= 7:
                level = "AAA ✓"
            elif ratio >= 4.5:
                level = "AA ✓"
            elif ratio >= 3:
                level = "AA Large"
            else:
                level = "Insuffisant ✗"
            contrasts.append({"fg": tc.hex, "bg": bc.hex, "ratio": ratio, "level": level})

    return AccessibilityInfo(
        images_with_alt=imgs_with,
        images_without_alt=imgs_without,
        color_contrasts=contrasts,
        has_lang=has_lang,
        has_skip_link=has_skip,
    )

# ─────────────────────────── Components ─────────────────────────

def extract_components(soup: BeautifulSoup) -> ComponentInfo:
    btn_count = len(soup.find_all('button'))
    btn_count += len(soup.find_all('input', attrs={'type': re.compile(r'submit|button', re.I)}))
    btn_count += len(soup.find_all(attrs={'class': re.compile(r'\bbtn\b|\bbutton\b|\bcta\b', re.I)}))

    forms = len(soup.find_all('form'))
    inputs = len(soup.find_all('input'))
    nav_items = len(soup.find_all('li'))

    has_header = bool(soup.find('header'))
    has_footer = bool(soup.find('footer'))
    has_hero = bool(soup.find(attrs={'class': re.compile(r'\bhero\b|\bbanner\b|\bjumbotron\b', re.I)}))

    cards = len(soup.find_all(attrs={'class': re.compile(r'\bcard\b|\btile\b|\bproduct\b', re.I)}))
    modals = len(soup.find_all(attrs={'class': re.compile(r'\bmodal\b|\bdialog\b|\boverlay\b', re.I)}))

    return ComponentInfo(
        buttons=min(btn_count, 999),
        forms=forms,
        inputs=inputs,
        nav_items=min(nav_items, 999),
        has_header=has_header,
        has_footer=has_footer,
        has_hero=has_hero,
        cards_estimate=min(cards, 99),
        modals_estimate=min(modals, 99),
    )

# ─────────────────────────── Spacing ────────────────────────────

def extract_spacing(css_text: str) -> SpacingInfo:
    # Detect largest max-width (likely the container)
    max_widths = re.findall(r'max-width\s*:\s*([\d.]+(?:px|rem|em|%))', css_text)
    numeric_mw = []
    for mw in max_widths:
        try:
            numeric_mw.append((float(re.search(r'[\d.]+', mw).group()), mw))
        except Exception:
            pass
    max_container = max(numeric_mw, key=lambda x: x[0])[1] if numeric_mw else None

    # Most common spacing values from margin/padding
    spacing_vals: Counter = Counter()
    for m in re.finditer(r'(?:margin|padding)\s*:\s*([^;{]+)', css_text, re.I):
        for val in re.findall(r'\d+(?:\.\d+)?(?:px|rem|em)', m.group(1)):
            if val != '0px':
                spacing_vals[val] += 1

    common = [v for v, _ in spacing_vals.most_common(8)]

    uses_grid = bool(re.search(r'display\s*:\s*grid\b', css_text, re.I))
    uses_flexbox = bool(re.search(r'display\s*:\s*flex\b', css_text, re.I))

    return SpacingInfo(
        max_container_width=max_container,
        common_spacings=common,
        uses_grid=uses_grid,
        uses_flexbox=uses_flexbox,
    )

# ─────────────────────────── Responsive ─────────────────────────

def extract_responsive(css_text: str) -> ResponsiveInfo:
    breakpoints: set[str] = set()
    bp_pat = re.compile(r'@media[^{]*(?:min|max)-width\s*:\s*([\d.]+(?:px|em|rem))', re.I)
    for m in bp_pat.finditer(css_text):
        breakpoints.add(m.group(1))

    has_media = bool(re.search(r'@media', css_text, re.I))
    has_vp_units = bool(re.search(r'\d+v(?:w|h|min|max)', css_text, re.I))

    def sort_key(bp: str) -> float:
        try:
            return float(re.search(r'[\d.]+', bp).group())  # type: ignore
        except Exception:
            return 0.0

    sorted_bps = sorted(breakpoints, key=sort_key)

    return ResponsiveInfo(
        breakpoints=sorted_bps[:10],
        has_media_queries=has_media,
        viewport_units=has_vp_units,
    )

# ─────────────────────────── Router ─────────────────────────────

@router.post("/scrape", response_model=ScrapeResponse)
async def scrape_url(request: ScrapeRequest):
    url = request.url
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    try:
        t0 = time.monotonic()
        async with httpx.AsyncClient(
            timeout=20.0,
            follow_redirects=True,
            headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'}
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            response_time_ms = int((time.monotonic() - t0) * 1000)
            html_content = response.text
            soup = BeautifulSoup(html_content, 'html.parser')

            # ── CSS Collection ───────────────────────────────────
            css_parts = []
            for style in soup.find_all('style'):
                if style.string:
                    css_parts.append(style.string)
            for link in soup.find_all('link', rel='stylesheet'):
                href = link.get('href')
                if href:
                    css_url = urljoin(url, href)
                    try:
                        r = await client.get(css_url, timeout=8.0)
                        if r.status_code == 200:
                            css_parts.append(r.text)
                    except Exception:
                        pass

            all_css = "\n".join(css_parts)

            # ── Color Clustering ─────────────────────────────────
            color_counts = extract_colors_with_count(all_css)
            # Also scan inline styles
            for tag in soup.find_all(style=True):
                color_counts.update(extract_colors_with_count(tag['style']))

            clustered = cluster_colors(color_counts, max_colors=8)

            color_infos: list[ColorInfo] = []
            for rgb, count in clustered:
                hex_c = rgb_to_hex(*rgb)
                role = assign_color_role(rgb, clustered)
                color_infos.append(ColorInfo(hex=hex_c, role=role, occurrences=count))

            # ── DA Style Detection (improved) ────────────────────
            da_style = detect_da_style(clustered, color_counts)

            # ── Font Extraction ──────────────────────────────────
            font_infos = extract_font_info(all_css, soup)

            # ── New Sections ─────────────────────────────────────
            seo = extract_seo(soup, response_time_ms)
            accessibility = extract_accessibility(soup, color_infos)
            components = extract_components(soup)
            spacing = extract_spacing(all_css)
            responsive = extract_responsive(all_css)

            return ScrapeResponse(
                colors=color_infos,
                fonts=font_infos,
                da_style=da_style,
                seo=seo,
                accessibility=accessibility,
                components=components,
                spacing=spacing,
                responsive=responsive,
            )

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Erreur HTTP {e.response.status_code} pour {url}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur lors de l'analyse : {str(e)}")
