---
name: easter-eggs
description: Ground rules for designing or implementing easter eggs, hidden features, or secrets in the Useless Machine app (e.g. src/easter-eggs.ts). Use this whenever proposing, brainstorming, reviewing, or coding a new easter egg or hidden behavior for this app, even if the user just says "add something fun" or "hide a secret" without using the words "easter egg" — these constraints apply every time, so check them before designing the feature rather than after.
---

# Easter eggs in the Useless Machine

The Useless Machine is a one-joke app: flip a switch, an arm flips it back off.
Any hidden feature added on top of that has to earn its place. Four rules
keep easter eggs in the spirit of the app instead of turning it into a game
with homework.

## 1. Funny and surprising

The payoff is the whole point — a hidden feature that isn't a little absurd
or unexpected isn't worth adding. Judge a candidate idea by whether it would
make someone laugh or go "wait, what?" the first time they hit it. If the
idea is just a neat technical flourish with no joke in it, it's not an
easter egg for this app.

## 2. No time investment required

Never gate an easter egg behind grinding: no "flip the switch 500 times,"
no "wait 10 minutes," no multi-session progress bars. The whole appeal of
this app is that it's a 5-second joke — an easter egg should be discoverable
within a similarly short, one-off interaction (an unusual click pattern,
a keyboard shortcut, a specific timing, an edge-case input), not a reward
for persistence. If a design only works when the user sticks around, redesign
the trigger, don't ask the user to wait it out.

## 3. Eggs can stack, and can unlock each other

An easter egg is allowed to leave a permanent change behind (a new visual
state, a new capability, a flag in storage), and that permanent change can
be exactly what makes a *different* easter egg reachable — one that wasn't
discoverable in the base state at all. Design with this layering in mind:
when adding a new one, consider both what it does standalone and whether it
opens the door to future ones. Don't assume every egg has to be independent
and self-contained; a small web of eggs that unlock each other is in bounds
and encouraged.

## 4. No racing an unfinished interaction

A trigger must never require starting the egg's interaction while some
other interaction is still mid-completion — e.g. "click here before the
arm finishes resetting" or "tap again before the previous animation ends."
Timing can still be part of a trigger (a specific delay, a rhythm, an
edge-case input) as long as it's self-contained and doesn't depend on
racing something else that's still playing out. Windows like that are
unreliable to hit, especially on a phone screen, and turn discovery into
retry-until-you-land-it grinding — exactly what rule 2 rules out.

*(Added based on feedback from an anonymous user — thank you.)*

## Applying this

When asked to design or implement an easter egg:
- State the trigger (how it's discovered) and the payoff (what happens) explicitly, and sanity-check the trigger against rule 2 — could someone hit it in a normal, short session, or only after grinding?
- Check rule 1 by asking whether the payoff is actually funny/surprising on its own, not just "technically a hidden feature."
- Note whether it leaves a permanent change, and if so, whether that change could plausibly be the key to unlocking another egg later (rule 3) — it doesn't have to, but it's worth a beat of thought.
- Check rule 4: does the trigger require starting it while another interaction is still incomplete? If so, redesign it as a standalone trigger.
