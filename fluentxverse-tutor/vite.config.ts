import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import FullReload from 'vite-plugin-full-reload';
import path from 'path';

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
				manualChunks: {
					// Vendor chunks - split large dependencies
					'vendor-preact': ['preact', 'preact/hooks', 'preact-iso'],
					'vendor-ui': ['zustand', 'wouter'],
					'vendor-pdf': ['pdfjs-dist'],
					// Feature-based chunks
					'pages-auth': [
						'./src/pages/RegisterPage.tsx',
						'./src/pages/Home.tsx',
					],
					'pages-classroom': [
						'./src/pages/ClassroomPage.tsx',
						'./src/pages/InterviewRoomPage.tsx',
					],
					'pages-exam': [
						'./src/pages/ExamPage.tsx',
						'./src/pages/SpeakingExamPage.tsx',
					],
					'pages-profile': [
						'./src/pages/MyProfilePage.tsx',
						'./src/pages/PerformanceMetricsPage.tsx',
						'./src/pages/StudentProfilePage.tsx',
					],
					'pages-materials': [
						'./src/pages/MaterialsPage.tsx',
						'./src/pages/ConversationalSkillsPage.tsx',
						'./src/pages/LessonViewPage.tsx',
					],
					'pages-schedule': [
						'./src/pages/SchedulePage.tsx',
						'./src/pages/InterviewBookingPage.tsx',
					],
				},
			},
		},
		chunkSizeWarningLimit: 600, // Increase limit slightly while we optimize
	},
});
