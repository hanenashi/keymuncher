# Keymuncher

Nastavení požírání kláves Okounem.

## Instalace

[Nainstalovat Keymuncher](https://raw.githubusercontent.com/hanenashi/keymuncher/main/keymuncher.user.js)

Odkaz otevři v prohlížeči s Tampermonkey nebo Violentmonkey. Správce userscriptů by měl nabídnout instalaci nebo aktualizaci.

## Co To Řeší

Okoun má globální klávesové zkratky:

- `j` další příspěvek
- `k` předchozí příspěvek
- `n n` nejstarší nepřečtený příspěvek
- `?` / `_` nápověda ke zkratkám

Na Firefoxu to rozbije type-ahead-find, tedy hledání odkazu nebo textu prostým psaním na stránce. Browserová funkce není textové pole, takže Okoun zachytí holé písmeno dřív, zavolá `preventDefault()` a Firefox už se ke klávese nedostane.

Keymuncher přidá vlastní capture-phase `keydown` listener, který vybrané holé klávesy zastaví ještě před okouním handlerem. Při běžném blokování nepoužívá `preventDefault()`, takže prohlížeč může klávesu dál zpracovat.

## Výchozí Testovací Stav

- Požírání kláves je vypnuté, takže Keymuncher Okounu blokuje holé klávesy `j`, `k`, `n`, `?`, `_`.
- Nastavení je dostupné z jedné položky v menu userscript manageru: `Keymuncher settings`.
- `?` nebo `_` otevře okno Keymuncheru místo původní okouní nápovědy.
- Nastavovací popup používá `keymuncher.png` jako ikonku.
- Remapy jsou připravené, ale vypnuté.

Před finálním releasem přepneme výchozí stav podle dohody na požírání zapnuté, tedy bez zásahu do Okouna.

## Nastavení

Popup umí:

- zapnout nebo vypnout požírání kláves
- zobrazit okouní zkratky `j`, `k`, `n n`, `?` / `_`
- zapnout remapy
- nastavit remapy pro další příspěvek, předchozí příspěvek a nejstarší nepřečtený
- dočasně povolit požírání kláves do reloadu
- vrátit výchozí nastavení

Když je požírání kláves zapnuté, Keymuncher nechá Okouna zpracovat klávesy normálně. Nastavení zůstává přístupné přes menu userscript manageru.

## Technické Poznámky

Userscript běží na:

- `https://www.okoun.cz/*`
- `http://www.okoun.cz/*`

Používá:

- `@run-at document-start`, aby byl listener zaregistrovaný před okouním skriptem
- `GM_getValue` / `GM_setValue` pro uložené nastavení
- `GM_registerMenuCommand` pro jednu položku nastavení
- `GM_getResourceURL` a `@resource keymuncherIcon` pro popup ikonku

Remapy nevolají okouní interní funkce, protože jsou uzavřené uvnitř IIFE v `main.js`. Místo toho Keymuncher lokálně najde `.listing .item:not(.ignored)` a posouvá stránku na příslušný příspěvek.

## Vývoj

Rychlá syntax kontrola:

```powershell
node --check .\keymuncher.user.js
```

Aktuální ikonka:

```text
keymuncher.png
```
