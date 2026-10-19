import {
  ITALIC,
  block,
  discordMessage,
  galleryItem,
  heading,
  paragraph,
  root,
  text,
  type LexicalEditorState,
} from './lexical'

/**
 * The seed content itself — lexical editor states for every article and page.
 * Prose is written in the voice of the contract: the official gazette of a
 * small proud nation on the Rulercraft realm.
 *
 * The lore here is a placeholder (a coastal trading nation with a harbour
 * capital and a lighthouse) meant to be replaced with Azania's own. The About
 * page is the exception: it also seeds production, so it sticks to facts.
 */

// ── The Charter of Azania (pinned decree) ───────────────────────────────────

export const charterContent = (): LexicalEditorState =>
  root(
    paragraph(
      'Before there was a nation there was a harbour: a deep, sheltered bay on the coast of ',
      'the Rulercraft realm, guarded by a headland and claimed by no crown. Those who made ',
      'landfall there first came by sea, carrying tools rather than banners. What follows is ',
      'the law they agreed upon, written so that the nation they founded would outlast them.',
    ),
    block(
      'callout',
      {
        style: 'decree',
        title: 'Proclamation of the Founding Council',
        body: 'By decree of the Founding Council, given under the Seal of the Nation and the hand of Chancellor Luixtiter, this Charter is adopted as the supreme law of Azania, binding upon every resident, officer and guest within her borders and her waters.',
      },
      'Founding proclamation',
    ),
    heading('Article I — The Nation and Its Territory'),
    paragraph(
      'Azania is a free and sovereign nation of the Rulercraft realm. Her territory is the ',
      'charted coast around the harbour, its islands and its hinterland, together with such ',
      'districts as the Council may lawfully annex by charter and beacon. The capital is Port ',
      'Azania, seat of the Chancellery and of the national archive.',
    ),
    heading('Article II — The Chancellor, the Co-Leader and the Council'),
    paragraph(
      'The nation is led by a Chancellor, who keeps the Seal and speaks for Azania abroad, ',
      'and a Co-Leader, who shares the work of government and keeps the nation’s ',
      'registers in order. Law is made by the Council of residents in good standing, by open ',
      'vote in the Hall of Assembly. No decree takes force until it is entered into the Gazette.',
    ),
    heading('Article III — The Rights of Residents'),
    paragraph(
      'Every resident of Azania holds these rights, which no decree may abridge: to speak and ',
      'to write freely in the affairs of the nation; to hold land granted by charter; to ',
      'petition the Council and be heard; to sail the waters and walk the roads of the realm; ',
      'and to depart in peace, taking what is theirs.',
    ),
    heading('Article IV — Land, Building and the Common Works'),
    paragraph(
      'Land within the nation is granted by charter and held by stewardship. A resident may ',
      'build freely upon their grant, provided the work honours the character of its district ',
      'and endangers no neighbour. Quays, moles, roads and the lighthouse are common works, ',
      'raised by the nation and belonging to all. No common work may be torn down save by ',
      'decree of the Council.',
    ),
    heading('Article V — The Lighthouse'),
    paragraph(
      'Upon Founders’ Point stands the Lighthouse, raised where the first ship made ',
      'harbour. It is the memory of the nation made visible, and the first thing every ',
      'traveller sees of her. Its keeping is the first duty of the Chancellery, and its light ',
      'shall not be allowed to fail.',
    ),
    heading('Article VI — Amendment and Continuity'),
    paragraph(
      'This Charter may be amended only by a two-thirds voice of the Council, taken in open ',
      'assembly on two separate days. Should the nation ever be scattered, the Charter ',
      'endures: wherever three residents gather under its words, there is Azania.',
    ),
    paragraph(text('Given under the Seal of the Nation, in the Year of Founding.', ITALIC)),
  )

// ── The Lighthouse on Founders' Point, Relit (3D model showcase) ────────────

