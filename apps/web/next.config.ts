import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @wpe/shared is TypeScript source in the workspace, not a built package.
  transpilePackages: ['@wpe/shared'],
};

export default nextConfig;
