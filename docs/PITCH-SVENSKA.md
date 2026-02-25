# Fuska: Låt AI:n bygga koden åt dig — på riktigt

<center>[English](PITCH.md)</center>

------

Du har säkert klistrat in kod och felmeddelanden i ChatGPT, fått ett förslag, testat det, gått tillbaka och frågat igen. Fuska är något helt annat. Det är ett system som låter en AI-agent planera, bygga och granska din kod — inte bara föreslå den. Och till skillnad från en chattbot minns Fuska allt mellan sessioner.

## Från chatt till agent

**Så här jobbar du idag:** Du kopierar en funktion och ett felmeddelande till ChatGPT. Du får ett förslag. Du klistrar in det i din editor, kör, får ett nytt fel, går tillbaka till chatten. AI:n har inget minne — nästa dag börjar du om från noll.

**En kodagent är något annat.** Program som Claude Code och OpenCode körs direkt i din projektmapp. De kan *läsa dina filer*, *skriva kod*, *köra kommandon* och *göra git-commits*. Du ger en instruktion i klartext, agenten utför jobbet. Tänk dig skillnaden mellan att fråga en kollega "hur löser jag det här?" och att ge samma kollega ett ärende i Jira och låta hen koda, testa och committa. Ungefär som skillnaden mellan att googla ett recept och att ha en kock i köket.

**Varför är det värt att använda en kodagent?** Kort sagt: den ser hela bilden. När du klistrar in en funktion i ChatGPT ser AI:n bara det du klistrade in. En kodagent läser hela din kodbas — den hittar var funktionen anropas, vilka andra moduler som berörs, vilka tester som finns. Den kan köra din build och se om ändringen faktiskt fungerar. Skillnaden är enorm: istället för att du är mellanhanden som kopierar fram och tillbaka gör agenten allt i ett svep. Du beskriver vad du vill ha, agenten levererar fungerande kod.

Men det finns en hake. Även kodagenter lider av minnesförlust. Stänger du terminalen eller startar en ny session är allting borta — AI:n har ingen aning om vad ni gjorde igår. Det är som att få en ny konsult varje morgon som aldrig läst in sig på projektet.

## Vad Fuska gör

Fuska löser minnesproblemet med **MegaMemory** — en persistent kunskapsgraf lagrad i en lokal SQLite-databas som lever i ditt projekt. Ingen server, ingen konfiguration — bara en fil i projektkatalogen. Initiativ, faser, planer, beslut och forskningsresultat lagras som sammanlänkade koncept med relationer, sökbara via semantiska frågor. AI:n minns exakt var du befinner dig, vilka beslut som fattats och vilka krav som gäller. Men minne är bara grunden. Fuska strukturerar hela arbetsflödet:

- **Initiativ** = vad du vill åstadkomma ("Lägg till OAuth-inloggning")
- **Milstolpar** = grupperingar av faser som utgör en release eller leverans
- **Faser** = avgränsade arbetsbitar med tydliga mål och krav
- **Planer** = uppgiftslistor med beroenden, genererade av AI:n
- **Uppgifter** = konkreta steg med acceptanskriterier som agenten implementerar

Varje fas följer en enkel livscykel: **design → plan → build → review**. Du kan köra stegen manuellt ett i taget, eller låta Fuska köra hela kedjan automatiskt med ett enda kommando — antingen som `/fuska-do` inne i kodagenten eller som `fuska do` direkt i terminalen.

Och här kommer den avgörande skillnaden: innan en enda rad kod skrivs granskas planen av en **dynamisk expertpanel** — tre specialiserade AI-granskare som sätts samman utifrån just din plan. En basgranskare bevakar alltid kodkvalitet och testbarhet. En kontextuell granskare väljs utifrån projekttyp — exempelvis en säkerhetsgranskare för webbprojekt eller en resursgranskare för inbyggda system. Den tredje är en domänexpert som väljs dynamiskt utifrån planens innehåll: handlar det om OAuth får du en säkerhetsveteran, handlar det om databaser får du en dataarkitekt, handlar det om betalningar får du en Stripe-expert.

Om två granskare flaggar samma problem oberoende av varandra eskaleras allvarlighetsgraden automatiskt. Allt detta händer innan bygget ens startar.