export const lighthouseContent = (glbMediaId: number): LexicalEditorState =>
  root(
    paragraph(
      'After a season of scaffolding, lime-wash and the patient work of the masons’ guild, ',
      'the Lighthouse on Founders’ Point stands restored. The tower has been rewhitened ',
      'course by course, the ochre band repainted so ships can tell it from the cliffs by ',
      'day, and the lantern reglazed — so that once again it is the first light a ship sees ',
      'of Azania, and the last one it loses.',
    ),
    block(
      'callout',
      {
        style: 'note',
        title: 'An interactive exhibit',
        body: 'The model below is a living exhibit from the national archive. Drag to orbit the Lighthouse, scroll to draw nearer, and let it turn on its own when your hand rests.',
      },
      'Interactive exhibit note',
    ),
    block(
      'model3d',
      {
        model: glbMediaId,
        caption: 'The Lighthouse on Founders’ Point — drag to orbit',
        autoRotate: true,
      },
      'The Lighthouse',
    ),
    paragraph(
      'The Lighthouse was the first thing the founders built, before the quays and before ',
      'the warehouses: a nation that lives by the sea, they argued, should first make sure ',
      'its ships can find their way home. It marks the rock where the first boat was hauled ',
      'ashore, and by Article V of the Charter its keeping is the first duty of the Chancellery.',
    ),
    paragraph(
      'The restoration was carried out under the direction of the Keeper of the Light, with ',
      'coral stone cut from the original quarry and bronze for the gallery rail cast on the ',
      'Spice Quay. The Council extends the nation’s thanks to every hand that touched the ',
      'work. The scaffolds come down on Founding Day; the light, as the Charter requires, ',
      'shall not be allowed to fail.',
    ),
  )

// ── Founding Day: How Azania Came To Be (gazette feature) ───────────────────

export const foundingDayContent = (bannerMediaId: number): LexicalEditorState =>
  root(
    paragraph(
      'Every nation keeps one story it tells more often than the rest. Ours begins with one ',
      'ship, one bad chart, and a harbour nobody else had noticed. This Founding Day, the ',
      'Gazette retells how Azania came to be — as it happened, and not as the dockside ',
      'versions have improved it.',
    ),
    paragraph(
      'The first crew sailed down the coast looking for somewhere else entirely, having been ',
      'assured by a chart (since framed in the Hall of Assembly, as a warning) that the shore ',
      'was all cliff. It was not. Behind the headland they found a deep bay, sweet water ',
      'running down from the hills, and a point of rock crying out for a light. They hauled ',
      'the boat ashore on the spot where the Lighthouse now stands, and by lantern-light that ',
      'same evening began arguing about the constitution — a tradition we maintain to this day.',
    ),
    block(
      'quote',
      {
        quote:
          'We did not come ashore to build walls; we came to build a harbour wide enough for every ship that would put in at it.',
        attribution: 'The Founding Captain',
        attributionTitle: 'at the Founding Assembly',
      },
      'The Founding Captain',
    ),
    paragraph(
      'The Founding Assembly met on the beach for three days. It produced the Charter, the ',
      'offices of Chancellor and Co-Leader, and the national habit of settling questions by ',
      'open vote and closing the session with a fish supper. The crew signed by lantern-light; ',
      'the youngest of them, it is recorded, signed twice, to be sure.',
    ),
    block(
      'image',
      {
        image: bannerMediaId,
        caption: 'Dawn over Founders’ Point, where the standard is raised each Founding Day.',
        layout: 'wide',
      },
      'Founding Day at dawn',
    ),
    paragraph(
      'Founding Day is now kept every year on the anniversary of that first landfall: the ',
      'standard is raised on Founders’ Point at dawn, the Charter is read from the ',
      'lighthouse steps, and the long tables are laid the length of the Old Harbour. All ',
      'residents are expected; all travellers are welcome. Bring a dish, a story, or both.',
    ),
  )

