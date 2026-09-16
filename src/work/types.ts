import type { CSSProperties } from 'react';

export interface WorkProject {
  /** Project title */
  title: string;
  /** Unique URL slug for routing (e.g. 'museum-of-weed') */
  perma: string;
  /** Long-form description or case study copy */
  body: string;
  /** Subtitle or short overview */
  subhead?: string;
  /** Client or organization name */
  clientName?: string;
  /** Date or metadata block (e.g. "2024\nVICE\nINSTALLATION") */
  date: string;
  /** Accent / UI color as hex code without hash (e.g. '81ecfe') */
  color: string;
  /** Display priority order */
  priority?: number;
  /** Category or technology tags */
  tags: string;
  /** Optional project logo path */
  projectLogo?: string;
  /** External case study URL */
  caseStudyURL?: string;
  /** External live project URL */
  projectURL?: string;
  /** Video reel asset path or URL */
  videoURL?: string;
  /** Thumbnail image path or URL */
  thumbnailURL?: string;
  /** SEO label text */
  seo?: string;
  /** Optional index */
  index?: number;
  /** AI generated flag */
  ai?: boolean;
}

export interface WorkExperienceProps {
  /**
   * Base route prefix where the Work portfolio is mounted.
   * Examples: '/work', '/works', '/portfolio', or '' for root.
   * Default: '/work'
   */
  baseRoute?: string;

  /**
   * Custom array of projects to display on the 3D spiral.
   * If omitted, the default Active Theory showcase dataset is used.
   */
  projects?: WorkProject[];

  /**
   * Initial project slug to open directly upon mount (e.g. 'museum-of-weed').
   */
  initialSlug?: string;

  /**
   * Callback fired when a project is selected (opened in 3D detail view).
   */
  onProjectSelect?: (project: WorkProject) => void;

  /**
   * Callback fired when the 3D detail view is closed (via ESC or back navigation).
   */
  onProjectClose?: () => void;

  /**
   * Optional custom CSS class name for the wrapper element.
   */
  className?: string;

  /**
   * Optional custom style for the wrapper element.
   */
  style?: CSSProperties;

  /**
   * Whether background audio is allowed. Default: true.
   */
  soundEnabled?: boolean;
}

export interface WorkConfig {
  cacheKey: string;
  appScriptPath: string;
  appScriptId: string;
  preloadLinkId: string;
  uilStaticPath: string;
  unsupportedPage: string;
}
