import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

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
					],
					'pages-lesson': [
						'./src/pages/LessonPage.tsx',
					],
					'pages-profile': [
						'./src/pages/StudentProfilePage.tsx',
						'./src/pages/TutorProfilePage.tsx',
						'./src/pages/StudentDashboard.tsx',
					],
					'pages-materials': [
						'./src/pages/MaterialsPage.tsx',
						'./src/pages/ConversationalSkillsPage.tsx',
						'./src/pages/LessonViewPage.tsx',
					],
					'pages-schedule': [
						'./src/pages/SchedulePage.tsx',
						'./src/pages/BrowseTutorsPage.tsx',
					],
					'pages-tickets': [
						'./src/pages/PurchaseHistoryPage.tsx',
						'./src/pages/TicketsPage.tsx',
					],
				},
			},
		},
		chunkSizeWarningLimit: 600, // Increase limit slightly while we optimize
	},
});

