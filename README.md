# keymuncher

Nastaveni pozirani klaves Okounem.

## Instalace

[Nainstalovat Keymuncher](https://raw.githubusercontent.com/hanenashi/keymuncher/main/keymuncher.user.js)

Odkaz otevri v prohlizeci s Tampermonkey nebo Violentmonkey. Spravce userscriptu by mel nabidnout instalaci nebo aktualizaci.

## Co to resi

Okoun ma globalni klavesove zkratky:

- `j` dalsi prispevek
- `k` predchozi prispevek
- `n n` nejstarsi neprecteny prispevek
- `?` / `_` napoveda ke zkratkam

Na Firefoxu to rozbije type-ahead-find, tedy hledani odkazu nebo textu prostym psanim na strance. Browserova funkce neni textove pole, takze Okoun zachyti hole pismeno driv, zavola `preventDefault()` a Firefox uz se ke klavese nedostane.

Keymuncher prida vlastni capture-phase `keydown` listener, ktery vybrane hole klavesy zastavi jeste pred okounim handlerem. Pri beznem blokovani nepouziva `preventDefault()`, takze prohlizec muze klavesu dal zpracovat.

## Vychozi testovaci stav

- Keymuncher je zapnuty.
- Blokuje Okounu hole klavesy `j`, `k`, `n`, `?`, `_`.
- Nastaveni je dostupne z jedne polozky v menu userscript manageru: `Keymuncher settings`.
- Nastavovaci popup pouziva `keymuncher.png` jako ikonku.
- Remapy jsou pripravene, ale vypnute.

Pred finalnim releasem prepneme vychozi stav podle dohody na vypnuto.

## Nastaveni

Popup umi:

- zapnout nebo vypnout Keymuncher
- vybrat rezim blokovani: vsechny okouni klavesy, jen `n+k`, nebo custom
- nastavit vlastni seznam blokovanych klaves
- zapnout remapy
- nastavit remapy pro dalsi prispevek, predchozi prispevek a nejstarsi neprecteny
- docasne vypnout Keymuncher do reloadu
- vratit vychozi nastaveni

Kdyz je Keymuncher vypnuty, necha Okoun klavesy zpracovat normalne. Nastaveni zustava pristupne pres menu userscript manageru.

## Technicke poznamky

Userscript bezi na:

- `https://www.okoun.cz/*`
- `http://www.okoun.cz/*`

Pouziva:

- `@run-at document-start`, aby byl listener zaregistrovany pred okounim skriptem
- `GM_getValue` / `GM_setValue` pro ulozene nastaveni
- `GM_registerMenuCommand` pro jednu polozku nastaveni
- `GM_getResourceURL` a `@resource keymuncherIcon` pro popup ikonku

Remapy nevolaji okouni interni funkce, protoze jsou uzavrene uvnitr IIFE v `main.js`. Misto toho Keymuncher lokalne najde `.listing .item:not(.ignored)` a posouva stranku na prislusny prispevek.

## Vyvoj

Rychla syntax kontrola:

```powershell
node --check .\keymuncher.user.js
```

Aktualni ikonka:

```text
keymuncher.png
```
