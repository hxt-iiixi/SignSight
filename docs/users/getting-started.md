# SignSight User Guide

## What SignSight Does

SignSight is a mobile sign recognition app built around two recognition modes:

- `Letters`
  For static hand signs such as alphabet letters and other single-frame signs.
- `Words`
  For dynamic sign and gesture recognition using motion over time plus body context.

The app is designed to help users:

- translate signs in real time through the camera
- see the current predicted result
- view confidence
- switch between static and dynamic recognition modes
- use available trained models when they exist

## Main App Areas

- `Home`
  Entry point for launching translation and navigating the app.
- `Translator`
  Live camera-based prediction experience.
- `Tutorial`
  Guided sign-learning content.
- `Feedback`
  Way to submit product feedback.
- `Settings`
  Device and app preferences.

## Using The Translator

### Letters Mode

Use `Letters` when the sign is mostly still.

What to expect:

- the app tracks the primary hand
- prediction updates live
- confidence is shown alongside the result
- the translator can use the active landmark model

Best results usually come from:

- clear lighting
- one dominant signing hand in frame
- steady positioning
- uncluttered backgrounds when possible

### Words Mode

Use `Words` for dynamic gestures and motion-based signs.

What to expect:

- the app evaluates a short gesture sequence instead of a single frame
- hand motion and pose context both matter
- a gesture model must exist for word prediction to work

If no gesture model is available, the app should show an empty state rather than pretending prediction is active.

## Overlay Behavior

When overlays are enabled:

- `Letters` uses a hand-focused overlay
- `Words` uses gesture-oriented tracking with upper-body context

The default user experience should stay lightweight. More advanced visualization belongs in the developer lab and debug flows.

## Current Product Boundaries

SignSight currently focuses on:

- sign recognition, not full conversational translation
- label-level results, not sentence generation
- live prediction assistance, not full transcription workflow

That means users should think of SignSight as a recognition tool for letters and supported words or gestures, not a complete language understanding system.
