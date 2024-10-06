import fs from "fs"

const projectDir = process.env.ANDROID_PROJECT_DIR ?? "app-android"
const variablesFile = `${projectDir}/variables.gradle`

const localPropertiesFile = `${projectDir}/local.properties`

if (process.env.ANDROID_API) {
	// not working :/ https://github.com/ionic-team/capacitor/discussions/7254
	// buildtoolsVersion  = '${process.env.ANDROID_BUILD_TOOLS_VERSION}'
	
	const contents = fs.readFileSync(variablesFile, "utf-8")
	const newContents = contents.split("\n").map(line => {
		if (line.startsWith("compileSdkVersion")) {
			return `compileSdkVersion = ${process.env.ANDROID_API}`
		}
		if (line.startsWith("targetSdkVersion")) {
			return `targetSdkVersion = ${process.env.ANDROID_API}`
		}
		return line
	}).join("\n")

	fs.writeFileSync(variablesFile, newContents)
}


if (process.env.ANDROID_HOME) {
	if (!fs.existsSync(localPropertiesFile)) {
		fs.writeFileSync(localPropertiesFile, "")
	}
	const contents = fs.readFileSync(localPropertiesFile, "utf-8")
	let newContents = contents.split("\n").map(line => {
		if (line.startsWith("sdk.dir")) {
			return `sdk.dir=${process.env.ANDROID_HOME}/share/android-sdk`
		}
		return line
	}).join("\n")
	if (!newContents.includes("sdk.dir")) {
		newContents += `\nsdk.dir=${process.env.ANDROID_HOME}`
	}

	fs.writeFileSync(localPropertiesFile, newContents)
}

