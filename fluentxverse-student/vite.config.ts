import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

const pageChunkFiles: Record<string, string[]> = {
	'pages-auth': [
		'src/pages/RegisterPage.tsx',
		'src/pages/Home.tsx',
	],
	'pages-classroom': [
		'src/pages/ClassroomPage.tsx',
	],
	'pages-lesson': [
		'src/pages/LessonPage.tsx',
	],
	'pages-profile': [
		'src/pages/StudentProfilePage.tsx',
		'src/pages/TutorProfilePage.tsx',
	],
	'pages-materials': [
		'src/pages/MaterialsPage.tsx',
		'src/pages/ConversationalSkillsPage.tsx',
		'src/pages/LessonViewPage.tsx',
	],
	'pages-schedule': [
		'src/pages/SchedulePage.tsx',
		'src/pages/BrowseTutorsPage.tsx',
	],
	'pages-tickets': [
		'src/pages/PurchaseHistoryPage.tsx',
		'src/pages/TicketsPage.tsx',
	],
	'pages-daily-dispatch': [
		'src/pages/DailyDispatchPage.tsx',
		'src/pages/DailyDispatchArticlePage.tsx',
		'src/pages/DailyDispatchArchivePage.tsx',
	],
	'pages-young-learners': [
		'src/pages/YoungLearnersPage.tsx',
		'src/pages/YoungLearnersLessonPage.tsx',
	],
	'pages-conversational': [
		'src/pages/ConversationalSkillsLessonPage.tsx',
	],
	'pages-misc': [
		'src/pages/HomeProtected.tsx',
		'src/pages/InboxPage.tsx',
		'src/pages/ContactPage.tsx',
		'src/pages/PrivacyPolicy.tsx',
		'src/pages/TermsOfService.tsx',
		'src/pages/NotFoundPage.tsx',
	],
};

const manualChunks = (id: string) => {
	const normalizedId = id.replaceAll('\\', '/');

	if (normalizedId.includes('/node_modules/')) {
		if (normalizedId.includes('/node_modules/preact/') || normalizedId.includes('/node_modules/preact-iso/')) {
			return 'vendor-preact';
		}
		if (normalizedId.includes('/node_modules/zustand/')) {
			return 'vendor-ui';
		}
		if (normalizedId.includes('/node_modules/pdfjs-dist/')) {
			return 'vendor-pdf';
		}
		if (normalizedId.includes('/node_modules/thirdweb/')) {
			return 'vendor-thirdweb';
		}
	}

	for (const [chunkName, files] of Object.entries(pageChunkFiles)) {
		if (files.some((file) => normalizedId.endsWith(file))) {
			return chunkName;
		}
	}

	return undefined;
};

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		preact()
	],
	server: {
		port: 5174,
		strictPort: true,
		hmr: {
			port: 5174,
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
			'@client': path.resolve(__dirname, 'src/client'),
			'@components': path.resolve(__dirname, 'src/Components'),
			'@context': path.resolve(__dirname, 'src/context'),
			// Alias React to Preact compat for libraries like thirdweb
			'react': 'preact/compat',
			'react-dom': 'preact/compat',
			'react/jsx-runtime': 'preact/jsx-runtime',
		},
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks,
			},
		},
		chunkSizeWarningLimit: 600, // Increase limit slightly while we optimize
	},
});
