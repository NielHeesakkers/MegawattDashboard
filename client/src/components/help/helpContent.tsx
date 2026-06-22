import { ReactNode } from 'react';

// ── Presentatie-helpers (consistente stijl binnen de handleiding) ────────────
const P = ({ children }: { children: ReactNode }) => (
  <p className="text-[rgba(255,255,255,0.72)] text-[14px] leading-relaxed mb-2.5">{children}</p>
);
const H = ({ children }: { children: ReactNode }) => (
  <h3 className="text-white font-semibold text-[15px] mt-6 mb-2 first:mt-0">{children}</h3>
);
const Ol = ({ children }: { children: ReactNode }) => (
  <ol className="list-decimal pl-5 space-y-1.5 text-[rgba(255,255,255,0.72)] text-[14px] mb-3 marker:text-accent-teal marker:font-semibold">{children}</ol>
);
const Ul = ({ children }: { children: ReactNode }) => (
  <ul className="list-disc pl-5 space-y-1.5 text-[rgba(255,255,255,0.72)] text-[14px] mb-3 marker:text-accent-teal">{children}</ul>
);
const Li = ({ children }: { children: ReactNode }) => <li className="leading-relaxed">{children}</li>;
const B = ({ children }: { children: ReactNode }) => <span className="text-white font-medium">{children}</span>;
const Tip = ({ children }: { children: ReactNode }) => (
  <div className="mt-3 rounded-lg bg-accent-teal/10 border border-accent-teal/25 px-3.5 py-2.5 text-[13px] text-accent-teal/90 leading-relaxed">
    <span className="font-semibold">Tip:</span> {children}
  </div>
);

// ── Stappenplan: de complete flow van klant tot klant-link ───────────────────
export const LOCATIE_MANAGEMENT: ReactNode = (
  <>
    <P>De complete flow om voor een campagne locaties te vinden, te koppelen en te delen met de klant. Volg de stappen op volgorde.</P>
    <ol className="space-y-4 mb-3">
      <li className="flex gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ffff00] text-[#1a3a38] text-[13px] font-bold flex items-center justify-center mt-0.5">1</span>
        <div className="text-[rgba(255,255,255,0.72)] text-[14px] leading-relaxed">
          <B>Klant aanmaken.</B> Ga naar <B>Contacten → Klanten</B> en klik op <B>+ Klant</B>. Vul de naam in (optioneel: adres, contactpersoon, logo) en sla op.
        </div>
      </li>
      <li className="flex gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ffff00] text-[#1a3a38] text-[13px] font-bold flex items-center justify-center mt-0.5">2</span>
        <div className="text-[rgba(255,255,255,0.72)] text-[14px] leading-relaxed">
          <B>Project aanmaken.</B> Klik op <B>Nieuw Project</B> (de gele knop), kies de zojuist aangemaakte <B>klant</B>, geef een <B>projectnummer</B> en <B>projectnaam</B>, zet de status op <B>Lopend</B> en sla op.
        </div>
      </li>
      <li className="flex gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ffff00] text-[#1a3a38] text-[13px] font-bold flex items-center justify-center mt-0.5">3</span>
        <div className="text-[rgba(255,255,255,0.72)] text-[14px] leading-relaxed">
          <B>Locaties zoeken (of toevoegen).</B> Ga naar <B>Locaties</B> en zoek met de zoekbalk + filters (land, m², geschikt voor, voorzieningen) de geschikte locaties. Staat een locatie er nog niet bij? Voeg 'm toe met <B>+ Locatie</B> — naam, land en adres (via het zoekveld → kaart + automatische code), eventueel foto's en kenmerken.
        </div>
      </li>
      <li className="flex gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ffff00] text-[#1a3a38] text-[13px] font-bold flex items-center justify-center mt-0.5">4</span>
        <div className="text-[rgba(255,255,255,0.72)] text-[14px] leading-relaxed">
          <B>Locaties aan het project koppelen.</B> Open het project en voeg onder <B>Locaties</B> elke locatie toe via het veld <B>Locatie (code of naam)</B>. Zet per locatie <B>Beschikbaar voor dit project</B> op <B>Ja</B>, <B>Nee</B> of <B>Onbekend</B> en vul eventueel datums in. <span className="text-white/90">Sneller: klik in de Locaties-lijst met de <B>rechtermuisknop</B> op een locatie → <B>Toevoegen aan project</B> → kies dit project.</span>
        </div>
      </li>
      <li className="flex gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ffff00] text-[#1a3a38] text-[13px] font-bold flex items-center justify-center mt-0.5">5</span>
        <div className="text-[rgba(255,255,255,0.72)] text-[14px] leading-relaxed">
          <B>Delen met de klant (klant-link).</B> Zodra het project is opgeslagen verschijnt de <B>deel-link</B>. Zet er optioneel een <B>wachtwoord</B> op (klik <B>Bewaar</B>), klik <B>Kopieer</B> en stuur de link naar de klant. De klant ziet de gekoppelde locaties — <B>behalve die op "Nee"</B> — en geeft per locatie een voorkeur. Die voorkeuren zie je terug bij het project.
        </div>
      </li>
    </ol>
    <Tip>Alleen de status "Nee" verbergt een locatie in de klant-link. "Ja" en "Onbekend" zijn dus zichtbaar voor de klant.</Tip>
  </>
);

