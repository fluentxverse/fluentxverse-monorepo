import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import FullReload from 'vite-plugin-full-reload';
import path from 'path';

const pageChunkFiles: Record<string, string[]> = {
	'pages-auth': [
		'src/pages/RegisterPage.tsx',
		'src/pages/Home.tsx',
	],
	'pages-classroom': [
		'src/pages/ClassroomPage.tsx',
		'src/pages/InterviewRoomPage.tsx',
	],
	'pages-exam': [
		'src/pages/ExamPage.tsx',
		'src/pages/SpeakingExamPage.tsx',
	],
	'pages-profile': [
		'src/pages/MyProfilePage.tsx',
		'src/pages/PerformanceMetricsPage.tsx',
		'src/pages/StudentProfilePage.tsx',
	],
	'pages-materials': [
		'src/pages/MaterialsPage.tsx',
		'src/pages/ConversationalSkillsPage.tsx',
		'src/pages/LessonViewPage.tsx',
	],
	'pages-schedule': [
		'src/pages/SchedulePage.tsx',
		'src/pages/InterviewBookingPage.tsx',
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
		'src/pages/NotificationsPage.tsx',
		'src/pages/InboxPage.tsx',
		'src/pages/ContactUsPage.tsx',
		'src/pages/AboutUsPage.tsx',
		'src/pages/BecomeTutorPage.tsx',
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
		preact(),
		FullReload([
			'public/assets/css/**/*.css',
			'src/**/*.{ts,tsx,js,jsx}',
			'src/**/*.css'
		])
	],
	server: {
		port: 5173,
		strictPort: true,
		host: '0.0.0.0', // Listen on all interfaces for LAN access
		hmr: {
			port: 5173,
		},
		// Proxy API requests to backend - this makes cookies work (same origin)
		proxy: {
			'/api': {
				target: 'http://localhost:8765',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ''),
			},
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
			'@client': path.resolve(__dirname, 'src/client'),
			'@components': path.resolve(__dirname, 'src/Components'),
			'@context': path.resolve(__dirname, 'src/context'),
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
