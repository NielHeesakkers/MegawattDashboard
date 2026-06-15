# Auth-flow: wachtwoorden, reset & user aanmaken

Herbruikbaar patroon voor login, wachtwoord-reset en het aanmaken van gebruikers.
Stack hier: Express + Prisma (SQLite) + bcryptjs + JWT + e-mail. De principes zijn
framework-onafhankelijk; alleen de Prisma-/Express-syntax is specifiek.

## Bouwstenen

- **bcrypt** — wachtwoorden worden nooit als platte tekst opgeslagen, alleen als hash (`passwordHash`, cost 10).
- **JWT** — na login krijgt de client een ondertekend token (24u geldig) dat 'ie als `Authorization: Bearer <token>` meestuurt.
- **PasswordResetToken-tabel** — éénmalig bruikbare, verlopende links voor zowel "wachtwoord instellen" (nieuwe user) als "wachtwoord vergeten".
- **E-mail** — levert de reset-/setup-link af (de gebruiker zet zélf het wachtwoord; de admin ziet 't nooit).
- **Rate limiting per IP** — op alle auth-endpoints, tegen brute-force.

## Datamodel

```prisma
model User {
  id           Int      @id @default(autoincrement())
  username     String   @unique          // hier = email
  email        String?
  passwordHash String                    // bcrypt-hash, nooit platte tekst
  role         String   @default("user") // admin | superuser | user
  allowedTabs  String   @default("[]")   // JSON: fijnmazige rechten
  resetTokens  PasswordResetToken[]
}

model PasswordResetToken {
  id        Int      @id @default(autoincrement())
  token     String   @unique             // 32 random bytes, hex
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

## Flow 1 — User aanmaken (door admin)

`POST /users` (admin-only). De admin geeft alleen **e-mail + rol** op; **geen wachtwoord**.

1. Valideer e-mail, check uniek (`username` én `email`).
2. Zet een **wegwerp-hash** als `passwordHash` (`bcrypt.hash(random 32 bytes)`). Niemand kan ermee inloggen → het account is "slapend" tot de gebruiker zelf een wachtwoord zet. (Optioneel mag de admin tóch een wachtwoord meegeven; dan wordt dát gehasht.)
3. Maak de user aan met rol + rechten.
4. Stuur een **welkomstmail** met een setup-link: maak een `PasswordResetToken` (geldig **7 dagen**) en mail `${origin}/reset-password/${token}`.
5. De gebruiker klikt → komt op de reset-pagina → kiest een wachtwoord (zie Flow 3, stap 3-4).

Kernidee: de admin kent het wachtwoord nooit; de gebruiker stelt 't zelf in via een tijdelijke link.

## Flow 2 — Inloggen

`POST /login` met `{ username (= email of username), password }`.

1. Rate-limit-check op IP.
2. Zoek user op `username` OF `email` (lowercased).
3. `bcrypt.compare(password, user.passwordHash)`. Mislukt → **één generieke fout** ("onjuist e-mailadres of wachtwoord", geen onderscheid of de user bestaat) + `recordAttempt(ip)`.
4. Gelukt → `resetAttempts(ip)` en geef een **JWT** terug:
   ```js
   jwt.sign({ id, username, role }, JWT_SECRET, { expiresIn: '24h' })
   ```
5. Client bewaart het token (localStorage) en stuurt het als `Authorization: Bearer …`. Een `authMiddleware` verifieert het token op beveiligde routes.

## Flow 3 — Wachtwoord vergeten & reset

**Aanvragen** — `POST /forgot-password` met `{ email }`:

1. Rate-limit-check.
2. **Anti-enumeratie:** geef *altijd* hetzelfde succes-bericht terug ("als dit adres bekend is, is een link verstuurd"), of de user nu bestaat of niet.
3. Bestaat de user wél: maak een `PasswordResetToken` (geldig **1 uur**) en mail `${origin}/reset-password/${token}`.

**Controleren** — `GET /reset-password/:token/check`: bestaat het token, niet `used`, niet verlopen? Gebruikt door de reset-pagina om meteen te tonen of de link nog geldig is.

**Instellen** — `POST /reset-password` met `{ token, newPassword }`:

1. Rate-limit + validatie (min. 6 tekens).
2. Zoek het token; weiger als het niet bestaat, al `used` is, of verlopen (`expiresAt < now`).
3. In één transactie:
   - `user.passwordHash = bcrypt.hash(newPassword, 10)`
   - markeer dít token als `used`
   - markeer **alle andere openstaande tokens** van deze user als `used` (zo werkt een oude link nooit meer).

Dezelfde reset-pagina + endpoints bedienen zowel de welkomstmail (nieuwe user, 7-daagse link) als "wachtwoord vergeten" (1-uurs link) — het verschil is alleen de geldigheidsduur.

## Belangrijke keuzes (overal herbruikbaar)

- Wachtwoorden alleen als **bcrypt-hash** (cost 10), nooit platte tekst, ook niet in logs/backups.
- Reset-tokens: **32 willekeurige bytes**, **éénmalig** (`used`), **verlopend**, en bij gebruik worden alle andere tokens van die user ingetrokken.
- **Generieke antwoorden** bij login én forgot-password → lek niet welke e-mailadressen bestaan.
- **Rate limiting per IP** op login/forgot/reset.
- **JWT met expiry**; rollen + rechten zitten in het token-/user-record, niet in de client.
- Nieuwe users krijgen een **wegwerp-hash** → account onbruikbaar tot de gebruiker zelf een wachtwoord zet via de link.
- `JWT_SECRET` uit een environment-variabele, niet hardcoded.
