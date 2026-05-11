
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '/',
    '/privacy',
    '/terms',
    '/cookies',
    '/consent',
    '/dsar',
    '/data-deletion',
    '/security',
    '/contact',
    '/status',
  ];

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
  }));
}