// ── The Long Mole Is Complete (public works report) ─────────────────────────

export const harbourMoleContent = (
  dawnMediaId: number,
  harbourMediaId: number,
  warehouseSchematicId: number,
): LexicalEditorState =>
  root(
    paragraph(
      'The Long Mole is complete. Three hundred blocks of dressed stone now run out from the ',
      'Spice Quay across the mouth of the Old Harbour, and for the first time since the ',
      'founding a ship can ride out a storm in Port Azania without its captain spending the ',
      'night on deck. It is the largest common work the nation has yet undertaken, and as of ',
      'this week it belongs, as all common works do, to everyone.',
    ),
    paragraph(
      'The mole runs from the warehouse steps on the Spice Quay along the line of the old ',
      'reef, turns at the Elbow — where the Harbour Commission’s foreman says the sea ',
      'argued with every course they laid — and ends in a small light of its own, a lantern ',
      'on an iron post that answers the Lighthouse across the bay. Mooring rings are set ',
      'every twenty blocks. Fishers are asked to keep the inner channel clear at slack water.',
    ),
    block(
      'embed',
      {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        caption: 'Opening ceremony broadcast',
      },
      'Opening ceremony broadcast',
    ),
    paragraph(
      'The Chancellor cut the ribbon on the Spice Quay at dawn and then, in keeping with ',
      'tradition, walked the whole mole with the masons, arriving at the harbour light to ',
      'loud approval and hot tea. The first ship to tie up behind it was a salt barge from ',
      'the southern pans, which the Commission notes is exactly the point.',
    ),
    block(
      'gallery',
      {
        items: [
          galleryItem(dawnMediaId, 'First light over Founders’ Point, seen from the end of the mole.'),
          galleryItem(harbourMediaId, 'The Long Mole and the ships riding in its lee.'),
        ],
        columns: '2',
      },
      'Views of the Long Mole',
    ),
    paragraph(
      'The quay warehouses that will line the mole follow a single standard design, so that ',
      'every merchant builds to the same line and the same height. The Commission has ',
      'published it as a Litematica build: turn it in the viewer below, or download it and ',
      'paste it into your own world.',
    ),
    block(
      'litematic',
      {
        schematic: warehouseSchematicId,
        caption: 'The standard quay warehouse — drag to orbit',
        autoRotate: true,
      },
      'Standard quay warehouse',
    ),
    paragraph(
      'The Harbour Commission’s full accounts will be laid before the Council at the next ',
      'assembly and printed in the Gazette, as the Charter requires of every common work. ',
      'Proposals for a second quay on the Terraces side may now be submitted to the Chancellery.',
    ),
  )

// ── Proposal: A Regatta on the Old Harbour (resident draft) ─────────────────

export const regattaContent = (): LexicalEditorState =>
  root(
    paragraph(
      'To the Council, from a resident of the Spice Quay district: now that the Long Mole ',
      'gives us calm water, I propose that the nation keep a Regatta on the Old Harbour each ',
      'year when the trade winds turn. Every crew in Azania — fishers, merchants, ferry ',
      'hands and anyone who can borrow a boat — would race from the Lighthouse to the ',
      'harbour light and back, and the winners would sail at the head of the Founding Day ',
      'procession.',
    ),
    paragraph(
      'The cost is modest: bunting, a starting gun, and one afternoon of the ',
      'harbour-master’s patience. The boatwrights on the quay offer to lend hulls to ',
      'crews who have none, and the ferry crews ask only that the channel be kept clear of ',
      'spectators. If the Council finds merit in this, I will gladly organise the first ',
      'Regatta and answer for anyone who ends up in the water.',
    ),
  )

// ════════════════════════════════════════════════════════════════════════════
// THE AZANIAN TIMES — the independent press (section: 'times')
// A sharper, more journalistic voice than the state Gazette: markets, daily
// life, and a healthy scepticism of the Chancellery.
// ════════════════════════════════════════════════════════════════════════════

