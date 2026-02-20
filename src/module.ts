import { crop } from "@alanscodelog/utils/crop"
import { run } from "@alanscodelog/utils/run"
import { addImportsDir, createResolver, defineNuxtModule, extendRouteRules, useLogger } from "@nuxt/kit"
import { nuxtRemoveUneededPages, nuxtRerouteOutputTo } from "@witchcraft/nuxt-utils/utils"
import fs from "node:fs/promises"
import path from "node:path"

export interface ModuleOptions {
	/**
	 * The directory where the android project is located. We need this to know where to copy `/build/outputs/apk/release` from.
	 *
	 * @default "~~/app-android"
	 */
	androidProjectDir: string
	/**
	 * .output and release will be placed here
	 *
	 * The intermediate build dir will remain in the android project since that's handled by the android build.
	 *
	 * @default "~~/.dist/android"
	 */
	androidBuildDir: string
	/**
	 * The nuxt output dir when not building android.
	 *
	 * @default ".dist/web/.output"
	 */
	nonAndroidNuxtBuildDir: string
	/**
	 * The avd target name to use when auto open is true.
	 *
	 * @default `Default_API_${process.env.ANDROID_API}`
	 */
	androidTarget: string
	/**
	 * Additional flags to pass to `cap run android`. See {@link https://capacitorjs.com/docs/cli/commands/run capacitor's run} .
	 *
	 * `--no-sync` and `--live-reload` are always passed.
	 */
	additionalCapacitorRunCliArgs: string
	/**
	 * The route to use for the android app.
	 *
	 * @default "/app"
	 */
	androidRoute: string
	/**
	 * Additional routes to include in the android build. Note that "/" is always included because of issues with capacitor.
	 */
	additionalRoutes: string[]
	debug: boolean
	enable: boolean
	autoOpen: boolean
}