Sedan implementerar en byggaragent koden. Men arbetet är inte klart ännu — en **kodgranskaragent** undersöker den faktiska diffen och letar efter buggar, säkerhetsproblem och avvikelser från planen. Hittar den problem fixar byggaragenten dem automatiskt — upp till tre gransknings-fix-iterationer innan du behöver ingripa. Först efter att koden klarar granskningen når den commit-steget.

Git-commits sker inte automatiskt efter varje steg — du väljer själv strategi: en commit per uppgift, per plan eller per fas. Det går också att godkänna varje commit manuellt. Ren historik, men på dina villkor.

## Ett konkret exempel

Du skriver: `/fuska-do verified implementera OAuth-inloggning med Google och GitHub`

1. En **forskaragent** undersöker OAuth2-flöden, analyserar dina befintliga inloggningsmönster och identifierar säkerhetsaspekter.
2. En **planeraregent** skapar en uppgiftslista med beroenden och säkerhetskontroller.
3. Tre **granskaregenter** validerar planen — kodkvalitet, säkerhet och OAuth-expertis.
4. En **byggaragent** implementerar varje uppgift med atomära commits.
5. En **kodgranskaragent** undersöker diffen efter buggar, säkerhetshål och planavvikelser — hittar den problem fixar byggaragenten dem automatiskt (upp till 3 iterationer).
6. En **verifieringsagent** kontrollerar att resultatet faktiskt levererar det som planen utlovade.

Du godkänner, och det är klart. Sex agenter har jobbat i sekvens, var och en med sin specialitet. Du behövde aldrig lämna editorn. Samma sak fungerar med `fuska do verified` direkt i terminalen. Och vill du ha mer kontroll kan du köra varje steg för sig — `/fuska-design`, `/fuska-plan`, `/fuska-build`, `/fuska-review` — precis som du vill.

## Varför det spelar roll

**Persistent minne.** Fredag klockan fyra stänger du editorn mitt i kapitel 2. Måndag morgon kör du `/fuska` — den visar exakt vilket kapitel, vilken uppgift och vad som kommer härnäst. Ingen manuell sparning, inget resume-kommando. Din position är alltid aktuell.

**Kvalitetssäkring före kodning.** Planer valideras *innan* en rad kod skrivs. Det är som att ha en arkitekturgranskning innan spaden sätts i jorden, istället för att försöka rätta till bärande väggar i efterhand.

**Intelligenta git-meddelanden.** Varje uppgift ger en commit, men meddelandet skrivs inte bara utifrån diffen. En dedikerad agent läser den faktiska koden, planen som låg till grund och den befintliga commit-historiken, och formulerar ett meddelande som beskriver *varför* ändringen gjordes — inte bara *vad* som ändrades. Historiken ser ut som om en pedantisk senior-utvecklare skrev varje meddelande för hand.

**Automatisk kartläggning.** Fuska mappar din kodbas — arkitektur, domäner, beroenden — så att AI:n förstår sammanhanget. Den vet att `PaymentService` hör till betalningsdomänen, inte för att du berättade det, utan för att den analyserade importen.

## Kvalitetstrappan: varför process slår improvisation

Du kan redan idag använda Claude Code eller OpenCode för att bygga kod. Men *hur* du använder agenten avgör kvaliteten på resultatet. Tänk dig fyra nivåer:

**Nivå 1: "Bara bygg."** Du skriver "implementera OAuth-inloggning" och låter agenten köra. Det fungerar — ibland. Problemet är att agenten fattar hundratals mikroskopiska beslut utan att du vet om det. Vilken OAuth-variant? Var lagras tokens? Hur hanteras utgångna sessioner? Agenten gissar, och gissningar staplas på varandra. Resultatet kan se rätt ut men ha dolda problem som dyker upp veckor senare. Det är som att be en snickare bygga ett rum utan ritning — det kanske blir fint, men kanske inte bärande.

**Nivå 2: "Planera, sedan bygg."** Du ber agenten göra en plan först, läser igenom den, och säger sedan "kör". Redan här ökar kvaliteten märkbart. Varför? Planeringen tvingar AI:n att bryta ner problemet i delar, tänka igenom beroenden och formulera vad som ska göras i vilken ordning — *innan* den skriver en rad kod. Du får dessutom chans att fånga felaktiga antaganden tidigt, när de fortfarande är billiga att rätta. Samma princip som att skissa arkitekturen innan du börjar koda — du skriver inte `main()` och hoppas på det bästa.

