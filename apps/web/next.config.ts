import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @wpe/shared is TypeScript source in the workspace, not a built package.
  transpilePackages: ['@wpe/shared'],
  // A file upload goes through a server action; the largest allowed file is 25 MB (D-075).
  experimental: { serverActions: { bodySizeLimit: '26mb' } },
};

export default nextConfig;
