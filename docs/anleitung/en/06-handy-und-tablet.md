<!-- Generated from anleitung/en/ with `npm run anleitung`. Edit there, not here. -->

# Phone and tablet

Through a separate access you reach the deck from a phone or tablet: you see what is waiting, answer questions with a tap and deliver photos and audio a session has asked for.

## Setting up

1. Open **Settings**, section **Phone and tablet**, and turn the access on.
2. The access listens on this machine only. A forwarder with HTTPS in your own network brings it to the device, for example `tailscale serve`. Without HTTPS the browser on the phone does not release the microphone.
3. Enter the address under which the device reaches the access, and save.
4. Copy the address shown, open it on the device and add it to the home screen.

The address contains the key. Whoever knows it can deliver and answer questions. **New key** makes the old address invalid.

## What the page shows

- **What is waiting for you:** questions with their options to tap, sessions that are done or waiting, notes to tick off.
- **Photos and audio:** requests from sessions. You record or choose from the library, add a note if you like and send. Without a request you can deliver something to a project on your own.

No free text goes from the device into a session as input: for questions you only choose among the options the session itself named. A note on a delivery ends up in a file, and the session receives only the path.

## How a session asks for something

The session calls `coop anfordern "<what it needs>"`. The request appears in the inbox and on the device. Your delivery then lies in the project under `.coop/`, and the session receives a line with the path. Audio is also turned into text locally if dictation is set up (see [Dictation and reading aloud](08-diktat-und-vorlesen.md)).
