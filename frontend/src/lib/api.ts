const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export { API_URL };

export interface JobResponse {
  job_id: string;
  status: string;
  message: string;
}

export async function removeBg(file: File): Promise<JobResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/remove-bg`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }));
    throw new Error(err.detail || "Échec de l'envoi");
  }
  return res.json();
}

export async function vectorize(
  file: File,
  params?: { blacklevel: string; alphamax: string; opttolerance: string }
): Promise<JobResponse> {
  const formData = new FormData();
  formData.append("file", file);
  
  if (params) {
    formData.append("blacklevel", params.blacklevel);
    formData.append("alphamax", params.alphamax);
    formData.append("opttolerance", params.opttolerance);
  }

  const res = await fetch(`${API_URL}/api/vectorize`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }));
    throw new Error(err.detail || "Échec de l'envoi");
  }
  return res.json();
}

export function getResultUrl(jobId: string): string {
  return `${API_URL}/api/jobs/${jobId}/result`;
}

export function getOriginalUrl(jobId: string): string {
  return `${API_URL}/api/jobs/${jobId}/original`;
}

export function getStreamUrl(jobId: string): string {
  return `${API_URL}/api/jobs/${jobId}/stream`;
}

export interface ColorInfo {
  hex: string;
  role: "primary" | "accent" | "background" | "text" | "neutral";
  occurrences: number;
}

export interface FontInfo {
  name: string;
  role: "heading" | "body" | "monospace" | "ui";
  weights: string[];
  google_fonts_url: string | null;
}

export interface SeoInfo {
  title: string | null;
  description: string | null;
  has_viewport: boolean;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  canonical: string | null;
  h1_count: number;
  response_time_ms: number;
  has_robots: boolean;
}

export interface ColorContrast {
  fg: string;
  bg: string;
  ratio: number;
  level: string;
}

export interface AccessibilityInfo {
  images_with_alt: number;
  images_without_alt: number;
  color_contrasts: ColorContrast[];
  has_lang: boolean;
  has_skip_link: boolean;
}

export interface ComponentInfo {
  buttons: number;
  forms: number;
  inputs: number;
  nav_items: number;
  has_header: boolean;
  has_footer: boolean;
  has_hero: boolean;
  cards_estimate: number;
  modals_estimate: number;
}

export interface SpacingInfo {
  max_container_width: string | null;
  common_spacings: string[];
  uses_grid: boolean;
  uses_flexbox: boolean;
}

export interface ResponsiveInfo {
  breakpoints: string[];
  has_media_queries: boolean;
  viewport_units: boolean;
}

export interface ScrapeResponse {
  colors: ColorInfo[];
  fonts: FontInfo[];
  da_style: string;
  seo: SeoInfo;
  accessibility: AccessibilityInfo;
  components: ComponentInfo;
  spacing: SpacingInfo;
  responsive: ResponsiveInfo;
}

export async function scrapeUrl(url: string): Promise<ScrapeResponse> {
  const res = await fetch(`${API_URL}/api/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }));
    throw new Error(err.detail || "Échec de l'analyse");
  }
  return res.json();
}
