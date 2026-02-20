
# @witchcraft/nuxt-android

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Module for building android. It's similar to the [@witchcraft/nuxt-electron](https://github.com/witchcraftjs/nuxt-electron) module but for android.

## Install
```bash
pnpx nuxi module add @witchcraft/nuxt-android
```

## Usage

A directory structure like the following is suggested:
```

├── .dist/ (I prefer .dist over dist so it stays hidden and at the top)/
│   └── [platform]/
│       ├── .output/ (nuxt output)
│       ├── release/
│       └── build/ (for any intermediate builds like android's)
├── app/ - nuxt code
└── app-android/ - contains all the android code
```

The module provides a base capacitor config that follows the above directory structure when set to build the android part, but you should set the default output to go elsewhere if you're using it (though it's not required):

```ts [nuxt.config.ts]
export default defineNuxtConfig({
	nitro: {
		output: {
			dir: ".dist/web/.output",
			serverDir: ".dist/web/.output/server",
			publicDir: ".dist/web/.output/public"
		}
	}
})
```

The module also sets up the server to point to `VITE_DEV_URL` in dev mode, and manages signing if the proper env variables are availabel.
```ts
// capacitor.config.ts
import { defineCapacitorConfig } from "@witchcraft/nuxt-android/capacitor"

export default defineCapacitorConfig({
	// any properties here are deep merged with defu
	appName: "app",
	appId: "io.ionic.starter",
	// if you need to change the paths:
	webDir: ".dist/capacitor/.output/public/",
// this is undocumented by capacitor but it works
	rootDir: ".dist/capacitor",
	android: {
		path: "app-android",
	}
})
```
For the signing, it sets the buildOptions with the keystore* fields if the following env variables are set:

- `ANDROID_KS_PATH`
- `ANDROID_KS_PASSWORD` or `ANDROID_KS_PASSWORD_PATH`
- `ANDROID_KS_ALIAS`
- `ANDROID_KS_ALIAS_PASSWORD` or `ANDROID_KS_ALIAS_PASSWORD_PATH` (fallsback to `ANDROID_KS_PASSWORD/PASSWORD_PATH`)

The reason for the different env variables if it's a path is because capacitor does not support using `file:` like appsigner does.

If you need to sign manually you can use this script:
```bash
apksigner sign --ks key.keystore --ks-pass file:$ANDROID_KS_PASSWORD_PATH --in android/app/build/outputs/apk/release/app-release-unsigned.apk --out android/app/build/outputs/apk/release/app-release-signed.apk --ks-key-alias $ANDROID_KS_ALIAS
# or using the password directly
apksigner sign --ks key.keystore --ks-pass $ANDROID_KS_PASSWORD --in android/app/build/outputs/apk/release/app-release-unsigned.apk --out android/app/build/outputs/apk/release/app-release-signed.apk --ks-key-alias $ANDROID_KS_ALIASK
```

Next, add the following to the package.json:
```
```jsonc
// package.json
{
	"scripts": {
		"dev": "nuxi dev",
		"build": "nuxi build",
		"preview": "nuxt preview .dist/web",
		"======= android": "=======",
		 // requires an avd named Default_API_{ANDROID_API} to exist (configurable)
		 // also note the use of --host
		"dev:android": "AUTO_OPEN=android nuxi dev --host",
		"build:android": "BUILD_ANDROID=true nuxi build",
		 // requires an avd named Default_API_{ANDROID_API} to exist
		"preview:android": "npm run cap run android -- --target Default_API_$ANDROID_API",
		// optional
		"preview:android:logs": "adb logcat -v color | grep YOUR_APPNAME --color=never | awk '{$3=$4=$6=$7=\"\"; print $0}'",
		// optional
		"android:sync:env": "node ./node_modules/@witchcraft/nuxt-android/build/syncGradleWithEnv.js"
	}
}
```

By default the module will not open android or do an android build. It will only reroute the output of the regular build to `.dist/web`.

You must set `process.env.AUTO_OPEN` to include the string `android` or set `autoOpen `in the options to true. This will point the android build to the dev server. The idea is if you use other platform modules as well, you'd do `AUTO_OPEN=android,android`, etc. for each module you wanted to actually have auto open. 

For auto open to work, you must have created an avd named `Default_API_{ANDROID_API}`.

You must also set the `ANDROID_API` env variable to the api version you want to use (both the scripts and the module use this) or completely override the target name (both in the script and the module.)

To build nuxt for android and also build android, set `BUILD_ANDROID=true` in the env. This will make the root `/` and `/{androidRoute}` pre-rendered spas. Note that `/` requires **you have a redirect here to the android only route\*. A composable `isNativeMobile` is available for this.

```ts
// pages/index.vue
<script setup lang="ts">
if (isNativeMobile()) {
	await navigateTo("/app")
}
</script>

```
\* This is because of an issue [with capacitor](https://github.com/ionic-team/capacitor/issues/3912). It doesn't allow setting a different initial route and using a route redirect makes it go into an infinite loop.

## Gradle Sync (Optional)

If you happen to define your android setup through env variables (you're using something like the nix flake in the monorepo), you can use the `build/syncGradleWithEnv.js` script to sync the gradle variables with those env variables. It needs the variables: 

- `ANDROID_API`
- `ANDROID_HOME`
- `ANDROID_PROJECT_DIR` (optional, defaults to `app-android`)

## Android Files

### Redirecting `/api/` and other routes to the Server

TODO

## Misc Notes 

Regarding the lack of a way to change the entry point, have also attempted the followin which did not work:
	- Attempted to implement this via java but have issues actually redirecting the url. It crashes due to some thread issue.
	- Prerendering "/" and redirecting it to the correct route via a meta tag causes a weird infinite loop :/.
		- Also happens when setting window.location.url via javascript which was the suggested way.



<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@witchcraft/nuxt-android/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/@witchcraft/nuxt-android

[npm-downloads-src]: https://img.shields.io/npm/dm/@witchcraft/nuxt-android.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npmjs.com/package/@witchcraft/nuxt-android

[license-src]: https://img.shields.io/npm/l/@witchcraft/nuxt-android.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/@witchcraft/nuxt-android

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