// ── Content per menu-item (key = permissie-key) ──────────────────────────────
export const HELP_CONTENT: Record<string, ReactNode> = {
  klanten: (
    <>
      <P>Onder <B>Klanten</B> beheer je de bedrijven waarvoor je projecten draait. Vanuit een klant zie je ook meteen de bijbehorende projecten.</P>
      <H>Een klant toevoegen</H>
      <Ol>
        <Li>Ga naar <B>Contacten → Klanten</B> en klik op <B>+ Klant</B>.</Li>
        <Li>Vul de <B>naam</B> in (verplicht). Optioneel: adres, postcode, stad, land en een logo.</Li>
        <Li>Klik op <B>Opslaan</B>.</Li>
      </Ol>
      <H>Contactpersonen</H>
      <P>Voeg per klant één of meer contactpersonen toe (naam, e-mail, telefoon). Handig om snel de juiste persoon te bereiken.</P>
      <H>Projecten van de klant</H>
      <P>Op de klantpagina zie je de gekoppelde projecten, verdeeld over Lopend, Gearchiveerd en Afgewezen.</P>
      <P>Een klant bewerken of verwijderen doe je via de klant in de lijst. Verwijderen kan alleen als er geen projecten meer aan hangen.</P>
    </>
  ),

  toeleveranciers: (
    <>
      <P>Onder <B>Toeleveranciers</B> beheer je je partners en leveranciers (bijvoorbeeld bouw, techniek, catering of locatie-scouts).</P>
      <H>Een toeleverancier toevoegen</H>
      <Ol>
        <Li>Ga naar <B>Contacten → Toeleveranciers</B> en klik op <B>+ Toeleverancier</B>.</Li>
        <Li>Vul de naam in en optioneel adres, contactpersoon en logo.</Li>
        <Li>Klik op <B>Opslaan</B>.</Li>
      </Ol>
      <H>Specialismes</H>
      <P>Ken aan een toeleverancier één of meer <B>specialismes</B> toe (bv. "Locatie scout", "Eventplanner", "Personeel"). Zo filter je later snel op het juiste type partner.</P>
      <P>Staat een specialisme er nog niet bij? Klik op <B>+ specialisme</B>, typ de naam en druk op Enter — het wordt aangemaakt, meteen geselecteerd en is daarna overal kiesbaar.</P>
      <H>Contactpersonen</H>
      <P>Voeg per toeleverancier contactpersonen toe (naam, e-mail, telefoon).</P>
      <P>Je koppelt een toeleverancier aan een project vanuit het projectformulier (zie de tab <B>Nieuw Project</B>).</P>
    </>
  ),

  'nieuw-project': (
    <>
      <P>Met <B>Nieuw Project</B> start je een nieuw project. Een project bundelt een klant, de gekoppelde locaties, de toeleveranciers en een deel-link naar de klant.</P>
      <H>Een project aanmaken</H>
      <Ol>
        <Li>Klik in het menu op <B>Nieuw Project</B> (de gele knop).</Li>
        <Li>Kies de <B>Klant</B>, geef een <B>Projectnummer</B> en <B>Projectnaam</B>.</Li>
        <Li>Zet de <B>Status</B>: Lopend, Gearchiveerd of Afgewezen.</Li>
        <Li>Klik op <B>Opslaan</B>.</Li>
      </Ol>
      <H>Locaties koppelen</H>
      <P>Voeg onder <B>Locaties</B> een locatie toe via het veld <B>Locatie (code of naam)</B> — typ de code of naam en kies de juiste. Zet daarna per locatie <B>Beschikbaar voor dit project</B> op <B>Ja</B>, <B>Nee</B> of <B>Onbekend</B>, en vul eventueel datums in.</P>
      <H>Delen met de klant (deel-link)</H>
      <P>Zodra het project is opgeslagen (klant + projectnummer ingevuld) verschijnt de <B>deel-link</B>. Zet er optioneel een wachtwoord op (klik <B>Bewaar</B>), klik <B>Kopieer</B> en stuur de link naar de klant.</P>
      <P>De klant ziet alle gekoppelde locaties — <B>behalve die op "Nee"</B> — en kan per locatie een voorkeur aangeven. Die voorkeuren zie je terug bij het project.</P>
      <Tip>Alleen de status "Nee" verbergt een locatie in de deel-link. "Ja" en "Onbekend" zijn dus zichtbaar voor de klant.</Tip>
    </>
  ),

  'projecten-actief': (
    <>
      <P>Onder <B>Lopend</B> staan alle projecten die nu actief zijn.</P>
      <H>Werken met de lijst</H>
      <Ul>
        <Li>Klik op een project om het te openen en te bewerken.</Li>
        <Li>De status wijzig je binnen het project: zet 'm op <B>Gearchiveerd</B> als het klaar is, of <B>Afgewezen</B> als het niet doorgaat.</Li>
        <Li>Gebruik de zoekbalk om snel een project te vinden.</Li>
      </Ul>
      <H>Volgorde aanpassen</H>
      <P>De Lopend-lijst staat in een <B>eigen volgorde</B>: standaard staat het nieuwste project bovenaan. Je past de volgorde aan door te <B>slepen</B>: pak een rij vast aan het <B>greepje</B> (het icoontje links, vóór het logo) en sleep 'm omhoog of omlaag. De andere rijen schuiven mee om ruimte te maken, en de nieuwe volgorde wordt direct opgeslagen.</P>
      <Tip>Deze volgorde werkt door in het rechtermuisknop-menu bij Locaties (<B>Toevoegen aan project</B>) — die lijst staat in dezelfde volgorde als hier.</Tip>
      <P>Een nieuw project maak je via <B>Nieuw Project</B> (zie die tab).</P>
    </>
  ),

  'projecten-afgerond': (
    <>
      <P>Onder <B>Gearchiveerd</B> staan projecten die zijn afgerond. Ze blijven bewaard zodat je ze later kunt terugvinden en inzien.</P>
      <P>Wil je een project weer oppakken? Open het en zet de status terug op <B>Lopend</B>.</P>
    </>
  ),

  'projecten-geannuleerd': (
    <>
      <P>Onder <B>Afgewezen</B> staan projecten die niet zijn doorgegaan. Ze blijven bewaard voor je administratie en eventuele heropening.</P>
      <P>Mocht een project alsnog doorgaan, open het dan en zet de status terug op <B>Lopend</B>.</P>
    </>
  ),

  locaties: (
    <>
      <P>Onder <B>Locaties</B> staat het volledige locatiebestand. Hier leg je nieuwe locaties vast en vind je bestaande terug.</P>
      <H>Een nieuwe locatie toevoegen</H>
      <Ol>
        <Li>Klik op <B>+ Locatie</B>.</Li>
        <Li>Vul minimaal <B>Naam</B>, <B>Land</B> en <B>Adres</B> in. Tik het adres in het Adres-veld ("Zoek adres in …") en kies het juiste resultaat — de locatie komt automatisch op de kaart en krijgt een <B>locatiecode</B> (bv. AMS-001).</Li>
        <Li>Optioneel: m², voorzieningen (stroom / verlichting / bereikbaar met bakwagen), geschiktheid (activatie / sampling) en notities.</Li>
        <Li>Klik op <B>Opslaan</B>.</Li>
      </Ol>
      <H>Foto's</H>
      <P>Open de locatie en upload één of meer foto's. De eerste foto is de hoofdfoto; sleep om de volgorde te wijzigen. Verwijderen kan per foto.</P>
      <H>Contacten & kosten</H>
      <Ul>
        <Li>Voeg een <B>contactpersoon</B> toe (naam, e-mail, telefoon, rol).</Li>
        <Li>Voeg <B>locatiekosten</B> toe (omschrijving + bedrag per dag) zodat die later in een project meetellen.</Li>
      </Ul>
      <H>Zoeken & filteren</H>
      <P>Gebruik de zoekbalk (zoekt op naam en adres) en de filters links: land, grootte (m²), geschikt voor en voorzieningen. De lijst toont meteen de treffers.</P>
      <P>Er zijn extra filters: <B>stroomvoorziening</B>, <B>aanvraagtijd</B>, <B>volume sampling</B>, <B>doelgroep</B> en <B>event type</B>. Bij <B>volume sampling</B> en <B>aanvraagtijd</B> zie je de gekozen klasse én alles eronder (bv. "8 weken" toont ook 2 en 4 weken); de overige filters tonen locaties die op minstens één van je keuzes passen.</P>
      <H>Snel aan een project koppelen</H>
      <P>Klik in de lijst met de <B>rechtermuisknop</B> op een locatie → <B>Toevoegen aan project</B> → kies een lopend project. De locatie wordt direct gekoppeld (beschikbaarheid start op <B>Onbekend</B>). Zat 'ie al in dat project, dan gebeurt er niets dubbels.</P>
      <Tip>Vul het adres altijd via het zoekveld in — dan klopt de kaart en de nette adresnotatie automatisch.</Tip>
    </>
  ),

  superchargers: (
    <>
      <P>Onder <B>Superchargers</B> beheer je het promotieteam dat op activaties wordt ingezet.</P>
      <p className="italic text-[rgba(255,255,255,0.45)] text-[14px] leading-relaxed">Dit onderdeel wordt later verder uitgewerkt; deze handleiding wordt dan aangevuld.</p>
    </>
  ),

  dashboard: (
    <>
      <P>Het <B>Organigram</B> toont de organisatiestructuur: directie, teams en medewerkers.</P>
      <H>Wat kun je hier?</H>
      <Ul>
        <Li>Bekijk de structuur en klik op een persoon voor details.</Li>
        <Li>Gebruik de <B>zoekbalk</B> om iemand snel te vinden.</Li>
        <Li>Exporteer het organigram naar <B>PDF</B> of <B>JPG</B> via de knop <B>Exporteren</B> linksboven.</Li>
      </Ul>
    </>
  ),

  klantteams: (
    <>
      <P>Onder <B>Klantteams</B> zie je per klant het toegewezen team — wie waarvoor verantwoordelijk is.</P>
      <P>Net als bij het organigram kun je dit overzicht <B>exporteren</B> naar PDF of JPG via de knop linksboven.</P>
    </>
  ),
};
