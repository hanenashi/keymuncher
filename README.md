# keymuncher
nastaveni pozirani klaves okounem

## Instalace

Nainstaluj `keymuncher.user.js` do Tampermonkey/Violentmonkey.

Vychozi testovaci stav:

- Keymuncher je zapnuty.
- Blokuje Okounu hole klavesy `j`, `k`, `n`, `?`, `_`.
- Nepouziva `preventDefault()`, takze prohlizec muze dal zpracovat type-ahead-find.
- Nastaveni je dostupne z menu userscript manageru.

Pred finalnim releasem prepneme vychozi stav podle dohody na vypnuto.
