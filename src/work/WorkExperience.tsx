import { useEffect, useRef, memo } from 'react';
import type { WorkExperienceProps } from './types';
import { DEFAULT_WORK_PROJECTS } from './data/defaultProjects';
import {
  DEFAULT_WORK_CONFIG,
  setupWorkRuntime,
  ensurePreload,
  ensureScript,
  openProjectSlug,
  closeProjectDetail,
} from './utils/workBridge';
import './work.css';

export const WorkExperience = memo(function WorkExperience({
  baseRoute = '/work',
  projects = DEFAULT_WORK_PROJECTS,
  initialSlug,
  onProjectSelect,
  onProjectClose,
  className = '',
  style,
}: WorkExperienceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectCallbackRef = useRef(onProjectSelect);
  const closeCallbackRef = useRef(onProjectClose);
  const isDetailOpenRef = useRef(false);

  selectCallbackRef.current = onProjectSelect;
  closeCallbackRef.current = onProjectClose;

  useEffect(() => {
    // 1. Configure runtime environment and project data
    setupWorkRuntime(baseRoute, projects, DEFAULT_WORK_CONFIG);

    const updateStageVisibility = (inView: boolean) => {
      const stageEl = document.getElementById('Stage');
      if (stageEl) {
        if (inView || isDetailOpenRef.current) {
          stageEl.style.display = 'block';
          stageEl.style.pointerEvents = 'auto';
        } else {
          stageEl.style.display = 'none';
          stageEl.style.pointerEvents = 'none';
        }
      }
    };

    // 2. IntersectionObserver to only activate Stage when Projects is in view
    let isInViewport = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isInViewport = entry.isIntersecting;
        updateStageVisibility(isInViewport);
      },
      {
        threshold: [0, 0.05, 0.2, 0.5],
        rootMargin: '120px 0px 120px 0px',
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // 3. Preload and inject the core 3D Work experience bundle
    ensurePreload(DEFAULT_WORK_CONFIG.preloadLinkId, DEFAULT_WORK_CONFIG.appScriptPath);
    ensureScript(DEFAULT_WORK_CONFIG.appScriptId, DEFAULT_WORK_CONFIG.appScriptPath).then(() => {
      updateStageVisibility(isInViewport);
      if (initialSlug) {
        setTimeout(() => {
          openProjectSlug(initialSlug);
        }, 300);
      }
    });

    // 4. Listen to project selection / close custom events dispatched by the 3D scene
    const handleProjectEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        project: unknown;
        previous: unknown;
      }>;
      const project = customEvent.detail?.project;
      if (project) {
        isDetailOpenRef.current = true;
        updateStageVisibility(true);
        selectCallbackRef.current?.(project as never);
      } else {
        isDetailOpenRef.current = false;
        updateStageVisibility(isInViewport);
        closeCallbackRef.current?.();
      }
    };

    window.addEventListener('work:project-change', handleProjectEvent);

    return () => {
      observer.disconnect();
      window.removeEventListener('work:project-change', handleProjectEvent);

      // Hide WebGL Stage so it doesn't overlay or intercept clicks in other sections
      const stage = document.getElementById('Stage');
      if (stage) {
        stage.style.display = 'none';
        stage.style.pointerEvents = 'none';
      }

      // Close open project detail overlay state if active
      closeProjectDetail();
    };
  }, [baseRoute, projects, initialSlug]);

  return (
    <div
      ref={containerRef}
      id="work-experience-root"
      className={`work-experience-container relative w-full h-full min-h-screen overflow-hidden ${className}`}
      style={style}
    />
  );
});

export default WorkExperience;