// ── Captains Balk as New Harbour Dues Take Effect (lead story) ──────────────

export const harbourDuesContent = (): LexicalEditorState =>
  root(
    paragraph(
      'The new harbour dues — a copper for every laden ship that ties up behind the Long ',
      'Mole — took effect on the morning tide, and by noon the line of hulls waiting to be ',
      'tallied stretched past the Elbow. The Chancellery says the coin will keep the mole in ',
      'repair. The captains who moor behind it are not yet convinced they should pay twice ',
      'for a work they were told belonged to everyone.',
    ),
    block(
      'quote',
      {
        quote:
          'They cut the ribbon and told us the mole was ours. A fortnight later they put a tally-man at the end of it. You cannot own a thing you are charged to tie up to.',
        attribution: 'Captain Ysolde Marr',
        attributionTitle: 'of the Coasting Masters’ Fund',
      },
      'A captain on the Spice Quay',
    ),
    paragraph(
      'Under Article IV of the Charter, the mole is a common work “belonging to all.” The ',
      'Chancellery maintains that the dues fund upkeep, not ownership, and points to the ',
      'storm that carried away twelve blocks of the Elbow before the capstones were set. The ',
      'Times asked the Harbour Commission for the maintenance accounts promised “at the next ',
      'assembly.” We were told they are forthcoming.',
    ),
    paragraph(
      'For now the copper is collected, the line lengthens, and the captains keep a tally of ',
      'their own. This paper will publish both ledgers side by side when the Commission’s is ',
      'finally laid open.',
    ),
  )

// ── The Long Mole Ran Long, and Ran Over (investigation) ────────────────────

export const moleOverrunContent = (): LexicalEditorState =>
  root(
    paragraph(
      'When the Chancellor walked the length of the Long Mole at its opening, the Gazette ',
      'recorded the tea and the applause. It did not record the figure the Times has since ',
      'assembled from the Commission’s own posted tallies: the mole came in at nearly half ',
      'again its first estimate, and two seasons late.',
    ),
    paragraph(
      'The overrun is no scandal on its own. Stone is heavy, the sea is unkind, and the Elbow ',
      'alone swallowed a winter. But the nation was quoted one number when the work began, ',
      'and paid a larger one when it ended — and the difference, with its reasons, is exactly ',
      'what the Charter’s requirement to lay “the full accounts before the Council” exists ',
      'to surface. When the Times raised it in the town hall, the exchange went like this:',
    ),
    block(
      'discord',
      {
        channel: 'town-hall',
        messages: [
          discordMessage('Marlo Tidewell', {
            timestamp: 'Today at 18:02',
            roleColour: '#d98e3f',
            body: 'Question for the Harbour Commission: the mole was quoted at **1,800 blocks of stone**. The posted tallies add up to **2,640**. Where did the other 840 go?',
          }),
          discordMessage('Port Ledger', {
            timestamp: 'Today at 18:02',
            roleColour: '#4f9fa8',
            bot: true,
            body: 'Harbour Commission tallies, Long Mole:\n```\nquoted   1,800\nposted   2,640\nvariance +840 (+46%)\n```',
          }),
          discordMessage('Harbourmaster Bell', {
            timestamp: 'Today at 18:09',
            body: 'Most of it is in the Elbow. The storm took twelve blocks before the capstones went on and we laid the whole turn twice. Full accounts go to the Council at the next assembly.',
          }),
          discordMessage('Marlo Tidewell', {
            timestamp: 'Today at 18:11',
            body: 'Then we’ll print them the day they’re laid. Thanks, Harbourmaster.',
            edited: true,
          }),
        ],
        caption: 'Quoted from the nation’s Discord with the participants’ leave.',
      },
      'The town hall exchange',
    ),
    block(
      'callout',
      {
        style: 'note',
        title: 'What we asked',
        body: 'The Times put five questions to the Harbour Commission regarding the final cost of the Long Mole and the two-season delay. This article will be updated when they are answered.',
      },
      'Questions to the Commission',
    ),
    paragraph(
      'The mole is, by every account, a fine mole. The Times’ quarrel is not with the stone ',
      'but with the arithmetic — and with how long the nation was left to wait before it was ',
      'allowed to see the sum.',
    ),
  )

