import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Фото в MVP нет (docs/decisions.md, решение 15) — оптимизатор изображений
  // не настраиваем, чтобы не создавать видимость поддержки.
  typescript: {
    // Сборка обязана падать на ошибках типов (docs/technical-spec.md §10).
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
