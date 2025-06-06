import type {NextConfig} from 'next';

// Determine basePath based on environment
const getBasePath = () => {
  // For PR previews, use /dog-vision/pr-{number}
  if (process.env.GITHUB_PR_NUMBER) {
    return `/dog-vision/pr-${process.env.GITHUB_PR_NUMBER}`;
  }
  // Default to /dog-vision for main deployment
  return '/dog-vision';
};

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // GitHub Pages deployment configuration
  output: 'export',
  trailingSlash: true,
  basePath: getBasePath(),
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
