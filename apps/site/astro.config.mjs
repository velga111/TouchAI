// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const glimmPath = path.resolve(pkgDir, 'node_modules/glimm/dist/index.js');

const sidebar = [
	{
		label: '入门',
		translations: { en: 'Getting Started' },
		items: [
			'getting-started/installation',
			'getting-started/quickstart',
			'getting-started/shortcuts',
		],
	},
	{
		label: '功能',
		translations: { en: 'Features' },
		items: [
			'features/built-in-tools',
			'features/visualization',
			'features/file-search',
			'features/code-and-command',
			'features/upgrade-model',
		],
	},
	{
		label: 'MCP 服务器',
		translations: { en: 'MCP Extensions' },
		items: [
			'extensions/mcp-tools',
			'extensions/mcp-add-service',
			'extensions/mcp-popular-scenarios',
		],
	},
	{
		label: '设置',
		translations: { en: 'Settings' },
		items: ['settings/model-configuration', 'settings/api-keys'],
	},
	{
		label: '关于',
		translations: { en: 'About' },
		items: ['about/announcement', 'about/changelog', 'about/support'],
	},
];

export default defineConfig({
	site: 'https://touch-ai.org/',
	vite: {
		resolve: {
			alias: {
				glimm: glimmPath,
			},
		},
		optimizeDeps: {
			include: ['glimm'],
		},
	},
	integrations: [
		starlight({
			title: 'TouchAI',
			locales: {
				root: {
					label: '简体中文',
					lang: 'zh-CN',
				},
				en: {
					label: 'English',
					lang: 'en',
				},
			},
			defaultLocale: 'root',
			logo: {
				light: './src/assets/touchai-docs-logo-light.svg',
				dark: './src/assets/touchai-docs-logo-dark.svg',
				alt: 'TouchAI',
				replacesTitle: true,
			},
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/TouchAI-org/TouchAI' }],
			sidebar,
		}),
	],
});
