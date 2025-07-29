import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@google/generative-ai', 'playwright'],
  },
  webpack: (config) => {
    config.externals.push({
      '@google/generative-ai': '@google/generative-ai',
      'exa-js': 'exa-js',
      'playwright': 'playwright',
    })
    return config
  },
  eslint: {
    dirs: ['app', 'components', 'lib', 'scripts', 'types'],
  },
};

export default nextConfig;
