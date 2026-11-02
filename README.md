# Jump & Spin Lab

A React Native (Expo SDK 58) app that measures **jump height** with the accelerometer and **mid-air rotation** with the gyroscope.
It has player profiles, per-category rankings and a pass-the-phone match mode on a single device. There is no backend; data is stored on the device in SQLite.

## Run
```bash
npm install
npx expo start            # scan the QR code with Expo Go on a real phone (emulators have no usable sensors)
npx expo start --tunnel   # if the phone cannot reach the computer on the local network
npm test                  # unit tests for the detectors and the ranking logic
npm run typecheck
```

## How the jump is measured
| Value | Method |
|---|---|
| Height | During flight \|a\| ≈ 0 g; measure the flight time `t`, then `h = g·t² / 8` |
| Rotation | Find the vertical axis from the gravity direction while standing still, then integrate `ω·ĝ` over the flight (falls back to \|ω\| if no gravity direction is known) |
| Impact | Peak \|a\| within 200 ms of landing |

State machine: `armed → candidate (<0.4 g for ≥30 ms) → flight (ends when >0.8 g for ≥20 ms) → landing → cooldown`

Rejected as not-a-real-jump (defaults in `src/lib/jumpDetector.ts`):
- a push-off of ≥ 1.4 g within 500 ms before take-off is required (stops phone throwing)
- flight time 150–900 ms
- a landing impact of ≥ 2 g
- no sensor gap longer than 60 ms

## Fair scoring
**Measured values (cm, degrees, ms) are always shown as measured.** The **score** is a separate number so people of different weight, age and sex can compete.

| Step | Formula |
|---|---|
| Leg power | `P = 60.7·h + 45.3·m − 2055` W (h = jump height in cm, m = body mass in kg), Sayers et al. (1999) *Med Sci Sports Exerc* 31(4):572–577 |
| Body size | `P ÷ m^0.67` (allometric scaling) |
| Age and sex | divide by the expected value for that age / sex |
| Points | `100 × (player value ÷ reference)`; 100 points = a young man, 70 kg, jumping 40 cm |

Caveats:
- The Sayers equation is the **squat jump** equation the authors recommend; on countermovement jumps it overestimates by about 2.7 % (the same for everyone, so fairness is unaffected).
- **The age/sex factors are not from a published norm table.** They are the app's estimates (peak power at age 20–29, roughly −1 %/year after 30, lower for children; female ×0.8). Edit them in one place: `AGE_POWER_CURVE` and `SEX_FACTOR` in `src/lib/scoring.ts`.
- The equation was developed on adults, so results for under-15s are less accurate.
- Body height is not part of the score (no standard formula); it is used for the "per body height" ranking.

## The 5 sports (one match system)
Every sport uses the same flow: pick a sport + 2–4 players → the first player enters their details and plays every round → summary card (measured value, points, current rank) → pass the phone → scoreboard + podium.
Final score = best round; ties are broken by the mean of all rounds. 100 points = the reference value of each sport.

| Sport | Sensors | Rounds | Measures | Points | Adjusted for |
|---|---|---|---|---|---|
| 🏀 High Jump | Accel | 3 | height from flight time | Sayers equation (above) | weight, age, sex |
| 🌀 Spin Jump | Accel + Gyro | 3 | degrees rotated | `100 × deg ÷ (360 × √ageFactor)` | age |
| ⚡ Sprint Start | Accel + Gyro | 3 | time from the start cue to the first movement (ms); quicker than 100 ms = **false start** (0 pts) | `100 × expected(age) ÷ time` (reference 300 ms) | age |
| ⚾ Throw Speed | Accel + Gyro | 3 | peak speed of the forearm during an overarm throw (km/h), phone strapped near the wrist | `100 × speed ÷ expected(age, sex)` (reference 50 km/h) | age, sex |
| 🧘 One-Leg Balance | Accel + Gyro | 3 | time stood (max 20 s) and sway (RMS milli-g after a high-pass filter) | `100 × (time ÷ 20) × min(1.5, expectedSway(age) ÷ sway)` | age |

