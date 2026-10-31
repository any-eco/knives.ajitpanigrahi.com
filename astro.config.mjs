// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://knives.ajitpanigrahi.com',
	markdown: {
		shikiConfig: {
			themes: {
				light: 'github-light-high-contrast',
				dark: 'github-dark-high-contrast',
			},
		},
	},
	integrations: [mdx(), sitemap()],
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Timeless Sans Grotesk',
			cssVariable: '--knives-font-sans',
			options: {
				variants: [
					{
						// Variable font: single file covering the full weight range.
						weight: '100 900',
						style: 'normal',
						src: ['./src/assets/fonts/TimelessSansGrotesk.woff2'],
					},
				],
			},
		},
	],
	image: {
		layout: 'constrained',
		responsiveStyles: true,
	},
});
