# Midnight Paws: intro cutscene kit (Google Flow / Veo)

A ~48-second intro made of **6 Veo clips, 8 seconds each**. Generate each shot in Flow, then send the clips back; they'll be stitched and added to the game. It plays on first launch, can be skipped, and can be replayed from the menu.

**Story: "The Midnight Heist."** At midnight the Mafia Cat sneaks into Paws' room and steals his fish. Paws wakes up and chases him through the city, the opening of the game.

---

## Settings in Flow

| Setting | Value |
|---|---|
| Model | Veo 3 (or the latest Veo with audio) |
| Mode | **Ingredients to Video** when a shot lists reference images; otherwise Text to Video |
| Aspect ratio | **9:16 (portrait)**: the game is played in portrait. If 9:16 isn't offered, use 16:9; the game will crop the sides. |
| Length | 8 s per clip |
| Outputs | Generate 2–4 per shot and keep the best one |

**Reference images** are in [`references/`](references): upload the ones listed for each shot as ingredients. They're exported from the game itself, so the cats keep the game's look.

| File | Use for |
|---|---|
| `hero_street_cat.png` | Paws, the hero (orange cat) |
| `boss_mafia_cat.png` | Mafia Cat, the thief |
| `boss_ninja_cat.png` / `boss_athlete_cat.png` | Teaser cameo in shot 6 |
| `location_bedroom.png` | Paws' room (in the story, only Paws lives here) |
| `location_night_city_street.png` | City street + mood/palette |
| `location_building_tops.png` / `location_stadium.png` | Later stages (shot 6) |

## Blocks to paste into every prompt

Veo doesn't remember previous clips, so each prompt repeats the same character and style text. That's what keeps the shots consistent.

**Style (every shot):**
```
Style: stylized 3D animated short film, soft rounded cartoon characters with simple shapes, cinematic night lighting, deep navy and charcoal tones with warm amber window light and a few soft neon accents, gentle rim light, shallow depth of field, smooth slow camera motion. Vertical 9:16 framing.
```

**Paws (hero):**
```
Paws: a small chubby orange cat with plain bright orange fur (no stripes), an oversized round head, big round black eyes with white highlights, a small pink nose, pink inner ears, short stubby legs and a curly tail.
```

**Mafia Cat:**
```
Mafia Cat: a chubby charcoal-grey cat wearing a navy pinstripe suit with a white shirt and red tie, a black fedora with a yellow band, black rectangular sunglasses, and an unlit brown cigar.
```

**Avoid (end of every prompt):**
```
Avoid: on-screen text, subtitles, logos, watermarks, humans, realistic fur, scary or violent imagery, extra limbs, changing the cats' colors or outfits.
```

---

## Shot list

### Shot 1: Midnight city (establishing)
Ingredients: `location_night_city_street.png`
```
A quiet city at midnight seen from above: dark skyscrapers with only a few warm lit windows, a full moon, empty streets lit by soft street lamps. The camera glides slowly down over the rooftops toward a single apartment window glowing warm amber. Audio: distant city ambience, soft piano and strings, a clock ticking.
[Style block] [Avoid block]
```

### Shot 2: Paws asleep
Ingredients: `hero_street_cat.png`, `location_bedroom.png`
```
[Paws block] Inside a cozy bedroom at night, Paws is curled up asleep on a cushion next to a bowl piled high with shiny blue fish. Moonlight falls through a big window with a city view. A wall clock's hands move to midnight; Paws' ear twitches in his sleep. Slow push-in. Audio: soft purring snore, a clock chiming twelve.
[Style block] [Avoid block]
```

### Shot 3: The heist
Ingredients: `boss_mafia_cat.png`, `location_bedroom.png`
```
[Mafia Cat block] The bedroom window creaks open and Mafia Cat slips inside, tiptoeing comically past the sleeping orange cat. He scoops the whole bowl of shiny fish into a sack, turns to the camera, tips his fedora with a smug grin, and leaps back out of the window into the night. Audio: sneaky pizzicato strings, a window creak, fish clinking.
[Style block] [Avoid block]
```

### Shot 4: Paws wakes up
Ingredients: `hero_street_cat.png`, `location_bedroom.png`
```
[Paws block] Paws blinks awake, stretches, and looks at his fish bowl: it's empty. His eyes go wide, his fur puffs up in shock, then his face turns determined. He hops off the cushion and dashes toward the open window, curtains blowing. Audio: a surprised meow, a dramatic musical sting.
[Style block] [Avoid block]
```

### Shot 5: The chase begins
Ingredients: `hero_street_cat.png`, `boss_mafia_cat.png`, `location_night_city_street.png`
```
[Paws block] [Mafia Cat block] Side-tracking shot along the middle of a dark, empty city street at night: Paws sprints from left to right, leaps over a metal trash can and dodges the headlights of a small blue car. Far ahead, Mafia Cat runs away carrying a sack of fish over his shoulder. Street lamps cast soft pools of light. Audio: upbeat playful chase music, quick paw steps, a car horn whooshing past.
[Style block] [Avoid block]
```

### Shot 6: The road ahead (teaser + ending)
Ingredients: `hero_street_cat.png`, `boss_ninja_cat.png`, `location_building_tops.png`
```
[Paws block] Paws skids to a stop at the edge of a rooftop and looks out over the glowing night city, wind ruffling his fur. In the distance, a black ninja cat with a red headband watches from the top of a water tower against the full moon, and far away the floodlights of a stadium glow on the horizon. The camera slowly pulls up and away, leaving empty sky at the top of the frame for a title. Audio: music swells to a hopeful finish, gentle wind.
[Style block] [Avoid block]
```

The game will show the **MIDNIGHT PAWS** title over the end of shot 6, so don't ask Veo for text (it usually misspells it).

**Shorter version (~24 s):** use shots 2, 3 and 5 only.

---

## Tips

- If a cat drifts off-model (wrong color, stripes, extra tail), regenerate that shot with the hero reference image attached. Don't try to fix it with more words.
- Keep the camera slow; fast cuts inside one Veo clip often warp.
- Veo's music changes between clips. If the joins sound rough, export without audio and ask for one music track to be laid over the whole intro instead.

## Sending the video back

- Download each finished clip as **MP4** (1080p if offered), or stitch them in Flow's Scenebuilder and export one MP4.
- Name them in order (`shot1.mp4` … `shot6.mp4`) and send them over.
- They'll be stitched, compressed for the APK (target under ~15 MB), and added to the game:
  - plays once on first launch, with a **Skip** button
  - the **MIDNIGHT PAWS** title fades in at the end
  - a **Watch Intro** button in the menu replays it
  - if the video can't play on a device, the game just carries on
