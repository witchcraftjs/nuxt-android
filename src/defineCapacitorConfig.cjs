const defu = require("defu")
const fs = require("fs")
const path = require("path")

/**
 * @param config {import("capacitor").CapacitorConfig & {rootDir: string}=}
 * @returns {import("capacitor").CapacitorConfig & {rootDir: string}}
 */
exports.defineCapacitorConfig = function defineCapacitorConfig(config, { debug = true } = {}) {
	if (
		process.env.NODE_ENV === undefined ||
		(process.env.NODE_ENV === "development" && process.env.VITE_DEV_URL === undefined)
	) {
		throw new Error("It looks like you tried to call cap sync manually instead of using the package.json's scripts. Add the needed env variables (VITE_DEV_URL) or set NODE_ENV to production.")
	}
	const keystorePassword = process.env.ANDROID_KS_PASSWORD_PATH
				? fs.readFileSync(process.env.ANDROID_KS_PASSWORD_PATH, "utf-8")
				: process.env.ANDROID_KS_PASSWORD
	const keystoreAliasPassword = (process.env.ANDROID_KS_ALIAS_PASSWORD_PATH
				? fs.readFileSync(process.env.ANDROID_KS_ALIAS_PASSWORD_PATH, "utf-8")
				: process.env.ANDROID_KS_PASSWORD) ?? keystorePassword

	const baseConfig = {
		webDir: process.env.VITE_DEV_URL ? undefined : ".dist/android/.output/public/",
		// undocumented???
		rootDir: ".dist/android",
		android: {
			path: "app-android",
			buildOptions: {
				signingType: "apksigner",
				keystorePath: path.resolve(`./`, `${process.env.ANDROID_KS_PATH}`),
				keystorePassword,
				keystoreAliasPassword,
				keystoreAlias: process.env.ANDROID_KS_ALIAS,
				releaseType: "APK",
			},
		},
		server: {
			...(process.env.NODE_ENV === "development"
		? {
			// note this might not work if vite uses another port since we can't know which port vite will use at this point
			// also note capacitor's live-reload seems to override the host even when it's not set and so must be specified in the package.json script :/
			url: `${process.env.VITE_DEV_URL}`,
			cleartext: true,
		} : {
			androidScheme: "https",
		}),
		},
	}
	const mergedConfig = defu(config, baseConfig)
	if (debug) {
		// eslint-disable-next-line no-console
		console.log(mergedConfig)
	}
	return mergedConfig
}
