# Fonts for the link-preview cards

Static instances of the site's own Google Fonts, committed as TTFs because
the card renderer (Satori, via `next/og`) takes font data as buffers and reads
neither woff2 nor `next/font`. Each file is the instance Google Fonts serves
for that weight (fonts.gstatic.com); the families live in
https://github.com/google/fonts under `ofl/`.

All are licensed under the SIL Open Font License, Version 1.1
(https://openfontlicense.org), which permits bundling and redistribution.

| Family        | Files                                        | Copyright                                                                                   |
| ------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Alegreya      | Alegreya-Regular                             | Copyright 2011 The Alegreya Project Authors (https://github.com/huertatipografica/Alegreya) |
| Archivo       | Archivo-Bold, Archivo-Black                  | Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo)        |
| Source Sans 3 | SourceSans3-Regular, SourceSans3-SemiBold    | Copyright 2010-2020 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'          |
| IBM Plex Serif| IBMPlexSerif-Medium                          | Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"                                   |
| IBM Plex Mono | IBMPlexMono-Regular, IBMPlexMono-Medium      | Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"                                   |
| Fredoka       | Fredoka-Medium, Fredoka-SemiBold, Fredoka-Bold | Copyright 2016 The Fredoka Project Authors (https://github.com/hafontia/Fredoka-One)      |

The fonts are used unmodified and are not sold; the Reserved Font Names are
not used for any derived font.