// ── Opinion: Shine the Same Light on the Ledgers (editorial) ────────────────

export const ledgersOpEdContent = (): LexicalEditorState =>
  root(
    paragraph(
      'This paper is glad the Lighthouse shines again. We are gladder still that the Keeper ',
      'of the Light restored it in the open — with posted accounts, named quarries, and ',
      'thanks paid to every hand that touched the work. That is how the nation’s business ',
      'ought to be done, and it throws into sharp relief how rarely the rest of it is.',
    ),
    paragraph(
      'The Chancellery keeps the archive, sets the harbour dues, and reviews its own works. ',
      'In a nation of one ship’s crew that was trust. In a nation of this size it is a ',
      'habit worth examining. An independent press is not an enemy of the Council; it is the ',
      'Council’s ledger, kept by someone the Council does not pay.',
    ),
    paragraph(
      'We will go on printing the questions until the answers are printed beside them. That ',
      'is the whole of our programme, and we commend it to our readers and our Chancellor ',
      'alike.',
    ),
    paragraph(text('— The Editors, The Azanian Times', ITALIC)),
  )

// ── Salt and Spice Climb as the Trade Winds Turn (markets) ──────────────────

export const spicePricesContent = (marketBannerMediaId: number): LexicalEditorState =>
  root(
    paragraph(
      'The price of salt, pepper and good rope has risen sharply on the Spice Quay this ',
      'fortnight, as the trade winds turn and the last ships of the season come in light. ',
      'The merchants blame the weather; the buyers blame the merchants; the harbour-master ',
      'blames, as ever, the moon.',
    ),
    block(
      'image',
      {
        image: marketBannerMediaId,
        caption: 'Dawn over the harbour, when the Spice Quay market sets its prices.',
        layout: 'wide',
      },
      'The morning market on the Spice Quay',
    ),
    paragraph(
      'The Times will post the quay prices each week through the season, so that a household ',
      'on the Terraces knows what a household on the quay is paying before it sets out with ',
      'a basket. Bring this paper to market — it argues well, and folds smaller than a ',
      'ledger.',
    ),
  )

// ════════════════════════════════════════════════════════════════════════════
// INTERNATIONAL — initiatives among nations, hosted by Azania
// A neutral, multilateral voice: standards, resolutions and case studies that
// member nations draft together. (Norvessa is a fictional demo nation.)
// ════════════════════════════════════════════════════════════════════════════

// ── The Transport Catalogue Opens to Member Nations (announcement) ──────────

export const transportCatalogueContent = (): LexicalEditorState =>
  root(
    paragraph(
      'The Transport Catalogue is open. It gathers, in one place, the standards member nations ',
      'have agreed for building the roads, bridges and harbours that connect them, so that a ',
      'road built in one nation meets a road built in the next without a step, a gap or an ',
      'argument at the border.',
    ),
    block(
      'callout',
      {
        style: 'note',
        title: 'How the Catalogue works',
        body: 'Each initiative drafts its standards in the open. A standard is adopted when the delegates of the participating nations agree to it, and every nation keeps the right to build as it pleases within its own borders.',
      },
      'How the Catalogue works',
    ),
    paragraph(
      'The first initiative, on roads, has begun with the cross-section and drainage of a ',
      'standard trunk road. Further initiatives on bridges and harbour moles will follow as ',
      'nations bring them forward.',
    ),
  )

// ── Road Standard RS-1: Cross-Section and Drainage (standard) ───────────────

