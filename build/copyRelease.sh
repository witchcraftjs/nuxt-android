#!/bin/bash

output_dir=".dist/android"
android_dir="android"

if [[ $# -gt 0 ]]; then
    output_dir="$1"
fi

if [[ $# -gt 1 ]]; then
    android_dir="$2"
fi

mkdir -p "$output_dir"

cp -r "$android_dir/build/outputs/apk/release" "$output_dir/release"
