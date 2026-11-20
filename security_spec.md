# Security Specification — Boda Jessica Guadalupe & Jorge Luis

## 1. Data Invariants
1. **PII Isolation (`rsvps` vs `seating_entries`)**: Guest contact details (`phone`, `notes`, decline records) are stored strictly in `/rsvps/{rsvpId}` and may only be read, listed, updated, or deleted by verified couple administrators (`ing.hectorrodas@gmail.com` or `jorgerodad@gmail.com` with `email_verified == true`).
2. **Public Seating Plan (`seating_entries`)**: Contains only non-PII display names, surname tokens, seat counts, and table numbers. Anyone can create a seating entry alongside an RSVP with strict key/type/size validation, while only verified couple admins can modify or remove entries.
3. **Collaborative Wedding Album (`wedding_photos`)**: Guests can upload compressed JPEG/WebP images (`<= 480000` chars) with `visible == true`. Public queries only list documents where `visible == true`; hidden photos (`visible == false`) are readable/listable only by verified couple admins.
4. **Admin Settings & Roles (`wedding_settings`, `admins`)**: Only verified couple admins can write `/wedding_settings/{configId}` or manage `/admins/{uid}`.
5. **Hero Carousel & Ambient Audio (`wedding_hero_photos`, `wedding_audio_chunks`)**: Public guests may only read active hero photos (`active == true`) and audio chunks (`totalChunks <= 24`); only verified couple admins can upload, reorder, hide, or delete hero photos and audio tracks.
6. **Strict Timestamps & Path IDs**: All document IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and all `createdAt` / `updatedAt` timestamps must equal `request.time`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return `PERMISSION_DENIED`)
1. **Shadow Field Injection on RSVP Create**: Payload with all valid RSVP keys plus `"isAdmin": true`.
2. **Oversized Guest Name on RSVP Create**: `guestName` string of 500 characters (`> 120`).
3. **Client-Spoofed Timestamp on RSVP Create**: `createdAt` set to a past date instead of `request.time`.
4. **Unauthenticated List Scrape on `/rsvps`**: Unauthenticated `list` or `get` on `/rsvps`.
5. **Unverified Admin Email Spoof on `/rsvps`**: Auth token with `email == "ing.hectorrodas@gmail.com"` and `email_verified == false`.
6. **Unauthorized Admin Email on `/rsvps`**: Auth token with `email == "attacker@gmail.com"` and `email_verified == true`.
7. **PII Leak in `/seating_entries`**: Attempting to create a `seating_entries` doc containing a `phone` or `email` field.
8. **Hidden Photo Creation Abuse**: Guest creating a `/wedding_photos` doc with `visible: false` or invalid `imageData` prefix (e.g., `javascript:alert(1)`).
9. **Oversized Document DoS on `/wedding_photos`**: Guest submitting `imageData` larger than `480000` characters.
10. **Public Read of Hidden Photo**: Unauthenticated `get` or `list` targeting a `wedding_photos` document with `visible == false`.
11. **Non-Admin Moderation Update**: Guest attempting `update` on `/wedding_photos/{id}` to hide or edit another guest's photo.
12. **Path ID Poisoning**: Creating `/rsvps/invalid$id..` or ID longer than 128 characters.