export const roadStandardContent = (): LexicalEditorState =>
  root(
    paragraph(
      'This standard sets the cross-section of a trunk road between member nations: its width, ',
      'its materials, and how it sheds water. It applies where a road crosses a border, and is ',
      'recommended for every trunk road leading to one.',
    ),
    heading('1. Carriageway'),
    paragraph(
      'The carriageway is five blocks wide: three of stone brick between two kerbs of polished ',
      'andesite, with a lamp post at every twelfth block on alternating sides.',
    ),
    heading('2. Drainage'),
    paragraph(
      'Every carriageway falls one slab toward its kerbs, and the kerbs carry water to a culvert ',
      'at every low point. No road may send its water onto a neighbour’s land.',
    ),
    heading('3. Border crossings'),
    paragraph(
      'Where the road crosses a border, the two nations build to the same line and level for ',
      'twenty blocks on either side, so the join cannot be seen.',
    ),
    paragraph(text('Adopted by the delegates of the Road Initiative.', ITALIC)),
  )

// ── Case Study: The Long Mole Approach Road (case study) ────────────────────

export const caseStudyContent = (harbourMediaId: number): LexicalEditorState =>
  root(
    paragraph(
      'Azania built the approach road to the Long Mole while the Road Initiative was still ',
      'drafting RS-1, and agreed to build it to the draft. This case study records what that ',
      'taught the initiative.',
    ),
    block(
      'image',
      {
        image: harbourMediaId,
        caption: 'The Long Mole at Port Azania, reached by the first road built to RS-1.',
        layout: 'wide',
      },
      'The Long Mole',
    ),
    heading('What worked'),
    paragraph(
      'The five-block carriageway carried the masons’ carts without widening, and the kerbed ',
      'drainage kept the road dry through the first storm season.',
    ),
    heading('What changed in the standard'),
    paragraph(
      'Lamp posts every eight blocks proved too many on a straight road; the standard now asks ',
      'for every twelfth. The change was proposed by Azania and agreed by the delegates.',
    ),
  )

// ════════════════════════════════════════════════════════════════════════════
// GIRLIETOWN — DefinitelyCasi's town, in its Cherry Blossom style
// A town office in the Gazette and a column in the Times. (Placeholder prose
// for local development; Casi writes the real thing.)
// ════════════════════════════════════════════════════════════════════════════

// ── GirlieTown Opens Its Cherry Grove (statement, Gazette) ──────────────────

export const cherryGroveContent = (): LexicalEditorState =>
  root(
    paragraph(
      'From today the cherry grove on the hillside above GirlieTown is open to every resident ',
      'of Azania. The grove was planted sapling by sapling over the summer, and the town now ',
      'asks only that it be enjoyed and left as it was found.',
    ),
    block(
      'callout',
      {
        style: 'note',
        title: 'In the grove',
        body: 'Petals may be gathered freely. Trees may not be felled, and saplings may not be taken. Benches are for everyone; please leave them as you found them.',
      },
      'In the grove',
    ),
    block(
      'map',
      {
        town: 'GirlieTown',
        zoom: 'town',
        map: 'flat',
        aspect: 'wide',
        claims: true,
        pin: true,
        facts: true,
        caption:
          'GirlieTown on the Rulercraft map, its claims outlined. The grove is on the hillside above the square; the pin marks the town’s home block.',
      },
      'GirlieTown on the map',
    ),
    paragraph(
      'Visitors arriving by the harbour road will find the path marked with lanterns. ',
      'GirlieTown thanks everyone who helped plant it.',
    ),
  )

// ── GirlieTea: Port Azania Could Use a Little More Pink (opinion, Times) ────

