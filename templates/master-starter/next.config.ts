import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The site is its own project root, also while it sits inside the pipeline's repository as a template.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
