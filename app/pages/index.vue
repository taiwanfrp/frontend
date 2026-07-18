<script setup lang="ts"></script>

<template>
	<!-- 利用 min-h 扣除導覽列高度來達到畫面垂直置中, overflow-hidden 防止背景超出邊界 -->
	<div class="relative flex flex-col items-center justify-center min-h-screen -mt-16 pt-16 overflow-hidden pb-20 sm:pb-28">
		<div class="absolute inset-0 z-0 flex items-center justify-center bg-white dark:bg-gray-950">
			<!-- Background Image -->
			<div
				class="absolute inset-0 bg-cover bg-center bg-no-repeat"
				style="background-image: url('/background.png');"
			/>

			<!-- 中層半透明顏色遮罩 (不透明度 + 輕微毛玻璃) -->
			<div class="absolute inset-0 bg-white/30 dark:bg-gray-950/55 backdrop-blur-sm" />

			<!-- Dotted Background -->
			<div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNEMUQ1REIiLz48L3N2Zz4=')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiMzNzQxNTEiLz48L3N2Zz4=')] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
		</div>

		<!-- Main Content -->
		<div class="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto flex flex-col items-center">
			<!-- Badge -->
			<div class="mb-8 flex justify-center">
				<span class="inline-flex items-center rounded-full bg-primary-50/60 dark:bg-primary-500/10 px-4 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 ring-1 ring-inset ring-primary-500/20">
					{{ $t('home.hero.badge') }}
				</span>
			</div>

			<!-- Main Heading -->
			<h1 class="text-5xl sm:text-6xl font-bold tracking-tight text-gray-900 dark:text-white">
				{{ $t('home.hero.title') }}
			</h1>

			<!-- Subheading -->
			<p class="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
				{{ $t('home.hero.subtitle_line1') }}<br class="hidden sm:block">
				{{ $t('home.hero.subtitle_line2') }}
			</p>

			<div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 w-full sm:w-auto">
				<UButton
					:label="$t('home.hero.btn_start')"
					trailing-icon="i-heroicons-arrow-right-20-solid"
					size="xl"
					color="primary"
					class="rounded-lg px-8 py-3 font-semibold transition-transform hover:scale-105 w-full sm:w-auto justify-center"
				/>

				<UButton
					:label="$t('home.hero.btn_video')"
					icon="i-heroicons-play-circle"
					size="xl"
					color="secondary"
					variant="soft"
					class="rounded-lg px-8 py-3 font-semibold w-full sm:w-auto justify-center bg-secondary-200 dark:bg-secondary-500/40 transition-transform hover:scale-105 transition-colors"
				/>
			</div>
		</div>
	</div>
</template>