export const morePinkContent = (): LexicalEditorState =>
  root(
    paragraph(
      'Port Azania is a handsome city. The harbour is busy, the lighthouse is lovely, and ',
      'every roof from the quay to the Chancellery is the same sensible brown.',
    ),
    paragraph(
      'Sensible is fine. But a capital is allowed a little joy, and cherry planks cost no ',
      'more than oak. A pink door here, a blossom tree in a square there, and the city would ',
      'look like somewhere people choose to live rather than somewhere they keep their ships.',
    ),
    block(
      'skin',
      {
        minecraftName: 'DefinitelyCasi',
        animation: 'idle',
        caption: 'The columnist, as she is seen about the realm. Turn her around; the ribbons are pink.',
      },
      'DefinitelyCasi',
    ),
    paragraph(text('Next week: why every bridge deserves flower boxes.', ITALIC)),
  )

// ── About Azania (standing page — also seeds production) ────────────────────

export const aboutContent = (): LexicalEditorState =>
  root(
    paragraph(
      'Azania is a roleplay nation on the Rulercraft Minecraft server. This site is her ',
      'official record: the Azania Gazette, where the government publishes its decrees, ',
      'news and documents, and the Azanian Times, the nation’s independent press.',
    ),
    heading('How the nation is led'),
    paragraph(
      'Azania is led by Chancellor Luixtiter, together with IPaaat as Co-Leader. Decisions ',
      'of the government are published in the Gazette.',
    ),
    heading('How to join'),
    paragraph(
      'Visit Azania on the Rulercraft server (play.rulercraft.com) and speak with any ',
      'resident, or ask the Chancellor or the Co-Leader in game.',
    ),
    block(
      'callout',
      {
        style: 'note',
        title: 'Writing for the Gazette',
        body: 'Residents can draft articles for the Gazette and the Times; editors review and publish them. If you are a resident and want to write, ask an administrator for an account.',
      },
      'Writing note',
    ),
  )

/** Excerpts (article list summaries), kept here with the prose they summarise. */
export const excerpts = {
  charter:
    'The founding law of the nation: the Chancellor, the Co-Leader and the Council, the rights of residents, land and building law, and the keeping of the Lighthouse.',
  lighthouse:
    'After a season of scaffolding and lime-wash, the Lighthouse on Founders’ Point stands restored — and the archive presents an interactive model of it.',
  foundingDay:
    'One ship, one bad chart, and a harbour nobody else had noticed: the true story of the founding, retold for Founding Day.',
  harbourMole:
    'Three hundred blocks of dressed stone across the mouth of the Old Harbour: the nation’s largest common work is complete and open to all.',
  regatta:
    'A resident’s proposal that the nation keep a Regatta on the calm water behind the Long Mole each year when the trade winds turn.',
  harbourDues:
    'The Chancellery’s new harbour dues are meant to keep the Long Mole in repair. The captains who moor behind it are not convinced they should pay twice for a work they were told was theirs.',
  moleOverrun:
    'The Gazette recorded the tea and the applause at the mole’s opening. It did not record the figure: nearly half again the first estimate, and two seasons late.',
  ledgersOpEd:
    'The Lighthouse was restored in the open, with posted accounts. An editorial on why so little of the rest of the nation’s business is.',
  transportCatalogue:
    'One catalogue for the roads, bridges and harbours that connect member nations, so that what one nation builds meets what the next one builds.',
  roadStandard:
    'The agreed cross-section of a trunk road between member nations: a five-block carriageway, kerbed drainage, and border crossings built to one line.',
  caseStudy:
    'Azania built the Long Mole approach road to the draft standard. What worked, and what it changed in RS-1.',
  spicePrices:
    'Salt, pepper and good rope are dearer on the Spice Quay this fortnight, as the trade winds turn and the last ships of the season come in light.',
  cherryGrove:
    'The cherry grove on the hillside above GirlieTown is open to every resident of Azania from today. A statement from the town.',
  morePink:
    'The harbour is handsome and the lighthouse is lovely, but every roof in the capital is the same sensible brown. A case for cherry planks.',
} as const
