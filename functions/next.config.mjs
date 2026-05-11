
/** @type {import('next').NextConfig} */
const nextConfig = {
    async redirects() {
        return [
            {
                source: '/(.)',
                destination: 'https://urai.com',
                permanent: true,
            },
        ];
    },
    turbopack: {},
};

export default nextConfig;
