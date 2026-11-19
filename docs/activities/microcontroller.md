# Level 4: Microcontroller lab (intermediate)

Activity id: `micro` (needs adding to `ActivityId` in src/core/events.ts, see the PR).
On screen: **"Simplified microcontroller model"**. No brand names on the board or in the UI.

## Learning outcome
**I can wire an LED and a distance sensor to a microcontroller and program it to react.**
Concepts: pins (power, ground, digital), polarity, inputs vs outputs, a sensor reading, IF / ELSE.

## Parts (built in code from simple shapes)
- **Microcontroller board**: blue, "Uno-style". Header pins printed on the board: **5V, GND, D13, D7, D8**. USB port, main chip.
- **LED**: long leg (+) red, short leg (-) dark. Pinch / click the LED body to flip it (as in Level 3).
- **Distance sensor** (ultrasonic): two round "eyes", pins **VCC, TRIG, ECHO, GND**.

## Steps
1. **Wire it.** Pinch / tap one dot, then another, to add a wire (as in Level 3). UNDO, CLEAR, POWER.
   Correct wiring: LED + → D13, LED - → GND, sensor VCC → 5V, GND → GND, TRIG → D7, ECHO → D8.
   A board pin may take more than one wire (both GNDs go to GND). POWER checks the wiring in this order and shows the first problem:
   1. 5V and GND joined → `SHORT_CIRCUIT`
   2. LED legs on D13/GND but the wrong way round → `LED_REVERSED`
   3. LED + on D13 but LED - not on GND → `NO_GND`
   4. LED + not on D13 (another pin, or not wired) → `LED_WRONG_PIN`
   5. Sensor GND not on GND → `NO_GND`
   6. Sensor VCC / TRIG / ECHO not on exactly its pin → `SENSOR_MISWIRED` (detail: which sensor pin)
   All correct → "Wired! Now program it." → step 2.
2. **Program it.** Block buttons (Level 2 style): **IF NEAR** (distance < 20 cm), **ELSE**, **LED ON**, **LED OFF**; UNDO, CLEAR, RUN. 4 slots.
   Correct program: `IF NEAR · LED ON · ELSE · LED OFF`. On RUN:
   - not the shape IF NEAR, action, ELSE, action (missing or extra blocks, wrong order) → `PROGRAM_INCOMPLETE`
   - right shape but the LED is not ON when near and OFF when far → `LOGIC_REVERSED`
   - correct → step 3.
3. **Test it.** Distance = the player's hand to the sensor in the headset (closest hand, if within 60 cm), or the big DISTANCE slider in the browser (also usable in the headset). The LED follows the program live. **Complete** when the LED has turned ON and then OFF again once.

## Stars
Completion stars from mistakes across the whole level, as Level 3: 3 = no mistakes, 2 = 1-2 mistakes, 1 = 3 or more (`mistakeStars`).

## Mistake codes and built-in hints (max 2 sentences, explain why)

| Code | When | Hint (en) | Hint (sw) |
| --- | --- | --- | --- |
| `LED_WRONG_PIN` | LED + is not wired to D13 | The program switches pin D13. Wire the LED's long leg (+) to D13. | Programu inawasha pini D13. Unganisha mguu mrefu (+) wa LED kwenye D13. |
| `LED_REVERSED` | LED legs on D13 and GND but backwards | LEDs only work one way. The long leg (+) goes to D13 and the short leg to GND. | LED huwaka ikiunganishwa upande mmoja tu. Mguu mrefu (+) uende D13 na mfupi uende GND. |
| `NO_GND` | LED - or sensor GND not on GND | Current needs a way back to the board. Connect the part's GND or short leg to a GND pin. | Mkondo unahitaji njia ya kurudi kwenye bodi. Unganisha GND au mguu mfupi kwenye pini ya GND. |
| `SENSOR_MISWIRED` | Sensor VCC/TRIG/ECHO not on 5V/D7/D8 | Each sensor pin has one job. VCC goes to 5V, TRIG to D7 and ECHO to D8. | Kila pini ya kihisi ina kazi moja. VCC iende 5V, TRIG iende D7 na ECHO iende D8. |
| `SHORT_CIRCUIT` | 5V wired straight to GND | That's a short circuit: 5V joined straight to GND. Power must go through a part first. | Hiyo ni saketi fupi: 5V imeunganishwa moja kwa moja na GND. Umeme lazima upite kwenye kifaa kwanza. |
| `PROGRAM_INCOMPLETE` | Program isn't IF NEAR, action, ELSE, action | A decision needs both branches. Use IF NEAR, an action, ELSE, then an action. | Uamuzi unahitaji pande zote mbili. Tumia IF NEAR, kitendo, ELSE, kisha kitendo. |
| `LOGIC_REVERSED` | LED isn't ON when near and OFF when far | Check what each branch does. LED ON belongs under IF NEAR, LED OFF under ELSE. | Angalia kila upande unafanya nini. LED ON iwe chini ya IF NEAR, LED OFF chini ya ELSE. |

Events: `activity_started` (micro, challenge 0), actions `add_wire`, `flip_led`, `undo`, `clear`, `power`, `add_<block>`, `run`, `distance`, mistakes above, `activity_completed` on the ON-then-OFF test.

## Simplifications (say so on screen)
No resistor on the LED (real boards need one), no timing of the echo pulse: the sensor reports the hand distance directly. Not an electrical simulation.