**Nivå 3: "Planera, validera, sedan bygg."** Nu ber du agenten inte bara planera utan även granska sin egen plan. Det ger ytterligare ett lager — men med en begränsning: det är fortfarande *samma* AI som granskar sitt eget arbete. Ungefär som att korrekturläsa sin egen text — du hittar stavfel men missar sällan strukturella problem. Dessutom gör du allt detta manuellt: du skriver prompten för planen, sedan en ny prompt för valideringen, sedan en tredje för bygget. Det funkar, men det kräver att *du* vet vilka frågor som bör ställas.

**Nivå 4: Fuska.** Här händer tre saker som de manuella nivåerna inte kan ge:

*Separata agenter med olika roller.* Planeraregenten och granskaraterna är *olika* AI-sessioner med olika systeminstruktioner. Granskarna vet inte vad planeraren "tänkte" — de ser bara planen och attackerar den som utomstående. Det eliminerar den självbekräftande effekten. Det är skillnaden mellan att en kollega granskar din kod och att du granskar den själv.

*Dynamisk expertis.* Granskarna väljs utifrån vad planen handlar om. En generisk AI-prompt ställer generiska frågor. En säkerhetsveteran vet att OAuth-tokens inte ska lagras i `localStorage`, att PKCE-flödet behövs för publika klienter, att refresh-tokens kräver rotation. Den kunskapen är inbakad i granskarens systeminstruktion — du behöver inte komma på frågorna själv.

*Korsvalidering.* När två oberoende granskare flaggar samma problem utan att ha sett varandras svar vet systemet att det är en riktig risk, inte en falsk positiv. Allvarligheten eskaleras automatiskt. Det är en signal som aldrig uppstår när en enda agent granskar sig själv.

Resultatet: varje steg i trappan minskar risken för att problem når produktionskoden. Att bara bygga är som att köra utan GPS. Att planera först är som att titta på kartan innan du kör. Att validera planen är som att låta en passagerare dubbelkolla kartan. Fuska är som att ha tre navigatörer som var och en är specialist på olika vägtyper — och som flaggar om de oberoende ser samma avkörning framför sig.

## Fuska kontra GSD — en ärlig jämförelse

Fuska bygger vidare på **GSD** (Get Shit Done) — ett tidigare system med samma grundidé: strukturerad AI-driven utveckling med faser och planer. Valet mellan dem är inte självklart. De löser samma problem men gör olika avvägningar.

### Där GSD är bättre

**Läsbarhet.** GSD sparar allt i markdown-filer i en `.planning/`-katalog. Du kan öppna vilken fil som helst i valfri editor och läsa krav, planer och beslut direkt. `git diff .planning/` visar exakt vad som ändrats, rad för rad. `git blame` fungerar på kravfiler. Fuskas MegaMemory är en binär SQLite-fil — du kan inte diffar den i git, och för att se ett koncept behöver du antingen köra ett kommando eller använda en SQLite-klient. Det är en riktig nackdel för den som vill ha full insyn utan verktyg.

**Enkelhet vid snabba uppgifter.** GSD:s `/gsd-quick` kräver inga val — du kör och det händer. Fuskas `/fuska-do` kräver att du väljer mellan fyra arbetslägen. För en enkel buggfix eller ett stavfel är det onödig friktion. Fuska erbjuder visserligen `planned`-läget som hoppar över granskning, men du måste fortfarande *veta* att du vill det.

**Enklare mental modell.** GSD har 14 agenter med ett fast flöde — du behöver inte tänka på vilka som körs. Fuska har 19 agenter och fyra arbetslägen. Å andra sidan: väljer du `planned`-läget i Fuska kör du *färre* steg än GSD:s standardflöde, och MegaMemory kräver avsevärt färre verktygsanrop för att ladda kontext jämfört med GSD:s filbaserade läsning. I praktiken kan Fuska vara snabbare — men du behöver förstå lägesvalet.

**Färre beroenden.** GSD behöver bara OpenCode och git. Fuska kräver dessutom Node.js, npm och MegaMemory som installerat paket. Fler beroenden betyder fler saker som kan gå sönder vid uppgraderingar. Å andra sidan ger Fuskas CLI-verktyg mycket tillbaka — se nedan.

**Ingen uppstartskostnad.** GSD kartlägger kodbasen vid behov. Fuska kör automatisk kartläggning vid `init` som tar 30–60 sekunder och kostar tokens — även om du bara vill testa verktyget på ett litet projekt.

