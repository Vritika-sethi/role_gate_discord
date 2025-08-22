const withTM = require("next-transpile-modules")([
  "@magic-ext/oauth"
]);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: { unoptimized: true },
};

module.exports = withTM(nextConfig);