### Sprint start cue
"On your marks" (voice) → the app waits until the player is still for 1 s → "Set" (voice) → random 1.5–4 s wait → **strong vibration + "Go!" (voice) + full-screen GO**.

The vibration is the timed cue. It lasts at most `CUE_MS` = 120 ms (`src/lib/reaction.ts`): one continuous buzz on Android, three heavy taps on iOS (iOS ignores vibration length). The phone's own buzz shakes the sensor, so movement in the first 150 ms after the cue is not judged; a unit test makes sure the cue always ends inside that window. The spoken "Go!" is a backup and arrives a little later.

### Throw speed
`src/lib/throwSpeed.ts`. While the player holds still, the accelerometer reading is gravity alone (`f0`). During the throw the gyroscope tracks the phone's orientation `R`, so gravity is removed from every reading: `a = 9.81 · (R·f − f0)`. Integrating `a` gives the phone's velocity, and the peak is reported in km/h. The velocity is reset to 0 whenever the phone is still, so drift does not build up. Unit tests simulate an arm swinging on a rigid lever (any strap orientation, both accelerometer sign conventions, with noise) and check the speed is recovered within 5–10 %.

### Reference values need care
The 100-point references of Sprint Start, Throw Speed and Balance **are starting estimates, not published norms** (see `src/lib/scoring.ts`).
To calibrate: have 5–10 friends play each sport and set the reference to the group median.

Per-sport limitations:
- **Sprint start**: the time includes the vibration and sensor latency of that phone. Compare players on the same phone, not with lab figures.
- **Throw speed**: this is the speed of the forearm where the phone sits, not the ball speed (the hand and ball move faster). Phone accelerometers usually top out at about 8–16 g and a hard throw can exceed that; when the sensor clips, the app says so and the real speed was probably higher. Strap the phone tightly and never let go of it.
- **Balance**: slow leaning is reduced by about 85 %, not removed. A raised foot touching down is detected from the impact on the thigh.

## Technique demos
Before every round (and on the Match Setup screen) an animated stick figure shows how to do the test so the sensors read it correctly: where the phone goes (highlighted), the start position of the arms and legs, the movement step by step with captions, and the most common mistake to avoid. Poses live in `src/lib/technique.ts` as key frames of end points (hip, feet, hands); knees and elbows are solved with two-bone IK so limbs keep their length (unit-tested). With the system "reduce motion" setting on, the demo steps through still poses instead of animating.

## Rankings and history
- Sport tabs: Jump / Start / Throw / Balance (non-jump results come from Match Mode).
- The Jump tab has "Score" (adjusted), "Height", "Spin" and "Per body height", filterable by sex and age group.
- Rank = mean of the best 3 attempts; at least 3 attempts are needed to be ranked.

## Limitations
- Results are estimates (about 1–3 cm error depending on the phone's sensor rate). Good for comparing people, not a lab instrument.
- Tucking the knees in flight makes the flight time, and so the height, too high.
- There is no camera, so cheating can only be caught at the signal level.

## Structure
```
src/lib/        pure logic (jumpDetector, reaction, throwSpeed, balance, sports, scoring, ranking, match) + tests
src/db/         SQLite (players, jumps, matches, attempts)
src/hooks/      sensor hooks (useJumpSensor, useSensorStream, useSensorStatus) and countdown
src/components/ sports-style UI, JumpCapture, ScoreTable, Podium
src/components/capture/  play screen of each sport (same props, chosen by SportCapture)
src/app/        screens (expo-router)
```

## Testing on a real phone (still to do)
1. Open the "Sensors" screen, jump and watch the graph: check the rate is ≥ 50 Hz and that \|a\| drops below the 0.4 g line in flight.
2. Film in slow motion to compare flight time, or use a ruler on a wall, and record the error.
3. Tune `DEFAULT_CONFIG` if jumps are missed or detected wrongly (use "Share the last 10 s of raw data" to capture signals for analysis).
4. Test the sprint start cue in a pocket: the buzz must be easy to feel and must never trigger a start by itself.
5. Test on both Android and iPhone.
