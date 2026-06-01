# ShareTable Studio

Samostatne demo pre farebny mesacny content plan a klientsky approval.
Demo je pripravene ako white-label produkt pre social media freelancerov,
virtualne asistentky a male agentury.

## Pozicioning

Clean shared monthly content planner for social media managers and small teams.
It separates Instagram, TikTok, LinkedIn, and Facebook content so each network
has its own rhythm, format, caption style, approval flow, and preview.

The UI may reference platform names for planning purposes, but it does not copy
protected logos, exact layouts, or branded interfaces.

## MVP rozsah

- brandovana staticka appka,
- mesacny kalendar obsahu pre 4 siete,
- farebne filtre Instagram / TikTok / LinkedIn / Facebook,
- pridavanie postov s textom,
- upload obrazkov a videi do demo nahladu,
- approval workflow,
- social-style nahlady priamo v mesacnom kalendari,
- klientsky komentar,
- XLS export,
- volitelny Supabase cloud rezim s magic link loginom,
- workspace kod pre klienta alebo kolegynu,
- Netlify deploy bez build kroku.

## Predajny uhol

Pre ludi, ktori dnes schvaluju obsah cez Google Sheets, WhatsApp, e-mail alebo
chaoticke Notion tabulky. Nejde o dalsi velky scheduler, ale o jednoduchy
klientsky approval portal.

## Zapnutie Supabase cloudu

Ukazky:

- klasicka verzia so share kodom: `/sharetable-studio/`
- cloud verzia s loginom: `/sharetable-studio/?version=cloud`
- kratka presmerovacia URL pre cloud: `/sharetable-studio-cloud/`

1. V Supabase vytvor novy projekt.
2. V SQL Editore spusti `supabase-schema.sql`.
3. V Project Settings > API skopiruj Project URL a anon public key.
4. V subore `supabase-config.js` dopln hodnoty podla `supabase-config.example.js`.
5. Deployni na Netlify. Lokalne demo stale funguje aj bez tychto udajov.

Appka uklada content plan ako JSON payload. Fotky v lokalnom deme ostavaju v
prehliadaci; produkcna verzia by mala pridat Supabase Storage pre vacsie media.

## Dalsi upgrade

- sukromne linky pre klientov,
- e-mail notifikacie,
- viac klientov v jednej administracii.
- neskor mozna API integracia na publikovanie, ale nie ako prvy MVP rozsah.
