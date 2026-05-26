/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/Webhook',
        destination: '/api/webhook',
      },
    ]
  },
}

module.exports = nextConfig
