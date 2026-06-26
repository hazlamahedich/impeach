import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@iip/ui', '@iip/contracts'],
};

export default nextConfig;