### Där Fuska är bättre

**Sessionsminne som faktiskt fungerar.** Stäng editorn när du vill — nästa gång du kör `/fuska` vet den exakt vilket kapitel, vilken uppgift och vad som kommer härnäst. Inget pauskommando, inget resume-kommando, ingen manuell sparning. GSD kräver att du kör `/gsd-pause-work` innan du slutar och `/gsd-resume` för att komma tillbaka — hoppar du över något av stegen försvinner kontexten.

**Dynamisk expertpanel.** Tre specialiserade granskare som sätts samman utifrån projektet och planen, jämfört med GSD:s enda generiska granskare. Korsvalidering — när två oberoende granskare flaggar samma problem — eskalerar allvarlighetsgraden automatiskt. Det fångar kategorier av fel som en ensam granskare missar.

**Enklare livscykel.** GSD:s fasmodell heter discuss → plan → execute → verify — fyra steg som alltid körs manuellt, ett kommando i taget. Fuskas motsvarighet heter design → plan → build → review, med enklare namngivning och möjligheten att köra hela kedjan automatiskt via `/fuska-do` eller `fuska do` i terminalen. Vill du ha manuell kontroll kan du fortfarande köra varje steg för sig, precis som i GSD — men du slipper om du inte vill.

**Flexibla arbetslägen.** `/fuska-do` med fyra lägen ger kontroll över hur mycket granskning en uppgift förtjänar. GSD:s `/gsd-quick` kör alltid utan granskning — du kan inte välja att validera en snabbuppgift även om den visar sig vara känsligare än du trodde.

**Bättre git-meddelanden.** En dedikerad commit-agent läser plan, faktisk kod och befintlig historik för att formulera meddelanden som förklarar avsikten. GSD:s commit-meddelanden genereras som en bisyssla av exekveringsagenten.

**Domänkartläggning och kodfrågor.** Fuska kan mappa affärsdomäner separat från teknisk arkitektur — den vet att `PaymentService` tillhör betalningsdomänen. GSD saknar detta helt. Dessutom kan du ställa frågor direkt mot mappningen: "var hanteras autentisering?", "vilka filer importerar OrderService?", "finns det oanvänd exporterad kod?". Det fungerar både som `/fuska-ask` inne i kodagenten och som `fuska ask` i terminalen — det senare utan LLM-kostnad. Du får svar baserat på den indexerade importgrafen istället för att agenten söker igenom filträdet varje gång.

**Modellval.** Fuska stöder valfri modell via konfigurerbara profiler — du kan använda en dyr modell för planering och en billigare för byggande. GSD är mer låst till specifika modeller.

**CLI utan LLM-kostnad.** Fuska har ett eget kommandoradsverktyg som låter dig göra mycket utan att starta en AI-agent: se projektstatus, byta initiativ, konfigurera profiler, exportera kunskapsgrafen till markdown, hantera git-worktrees och mer. GSD saknar CLI helt — all interaktion går via kodagenten, vilket innebär att varje statusförfrågan kostar tokens. Med Fuskas CLI kan du orientera dig och administrera projektet utan att betala för en LLM-session.

**Skala.** MegaMemory är 700 gånger snabbare för sammansatta frågor i projekt med hundratals koncept. För ett litet projekt med tio faser märks ingen skillnad — men för ett projekt som lever i sex månader med flertalet initiativ gör det det.

### Sammanfattning

GSD passar bättre om du vill ha ett enkelt, transparent system utan extra beroenden — särskilt för kortare projekt och snabba jobb där du vill kunna läsa all projektdata direkt i editorn. Fuska lönar sig när projektet lever tillräckligt länge för att sessionsminne, domänkartläggning och systematisk plangranskning ska betala tillbaka sin uppstartskostnad. Valet handlar inte om vilket som är "bättre" — det handlar om hur stort och långlivat ditt projekt är.

## Kom igång

Fuska är, kort sagt, ett projektledningssystem för AI-driven utveckling. Istället för att chatta fram kod rad för rad får du en hel kedja av specialiserade agenter som forskar, planerar, granskar, bygger och verifierar. Och allt minns de till nästa gång.

```
npm install -g fuska && fuska init
```

Fungerar med OpenCode och Claude Code. Allt som krävs är Node.js och en terminal.