export default defineNuxtModule<ModuleOptions>({
	meta: {
		name: "android",
		configKey: "android"
	},
	defaults: {
		androidProjectDir: "~~/app-android",
		androidBuildDir: "~~/.dist/capacitor",
		nonAndroidNuxtBuildDir: "~~/.dist/web/.output",
		androidRoute: "/app",
		additionalRoutes: [],
		additionalCapacitorRunCliArgs: "",
		androidTarget: `Default_API_${process.env.ANDROID_API}`,
		debug: process.env.DEBUG === "*" || process.env.DEBUG?.includes("android"),
		enable: true,
		autoOpen: undefined
	},
	async setup(options, nuxt) {
		if (!options.enable) { return }
		const autoOpen = options.autoOpen ?? process.env.AUTO_OPEN?.includes("android")
		const moduleName = "@witchcraft/nuxt-android"
		const logger = useLogger(moduleName, { level: options.debug ? 10 : 0 })
		const { androidRoute } = options

		const isDev = process.env.NODE_ENV === "development"

		const androidTarget = options.androidTarget
		const { resolvePath, resolve } = createResolver(import.meta.url)

		const rootDir = await resolvePath("~~", nuxt.options.alias)
		const nonAndroidNuxtBuildDir = await resolvePath(options.nonAndroidNuxtBuildDir, nuxt.options.alias)
		const androidProjectDir = await resolvePath(options.androidProjectDir, nuxt.options.alias)
		const androidBuildDir = await resolvePath(options.androidBuildDir, nuxt.options.alias)
		const androidNuxtOutputDir = path.join(path.relative(rootDir, androidBuildDir), ".output")
		const relativeAndroidNuxtOutputDir = path.relative(rootDir, androidNuxtOutputDir)

		const capDev = `NODE_ENV=development VITE_DEV_URL=http://10.0.2.2:${nuxt.options.devServer.port} npm exec cap`
		const cap = `${isDev ? capDev : "npm exec cap"}`

		logger.debug(`Android Command: ${capDev}`)

		const hasCapacitorConfig = await fs.stat(path.join(rootDir, "capacitor.config.ts")).then(() => true).catch(() => false)

		const isAndroidBuild = process.env.BUILD_ANDROID === "true" && hasCapacitorConfig

		// we also need to skip because in the prepare script it'll try to find capacitor.config.ts but it won't exist yet
		if (!hasCapacitorConfig) {
			logger.warn("No capacitor.config.ts found, please create one with `defineCapacitorConfig({})` and add it to your project. Skipping android build.")
		}
		const hasAndroidProject = await fs.stat(androidProjectDir).then(() => true).catch(() => false)
		if (!hasAndroidProject && hasCapacitorConfig) {
			const command = `${cap} add android`
			logger.debug(`Android Project Not Found, Creating: ${command}`)
			await run(command).promise
				.catch(err => { logger.error({ ...err }); process.exit(1) })

			await run(`./node_modules/@witchcraft/nuxt-android/build/syncGradleWithEnv.js ${androidProjectDir}`).promise
				.catch(err => { logger.error({ ...err }); process.exit(1) })
		}

		async function syncAndroidProject() {
			const exists = await fs.stat(androidNuxtOutputDir)
				.then(() => true)
				.catch(() => false)
			if (!exists)	{
				// otherwise capacitor breaks :/
				await fs.mkdir(path.resolve(androidNuxtOutputDir, "public"), { recursive: true })
			}

			logger.debug(`Syncing Android Project: ${cap} sync android`)

			await run(`${cap} sync android`).promise
				.catch(err => logger.error({ ...err }))
		}
		let running: ReturnType<typeof run>
		nuxt.hook("ready", async () => {
			if (isAndroidBuild) return
			if (autoOpen) {
				await syncAndroidProject()
				if (process.env.ANDROID_API === undefined) {
					logger.error("ANDROID_API is not set, please set it to the api version you want to use or autoOpen won't work.")
				} else {
					const flags = `--no-sync --live-reload ${options.additionalCapacitorRunCliArgs}`
					const command = isDev
						? `${capDev} run android --verbose -- --target ${androidTarget} ${flags}`
						: `${cap} run android --verbose -- --target ${androidTarget} ${flags}`
					logger.debug(`Opening Android Emulator: ${command}`)

					if (running) running.child.kill()
					running = run(command)
					running.promise
						.catch(err => logger.error({ ...err }))
				}
			}
		})

		if (isAndroidBuild) {
			nuxtRerouteOutputTo(nuxt, relativeAndroidNuxtOutputDir)
			nuxtRemoveUneededPages(nuxt, ["/", androidRoute, ...options.additionalRoutes])
			extendRouteRules("/", { ssr: false, prerender: true }, { override: true })
			// ideally we would redirect to the mobile route but capacitor gets stuck in an infinite loop :/
			// so we make the root a spa instead
			// capacitor also doesn't support changing the entry point
			// #awaiting https://github.com/cap-team/capacitor/issues/3912
			extendRouteRules(androidRoute, { ssr: false, prerender: true }, { override: true })
			// the build:done hook doesn't work as nitro seems to build after
			nuxt.hook("close", async () => {
				await syncAndroidProject()

				logger.debug(`Building Android Project: ${cap} build android`)
				const buildCommand = run(`${cap} build android`, {
					stdio: "inherit"
				})

				await buildCommand.promise
					.catch(err => { logger.error("Error building android.", err); process.exit(1) })

				const buildReleaseDir = path.join(androidProjectDir, "/build/outputs/apk/release")
				const androidReleaseDir = path.join(androidBuildDir, "release")
				logger.debug(`Copying Android Project from "${buildReleaseDir}" to release dir: "${androidReleaseDir}"`)

				await fs.cp(
					buildReleaseDir,
					androidReleaseDir,
					{ recursive: true }
				).catch(err => { logger.error({ ...err }); process.exit(1) })
			})
		} else {
			nuxt.hook("close", () => {
				if (running) running.child.kill()
			})
			const nuxtOutputDir = nuxt.options.nitro?.output?.dir
			if (nuxtOutputDir === undefined || nuxtOutputDir === ".output") {
				logger.warn(crop`Nitro output dir is not set or set to the default, it's suggested you set it to the following when using nuxt-android:
					nitro: {
						output: ".dist/web/.output",
						serverDir: ".dist/web/.output/server"
						publicDir: ".dist/web/.output/public"
					}
				.`)
			}
		}
		addImportsDir(resolve("runtime/utils"))
	}
})
