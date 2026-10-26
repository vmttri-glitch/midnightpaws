# Midnight Paws 🐾

An endless runner about a stray cat sprinting through the city at midnight. Dodge traffic, leap between rooftops and outrun three bosses, then spend the fish you collect on new cats, rooms and gear.

**▶ Play in your browser:** https://vmttri-glitch.github.io/midnightpaws/
**📱 Android APK:** download the latest `.apk` from [Releases](https://github.com/vmttri-glitch/midnightpaws/releases)

## How to play

| | Phone | Desktop |
|---|---|---|
| Jump | Tap | Space / ↑ / Click |
| Double jump | Tap again in the air | Press again |
| Cat ability | Swipe right | E / Enter / → |
| Pause | Pause button / Back | Esc / P |

The first time you meet a new obstacle, power-up or boss, the game pauses and points it out. Use **How to Play** in the menu to see those tips again.

## Stages

| Stage | Area | Boss (10,000m in) | First win unlocks |
|---|---|---|---|
| 1 | Night City | Mafia Cat | Building Tops, Mafia Cat, Invincible Fish, Slow Time |
| 2 | Building Tops | Ninja Cat | The Stadium, Ninja Cat |
| 3 | The Stadium | Athlete Cat | Athlete Cat, Fish Cannon |

Stage 4 is under development.

## Development

Requirements: Node.js 20+.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production web build in dist/
npm run lint     # type-check
```

Publish the web version to GitHub Pages (the `gh-pages` branch):

```bash
npm run deploy:web
```

### Android APK

The Android app wraps the web build with [Capacitor](https://capacitorjs.com/). You need **JDK 21** (set `JAVA_HOME` to it) and the Android SDK (platform 36, e.g. via Android Studio).

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug   # → android/app/build/outputs/apk/debug/app-debug.apk
```

## Tech

React 19 · TypeScript · Vite · Tailwind CSS · HTML5 Canvas (all game art is drawn in code) · Web Audio (procedural sound) · Capacitor for Android.
