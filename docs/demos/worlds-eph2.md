---
title: "Ephesians 2:8"
theme: "saintbilly"
shaders: "vintage"
font: "Rye"
---

```javascript on:init
worlds.enable();
worlds.controls.setEnabled(false);
worlds.links.setRenderOverlay({ enabled: true, internalOnly: true, allVisible: true, thickness: 0.12 });
worlds.config.setDefaults({
	keepRotation: true,
	straightenOnFocus: true,
	screenSpaceRecenter: true,
	screenSpaceRecenterIters: 5,
	sectionSizeUnits: 'px',
	sectionOverflow: 'fit-y',
	sectionRender: 'content',
	sectionLinkUnderline: true,
	sectionClickFocusEnabled: true,
	defaultSectionWidth: 360,
	defaultSectionHeight: 180,
	  sectionBackground: 'texture:assets/img/paper_crumpled.jpg;tilePx=400;contentDistort=0.01;paperPlaneZ=focus;overlay=assets/img/saintbilly-west-texas.svg;overlayBlend=multiply;overlayOpacity=0.45;overlayFit=cover',
});
worlds.camera.setPosition(0, 0, 900);
worlds.camera.setRotation(0, 0, 0);
worlds.camera.setEaseSpeed(0.07, 0.11);
worlds.camera.focusOnSectionFit('Ephesians 2:8', 0.9, { keepRotation: true });
```

## Ephesians 2:8 {"x":"0","y":"0","width":"507","height":"100","render":"all"}

For by [grace](#grace-and-faith){rel:"lexical"} are ye [saved](#saved){rel:"lexical"} through [faith](#grace-and-faith){rel:"lexical"}; and [that](#that "pronoun") not of yourselves: it is the gift of God:  

```logic name:ephesians-2-8
grace -> #grace-and-faith {rel: lexical}
faith -> #grace-and-faith {rel: lexical}
saved -> #saved {rel: lexical}
that -> #for-by-grace-are-ye-saved-through-faith {rel: refers-to-clause}
that -> #grace-and-faith {rel: excludes}
that -> #saved {rel: excludes}
```

```javascript on:enter
worlds.camera.focusOnSectionFit('Ephesians 2:8', 0.9, { keepRotation: true });
```

## Grace and Faith {"x":"-20","y":"15","width":"332","height":"119"}

*   Grace χάρις (charis) | Faith πίστις (pistis)

In Greek, ‘grace’ and ‘faith’ are both feminine nouns.  

```javascript on:enter
worlds.camera.focusOnSectionFit('Grace and Faith', 0.92, { keepRotation: true });
```

## Saved {"x":"30","y":"10","width":"228","height":"132"}

*   σώζω (sózó)

In the Greek text, ‘saved’ is a masculine participle.  

```javascript on:enter
worlds.camera.focusOnSectionFit('Saved', 0.94, { keepRotation: true });
```

## That {"x":"-30","y":"-5","width":"216","height":"348"}

*   οὗτος, (houtos, hauté, touto)

In Greek, a pronoun must match the gender of the word it refers to. In this verse, the word ‘that’ (rendered ‘this’ in some other translations) is a neuter pronoun so it cannot refer to either ‘grace’ or ‘faith’, which are feminine, or the masculine participle ‘saved’. It must refer to the entire preceding clause.  

```javascript on:enter
worlds.camera.focusOnSectionFit('That', 0.88, { keepRotation: true });
```

## For by grace are ye saved through faith {"x":"-10","y":"-20","width":"670","height":"205"}

The neuter pronoun ‘that’ (or ‘this’) because of its masculine gender, can only refer to the entire preceding clause. It isn’t just grace, faith or even salvation by grace that is the gift of God, but the entirety of salvation by grace through faith.  

```javascript on:enter
worlds.camera.focusOnSectionFit('For by grace are ye saved through faith', 0.86, { keepRotation: true });
```
