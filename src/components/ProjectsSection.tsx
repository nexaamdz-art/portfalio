import { memo } from 'react';
import { WorkExperience } from '../work';

export const ProjectsSection = memo(function ProjectsSection() {
  return (
    <section
      id="projects"
      aria-label="Projects"
      className="w-full min-h-screen relative overflow-hidden bg-black/30"
    >
      <WorkExperience baseRoute="/works" />
    </section>
  );
});

export default ProjectsSection;
