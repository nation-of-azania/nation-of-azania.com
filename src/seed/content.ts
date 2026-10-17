import {
  ITALIC,
  block,
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
 */

// ── The Charter of Condoria (pinned decree) ─────────────────────────────────

export const charterContent = (): LexicalEditorState =>
  root(
    paragraph(
      'In the beginning there was a valley: a green fold of the Rulercraft realm between the ',
      'north mountains and the quiet sea, claimed by no crown and mapped by no surveyor. Those ',
      'who came to it first came on foot, carrying tools rather than banners. What follows is ',
      'the law they agreed upon, written so that the nation they founded would outlast them.',
    ),
    block(
      'callout',
      {
        style: 'decree',
        title: 'Proclamation of the Founding Council',
        body: 'By decree of the Founding Council, given under the Seal of the Nation on the first day of November in the Year of Founding, this Charter is adopted as the supreme law of Condoria, binding upon every resident, officer and guest within her borders.',
      },
      'Founding proclamation',
    ),
    heading('Article I — The Nation and Its Territory'),
    paragraph(
      'Condoria is a free and sovereign nation of the Rulercraft realm. Her territory is the ',
      'charted land between the North Range and the South Quay, together with such districts ',
      'as the Council may lawfully annex by charter and beacon. The capital is the city of ',
      'Condoria-upon-Vale, seat of the Chancellery and of the national archive.',
    ),
    heading('Article II — The Council and the Chancellery'),
    paragraph(
      'The nation is governed by a Council of residents in good standing, presided over by a ',
      'Chancellor whom the Council elects. The Council makes law by open vote in the Hall of ',
      'Assembly; the Chancellor executes it and keeps the Seal. No decree takes force until it ',
      'is read aloud in the Hall and entered into the Gazette.',
    ),
    heading('Article III — The Rights of Residents'),
    paragraph(
      'Every resident of Condoria holds these rights, which no decree may abridge: to speak ',
      'and to write freely in the affairs of the nation; to hold land granted by charter; to ',
      'petition the Council and be heard; to travel the roads and waters of the realm; and to ',
      'depart in peace, taking what is theirs.',
    ),
    heading('Article IV — Land, Building and the Common Works'),
    paragraph(
      'Land within the nation is granted by charter and held by stewardship. A resident may ',
      'build freely upon their grant, provided the work honours the character of its district ',
      'and endangers no neighbour. Roads, bridges, lighthouses and walls are common works, ',
      'raised by the nation and belonging to all. No common work may be torn down save by ',
      'decree of the Council.',
    ),
    heading('Article V — The National Monument'),
    paragraph(
      'Upon the founding hill stands the National Monument: a stone obelisk crowned with a ',
      'gilded pyramidion, raised where the first camp was pitched. It is the memory of the ',
      'nation made visible. The Monument is inviolable; its keeping is the first duty of the ',
      'Chancellery, and its light shall not be allowed to fail.',
    ),
    heading('Article VI — Amendment and Continuity'),
    paragraph(
      'This Charter may be amended only by a two-thirds voice of the Council, taken in open ',
      'assembly on two separate days. Should the nation ever be scattered, the Charter ',
      'endures: wherever three residents gather under its words, there is Condoria.',
    ),
    paragraph(
      text('Given under the Seal of the Nation, in the Year of Founding.', ITALIC),
    ),
  )

// ── The National Monument, Restored (3D model showcase) ─────────────────────

export const monumentContent = (glbMediaId: number): LexicalEditorState =>
  root(
    paragraph(
      'After a season of scaffolding, canvas and the patient chiselling of the masons’ ',
      'guild, the National Monument stands restored. The obelisk’s weathered faces have ',
      'been redressed stone by stone, and the gilded pyramidion — dulled by years of rain ',
      'and creeper-scorch — has been releafed in true gold, so that it once again catches ',
      'the first light over the founding hill.',
    ),
    block(
      'callout',
      {
        style: 'note',
        title: 'An interactive exhibit',
        body: 'The model below is a living exhibit from the national archive. Drag to orbit the Monument, scroll to draw nearer, and let it turn on its own when your hand rests.',
      },
      'Interactive exhibit note',
    ),
    block(
      'model3d',
      {
        model: glbMediaId,
        caption: 'The National Monument — drag to orbit',
        autoRotate: true,
      },
      'The National Monument',
    ),
    paragraph(
      'The Monument was raised in the first winter, before the walls, before the roads, ',
      'before even the granary — a fact the founders were fond of repeating whenever anyone ',
      'questioned their priorities. It marks the spot where the first camp was pitched and ',
      'the Charter first read aloud, and by Article V of that Charter its keeping is the ',
      'first duty of the Chancellery.',
    ),
    paragraph(
      'The restoration was carried out under the direction of the Keeper of Records, with ',
      'stone drawn from the original quarry in the North Range and gold leaf beaten in the ',
      'workshops of the South Quay. The Council extends the nation’s thanks to every ',
      'hand that touched the work. The scaffolds come down on Founding Day; the light, as ',
      'the Charter requires, shall not be allowed to fail.',
    ),
  )

// ── Founding Day: How Condoria Came To Be (gazette feature) ─────────────────

export const foundingDayContent = (bannerMediaId: number): LexicalEditorState =>
  root(
    paragraph(
      'Every nation keeps one story it tells more often than the rest. Ours begins with ',
      'eleven travellers, one boat with a leak in it, and a valley nobody else wanted. ',
      'This Founding Day, the Gazette retells how Condoria came to be — as it happened, ',
      'and not as the tavern versions have improved it.',
    ),
    paragraph(
      'The first party crossed the North Range in deep snow, having been assured by a map ',
      '(since framed in the Hall of Assembly, as a warning) that the pass was gentle. It ',
      'was not. What they found on the far side, however, was: a sheltered vale, a river ',
      'running clean to the sea, and high ground crying out for a beacon. They pitched camp ',
      'on the hill where the Monument now stands, and by firelight that same evening began ',
      'arguing about the constitution — a tradition we maintain to this day.',
    ),
    block(
      'quote',
      {
        quote:
          'We did not come to this valley to build walls; we came to build a table long enough for everyone who would sit at it.',
        attribution: 'The First Chancellor',
        attributionTitle: 'at the Founding Assembly',
      },
      'The First Chancellor',
    ),
    paragraph(
      'The Founding Assembly met for three days. It produced the Charter, the office of the ',
      'Chancellery, and the national habit of settling questions by open vote and closing ',
      'the session with supper. The eleven signed by torchlight; the youngest of them, it ',
      'is recorded, signed twice, to be sure.',
    ),
    block(
      'image',
      {
        image: bannerMediaId,
        caption: 'The Founding Day standard, raised over the assembly field each year at first light.',
        layout: 'wide',
      },
      'Founding Day standard',
    ),
    paragraph(
      'Founding Day is now kept every year on the first of November: the standard is raised ',
      'at dawn, the Charter is read from the Monument steps, and the long table is laid the ',
      'length of the assembly field. All residents are expected; all travellers are welcome. ',
      'Bring a dish, a story, or both.',
    ),
  )

// ── The Great North Road Opens (public works report) ────────────────────────

export const northRoadContent = (
  banner1MediaId: number,
  banner2MediaId: number,
): LexicalEditorState =>
  root(
    paragraph(
      'The Great North Road is open. From the capital gates to the high pass of the North ',
      'Range, forty-two hundred blocks of graded stone now carry travellers in hours over ',
      'ground that once cost days — and, in the wet season, occasionally cost boots. It is ',
      'the largest common work the nation has yet undertaken, and as of this week it ',
      'belongs, as all common works do, to everyone.',
    ),
    paragraph(
      'The road runs from the Vale Gate along the river terraces, crosses the gorge at the ',
      'new Sixstone Bridge — five arches of quarried granite and one of stubbornness, as ',
      'the Road Commission’s foreman put it — and climbs by switchbacks to the beacon ',
      'at the pass. Waymark posts stand every two hundred blocks, capped in gold leaf so ',
      'they catch lantern-light. Travellers are asked to keep to the marked way in the ',
      'gorge section and to stable their mounts at the pass house in storm weather.',
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
      'The Chancellor cut the ribbon at the Vale Gate at dawn and then, in keeping with ',
      'tradition, walked the whole road with the survey crews, arriving at the pass by ',
      'lantern-light to loud approval and hot soup. The first official traveller through ',
      'was a grain cart from the eastern farms, which the Commission notes is exactly the ',
      'point.',
    ),
    block(
      'gallery',
      {
        items: [
          galleryItem(banner1MediaId, 'Surveying the route at first light, below the North Range.'),
          galleryItem(banner2MediaId, 'The Sixstone Bridge and the road to the pass.'),
        ],
        columns: '2',
      },
      'Views of the North Road',
    ),
    paragraph(
      'The Road Commission’s full accounts will be laid before the Council at the next ',
      'assembly and printed in the Gazette, as the Charter requires of every common work. ',
      'Proposals for the South Road may now be submitted to the Chancellery.',
    ),
  )

// ── Proposal: Lantern Festival on the South Quay (resident draft) ───────────

export const lanternFestivalContent = (): LexicalEditorState =>
  root(
    paragraph(
      'To the Council, from a resident of the South Quay district: I propose that the ',
      'nation keep a Lantern Festival on the quay at midsummer. One evening each year, ',
      'every household would set a lantern on the water — one light for each resident, so ',
      'the harbour carries the whole nation on it for a night. The fisher-folk already do ',
      'this in a small way after a safe season; I propose we make it everyone’s.',
    ),
    paragraph(
      'The cost is modest: paper, wax, and one evening of the harbour-master’s ',
      'patience. I have spoken with the workshops on the quay, which offer to teach ',
      'lantern-folding in the week beforehand, and with the ferry crews, who ask only that ',
      'the channel be kept clear until moonrise. If the Council finds merit in this, I will ',
      'gladly organise the first festival and answer for the sweeping-up.',
    ),
  )

// ════════════════════════════════════════════════════════════════════════════
// THE CONDOR TIMES — the independent press (section: 'times')
// A sharper, more journalistic voice than the state Gazette: markets, daily
// life, and a healthy scepticism of the Chancellery.
// ════════════════════════════════════════════════════════════════════════════

// ── Traders Balk as Vale Gate Toll Takes Effect (lead story) ────────────────

export const valeGateTollContent = (): LexicalEditorState =>
  root(
    paragraph(
      'The new toll at the Vale Gate — a copper for every laden cart passing into the ',
      'capital — took effect at first light on market-day, and by mid-morning the queue at ',
      'the gate was longer than the gatehouse ledger. The Chancellery says the coin will keep ',
      'the Great North Road in repair. The traders who use that road are not yet convinced ',
      'they should pay twice for a work they were told belonged to everyone.',
    ),
    block(
      'quote',
      {
        quote:
          'They cut the ribbon and told us the road was ours. A fortnight later they put a till at the gate. You cannot own a thing you are charged to cross.',
        attribution: 'Bram Cartwright',
        attributionTitle: 'of the Carters’ Benevolent Fund',
      },
      'A carter at the Vale Gate',
    ),
    paragraph(
      'Under Article IV of the Charter, the North Road is a common work “belonging to all.” ',
      'The Chancellery maintains that the toll funds upkeep, not ownership, and points to the ',
      'wet-season washouts that closed the gorge section twice last year. The Times asked the ',
      'Road Commission for the maintenance accounts promised “at the next assembly.” We were ',
      'told they are forthcoming.',
    ),
    paragraph(
      'For now the copper is collected, the queue lengthens, and the carters keep a tally of ',
      'their own. This paper will publish both ledgers side by side when the Commission’s is ',
      'finally laid open.',
    ),
  )

// ── The North Road Ran Long, and Ran Over (investigation) ───────────────────

export const roadOverrunContent = (): LexicalEditorState =>
  root(
    paragraph(
      'When the Chancellor walked the length of the Great North Road at its opening, the ',
      'Gazette recorded the soup and the applause. It did not record the figure the Times has ',
      'since assembled from the Commission’s own posted tallies: the road came in at nearly ',
      'half again its first estimate, and two seasons late.',
    ),
    paragraph(
      'The overrun is no scandal on its own. Stone is heavy, the gorge is unkind, and the ',
      'Sixstone Bridge alone swallowed a winter. But the nation was quoted one number when the ',
      'work began, and paid a larger one when it ended — and the difference, with its reasons, ',
      'is exactly what the Charter’s requirement to lay “the full accounts before the Council” ',
      'exists to surface.',
    ),
    block(
      'callout',
      {
        style: 'note',
        title: 'What we asked',
        body: 'The Times put five questions to the Road Commission regarding the final cost of the North Road and the two-season delay. This article will be updated when they are answered.',
      },
      'Questions to the Commission',
    ),
    paragraph(
      'The road is, by every account, a fine road. The Times’ quarrel is not with the stone ',
      'but with the arithmetic — and with how long the nation was left to wait before it was ',
      'allowed to see the sum.',
    ),
  )

// ── Opinion: Who Keeps the Keepers? (editorial) ─────────────────────────────

export const keepersOpEdContent = (): LexicalEditorState =>
  root(
    paragraph(
      'This paper is glad the National Monument shines again. We are gladder still that the ',
      'Keeper of Records restored it in the open — with posted accounts, named quarries, and ',
      'thanks paid to every hand that touched the work. That is how the nation’s business ',
      'ought to be done, and it throws into sharp relief how rarely the rest of it is.',
    ),
    paragraph(
      'The Chancellery keeps the archive, sets the tolls, and reviews its own works. In a ',
      'nation of eleven founders that was trust. In a nation of this size it is a habit worth ',
      'examining. An independent press is not an enemy of the Council; it is the Council’s ',
      'ledger, kept by someone the Council does not pay.',
    ),
    paragraph(
      'We will go on printing the questions until the answers are printed beside them. That ',
      'is the whole of our programme, and we commend it to our readers and our Chancellor ',
      'alike.',
    ),
    paragraph(text('— The Editors, The Condor Times', ITALIC)),
  )

// ── Quay Prices Climb as the Stores Run Thin (markets) ──────────────────────

export const quayPricesContent = (quayBannerMediaId: number): LexicalEditorState =>
  root(
    paragraph(
      'The price of salt-fish, lamp-oil and good rope has risen sharply on the South Quay ',
      'this fortnight, as the last boats before the ice come in light and the winter stores ',
      'are drawn down. The fishers blame the weather; the buyers blame the fishers; the ',
      'harbour-master blames, as ever, the moon.',
    ),
    block(
      'image',
      {
        image: quayBannerMediaId,
        caption: 'The South Quay at first light, where the winter market sets its prices.',
        layout: 'wide',
      },
      'The winter market on the South Quay',
    ),
    paragraph(
      'The Times will post the quay prices each week through the winter, so that a household ',
      'on the terraces knows what a household on the quay is paying before it sets out with ',
      'a basket. Bring this paper to market — it argues well, and folds smaller than a ',
      'ledger.',
    ),
  )

// ── About Condoria (standing page) ──────────────────────────────────────────

export const aboutContent = (): LexicalEditorState =>
  root(
    paragraph(
      'Condoria is a roleplay nation on the Rulercraft Minecraft server: a small country ',
      'with a Charter, a Council, a Gazette, and rather more opinions about bridge ',
      'architecture than is strictly necessary. This site is her official record — the ',
      'decrees, news and culture of the nation, published by the Chancellery.',
    ),
    paragraph(
      'In the world, Condoria lies between the North Range and the sea: a walled capital ',
      'in the vale, farming terraces along the river, and the harbour district of the ',
      'South Quay. On the founding hill stands the National Monument, an obelisk crowned ',
      'in gold, raised where the first camp was pitched.',
    ),
    heading('How the nation is governed'),
    paragraph(
      'Condoria is governed by a Council of residents presided over by an elected ',
      'Chancellor, under the Charter adopted at the founding. Law is made by open vote in ',
      'the Hall of Assembly and published in the Gazette before it takes force. Day-to-day ',
      'matters — land grants, common works, the keeping of the archive — rest with the ',
      'Chancellery.',
    ),
    heading('How to join'),
    paragraph(
      'Joining is simple and free of ceremony, though we do enjoy ceremony. Visit ',
      'Condoria on the Rulercraft server and speak with any resident, or leave word for ',
      'the Chancellery in the capital. New residents receive a land grant in one of the ',
      'open districts, a copy of the Charter, and an honest warning about the length of ',
      'Council meetings. Builders, farmers, archivists and wanderers are all equally ',
      'welcome; the only firm requirements are good faith and a tolerance for bunting.',
    ),
    block(
      'callout',
      {
        style: 'note',
        title: 'Visiting in game',
        body: 'Condoria welcomes travellers. Look for the gold-capped waymarks of the Great North Road, keep to the marked way in the gorge, and present yourself at the Vale Gate. The kettle in the gatehouse is, by long custom, always on.',
      },
      'Visiting note',
    ),
    paragraph(
      'This website is also the nation’s working press: residents draft articles, ',
      'editors of the Gazette review and publish them, and the Chancellery keeps the ',
      'archive. If you are a resident and wish to write, ask the Keeper of Records for an ',
      'account.',
    ),
  )

/** Excerpts (article list summaries), kept here with the prose they summarise. */
export const excerpts = {
  charter:
    'The founding law of the nation: the Council and the Chancellery, the rights of residents, land and building law, and the keeping of the National Monument.',
  monument:
    'After a season of scaffolding and gold leaf, the obelisk on the founding hill stands restored — and the archive presents an interactive model of it.',
  foundingDay:
    'Eleven travellers, one leaking boat, and a valley nobody else wanted: the true story of the founding, retold for Founding Day.',
  northRoad:
    'Forty-two hundred blocks of graded stone from the Vale Gate to the high pass: the nation’s largest common work is open to all.',
  lanternFestival:
    'A resident’s proposal that the nation keep a midsummer Lantern Festival on the water of the South Quay.',
  valeGateToll:
    'The Chancellery’s new toll at the Vale Gate is meant to keep the North Road in repair. The traders who use it are not convinced they should pay twice for a road they were told was theirs.',
  roadOverrun:
    'The Gazette recorded the soup and the applause at the road’s opening. It did not record the figure: nearly half again the first estimate, and two seasons late.',
  keepersOpEd:
    'The Monument was restored in the open, with posted accounts. An editorial on why so little of the rest of the nation’s business is.',
  quayPrices:
    'Salt-fish, lamp-oil and good rope are dearer on the South Quay this fortnight, as the last boats before the ice come in light and the winter stores run thin.',
} as const
