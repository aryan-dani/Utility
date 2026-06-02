import withPWAInit from '@ducanh2912/next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundle optimization
  bundlePagesRouterDependencies: true,
  reactCompiler: true,
};

const isDev = process.env.NODE_ENV === 'development';

export default isDev
  ? nextConfig
  : withPWAInit({
      dest: 'public',
      disable: false,
      register: true,
      skipWaiting: false,
      fallback: {
        document: '/~offline',
      },
    })(nextConfig);


