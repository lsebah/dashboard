/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Slug renommé : Comparatif → Décrément
      { source: '/lifecycle/comparatif', destination: '/lifecycle2/decrement', permanent: false },
      { source: '/lifecycle2/comparatif', destination: '/lifecycle2/decrement', permanent: false },
      // Lifecycle 1 retiré → tout pointe vers Lifecycle 2
      { source: '/lifecycle/:path*', destination: '/lifecycle2/:path*', permanent: false },
      { source: '/lifecycle', destination: '/lifecycle2', permanent: false },
    ]
  },
}

module.exports = nextConfig
