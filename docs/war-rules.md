# Rulercraft war rules

The rules of war on the Rulercraft server, kept here for reference: what
Azania Maps' war view counts with (src/maps/battle.ts) and what a decree or
an article about a war can be checked against. Given by the nation's
leadership on 31 October 2026, from the server's own announcement (the part
marked "should be up to date"). An older copy of the Rulercraft wiki's War
Guide differs in small ways, noted at the end.

The second half, **How a battle is scored**, is how the SiegeWar plugin the
server runs turns those rules into numbers, read from its source code, with
what the rules say Rulercraft changed and what is still the plugin's
default because the rules don't say.

## Quarry, Treasure Ship and Wasteland systems

Passive income and resource sites for nations to fight over.

- Wastelands produce $160 a day, Quarries $333 and Treasure Ships $500, to
  the nation that controls it, through occupation tax. They are marked on
  the map, and any current conflict shows when zoomed in.
- Wastelands also let the nation gather resources inside the town and
  teleport to it.
- Quarries and Treasure Ships don't need PvP turned on. Every non-peaceful
  player can attend.
- Active status is only required during the weekend sessions, not on
  weekdays. Allies can also take part.
- Outsiders aren't allowed during sessions and will die if too close.

**Sieging.** Every day at 13:00, 19:00 and 01:00 there is a one-hour battle
session, during which nations can siege and fight over these places. A
siege starts with a coloured banner placed in the middle of the site,
marked with redstone blocks, before the session or within its first 10
minutes. Nations fight for control of the banner point: holding the area or
killing enemies gains points. The nation with the most points after 3
sessions wins. Once the battle is over, another coloured banner annexes the
site into the nation (within 3 hours).

**Rules.**

- A nation may control or take part in only one of each type.
- A nation may only take part in the ones nearest to the majority of its
  towns, or its region. Homeblock range isn't considered.
- No sieging without a real intention of taking over, or just to waste time
  and prevent other sieges.
- Quarries, Treasure Ships and Wastelands and their income may not be part
  of any treaty, deal or agreement.

## War system

**Rules.**

- Attempts to cheat, bypass or exploit the purpose of the system will be
  acted upon.
- New towns have a grace period from war for the week they are created.
- A nation needs at least 5 residents to declare war.
- The most distance for war is **12,320 blocks** between the target town and
  the attacker's capital's homeblock.
- Towns ruled by Ruler (NPC) mayors may not be declared upon.
- Players within the banner control radius must be reachable by the
  opposing side.
- Spectators and inactive players aren't allowed to interfere, and die if
  too close.
- A nation can declare one war a week. A cancelled war, or an agreement at
  any point, still counts.
- After a declaration, every participating nation and town is locked: no
  new residents or allies brought to the war, no changing nations.

**Cooldowns** (`/siege-cd`).

- 3-day siege cooldown (no taking part in sieges) after joining a town, or
  a town joining a nation; 5 days after founding a town.
- 6-day global cooldown (no declaring wars, no forming or removing
  alliances) after declaring war, founding a nation, moving the nation's
  capital or leader, moving its homeblock, or forming an alliance.

**Attacker protections.** Only the defender nation may declare war on the
attacker on the same day; every other nation only the next day. This
doesn't apply to wars on nationless towns, nor to staged wars.

**Defender protections.**

- A defender nation can be declared on once a week by the attacking nation
  or its allies combined; a nation not allied to the earlier attacker still
  can.
- Only one war a day can be declared on a defender nation.
- A nation that loses a town in a war, or a town that loses land, is exempt
  from new wars against it or by it that week.

**Occupation and revolt.**

- Occupied towns can't leave the nation, but can revolt to escape.
- Occupied mayors may not leave the town or change mayor without winning
  the revolt, unless the occupier approves.
- Occupied towns pay occupation tax of at most $0.04 per claim, unless
  bankrupt (`/n set occupationtax X`).
- Revolts can be fought in any battle session, with no declaration needed,
  and have a 7-day cooldown.
- The mayor or co-mayor of an occupied town starts a revolt with a coloured
  banner outside the town, before the session or within 10 minutes of its
  start. The occupation ends at once, so the town can join a nation for
  help (`/revolt` then removes the war cooldown). The revolt siege is
  fought over the next **2** battle sessions. Won, the town stays free;
  lost, the occupier can occupy it again or plunder it.

**Activity.** Taking part in offensive wars or helping allies needs Active
status (a star before the name; `/ranks`), gained by playing (`/rewards`).
The defender nation never needs it.

**Peaceful towns** (`/t toggle peaceful`). Non-capital towns can choose
neutrality, for $200 a day: they can't be attacked or sieged, and can't take
part in wars or sieges, declare war, annex land, enable PvP, add or claim
bounties, or use the Soldier and General ranks. Shown as "(Peaceful)" in
`/town info`. A town can never be taken from its owner, and well developed
builds can't be annexed; peaceful status isn't needed for that.

## War on Rulercraft

**Declaration.** On Friday or Saturday between 13:00 and 23:00, a nation
leader or co-leader declares in game with `/declare-war Town_Name
Nation_Name` (exactly as spelt, e.g. `The_Rulers`; `Nationless` for a town
without a nation). It shows in #war-declarations, where the reasons are
explained in a thread; roleplay is recommended. `/cancel-war Town_Name
Nation_Name` cancels.

**Siege.**

- A coloured banner placed outside the town, in the wild, before the first
  session sets up the siege; the fight takes place there.
- The siege is held the next day (Saturday or Sunday) at **13:00, 19:00 and
  01:00**: **3 battle sessions of 1 hour each**. The winner is the side with
  more battle points after the 3 sessions.
- KeepInventory is on: no gear or experience is lost. The attacker and its
  allies need Active status.
- **Banner control:** staying close to the siege banner for **5 minutes**
  (a yellow bossbar) captures the banner for the player and their side.
  Don't leave, or go into the town. The side then gets **10 points every 20
  seconds for each player with banner control**. Once a player has
  captured, they can move away and still earn points. The enemy can try to
  capture it for themselves, which must be fought off.
- **Kills:** killing an enemy player earns the side **100 points**.
- A white banner outside the town surrenders or abandons the siege.
- `/sw hud Townname`, or the siege on the world map, shows its status.

**Conclusion.** The winner chooses one of:

- **Plunder:** $500 per resident of the town, at least $1,500 and at most
  $7,500; half that after a close victory, by less than **3,500 points**. The
  server lends the town the money for 14 days so the attacker is paid at
  once. Nationless, occupied, or inactive-mayor (14+ days) towns can't be
  plundered; a town that falls for not paying the plunder debt makes the
  attacker lose it; a town can be plundered once every 2 weeks. A chest
  outside the town plunders.
- **Invade:** occupy the town and add it to the nation (a capital only if
  it's the nation's last town), charging occupation tax and able to
  teleport to it. A coloured banner outside the town; the Insurgent rank on
  the mayor keeps them from leaving.
- **Negotiate:** at most 3 hours from the session's end to agree a custom
  peace treaty, confirmed by staff through a ticket; failing that, another
  option within the 3 hours.
- **Convert:** the town's religion and/or culture becomes the winner's for
  30 days, through a ticket.
- **Annex land** (`/annex`): 200 chunks, or up to 30% of a neighbouring
  town's low-development land, at no cost, through a ticket. Builds made
  after the declaration don't count as developed; a complete defensive wall
  (all round, or ending in ocean, sea, large lakes or at nation borders)
  protects the chunks it encloses.
- **Pardon:** no punishment.

## How a battle is scored

From SiegeWar's source (TownyAdvanced/SiegeWar, read 31 October 2026), with
Rulercraft's values where the rules give them. **Assumed** marks a value the
rules don't give, taken from the plugin's defaults; the server may have
changed it.

| | Value | Source |
|---|---|---|
| Battle sessions in a siege | 3 (2 for a revolt) | the rules |
| Session length | 60 minutes | the rules |
| Sessions | 13:00, 19:00 and 01:00 server time, CET/CEST | the rules; confirmed by the leadership |
| Time to capture the banner | 5 minutes in the zone, from the first 20-second check that finds the player there | the rules; seen in a battle (plugin default 7) |
| Banner control points | 10 per holder every 20 seconds (30 a minute) | the rules; seen in a battle |
| Points for a kill | 100 to the other side, per death in the siege zone | the rules; seen in a battle (plugin default 150) |
| Banner control zone | 18 blocks around the banner, horizontally and vertically, in the wild (not on a town's claims) | told in game (plugin default 16) |
| Siege zone | 200 blocks around the banner, horizontally: no teleporting in, deaths cost points | **assumed** |
| Banner control reversal bonus | none: after a reversal, still 10 a holder every 20 seconds | seen in a battle (plugin default on, ×3) |
| Siege balance cap | ±7,000 | seen in a battle (plugin default ±20,000) |
| End of a session | the balance moves by attacker points − defender points; the siege goes to the side the balance favours after the last session | confirmed by the leadership ("winner takes all" off) |

**Banner control.** A player who stays in the zone for the capture time,
alive, not flying or gliding, finishes a capture. If their side already
holds the banner they join its holders; otherwise (nobody holds it, or the
enemy does) their side takes it and they become its only holder, and the
enemy's holders lose it. Holders keep it until the enemy takes the banner
or the session ends, wherever they go and even if they die. Every 20
seconds the holding side earns 10 points per holder.

**Who fights for whom.** SiegeWar decides a player's side in a siege
from where they live and their nation's alliances (its source,
`SiegeSide.getPlayerSiegeSide`), defenders first:

1. A resident of the besieged town, with the town's battle-points right,
   defends.
2. A soldier (the nation's battle-points right) of the besieged town's
   nation, or of a nation **mutually allied** with it, defends. A town of
   no nation has no nation soldiers and no allies: only its own residents
   defend it.
3. Otherwise, a soldier of the attacking nation, or of a nation mutually
   allied with it, attacks.
4. Anyone else is nobody's: they can't take the banner, and their death
   scores nothing.

So an ally of both sides defends. Allied nations' fighters can move between
their sieges in the same session and score at either. The Rulercraft map
shows no alliances. Azania Maps learns them from the battles (a player of
one nation taking the banner for another's side), from Azania's diplomacy,
and from a list the diplomats keep (Settings → Azania Maps → Alliances;
src/maps/alliances.ts).

**Reversal bonus.** Taking the banner from the enemy is a reversal. In
SiegeWar's defaults, after the first the holding side's banner points are
multiplied by 3, after the second by 6, and so on. **Rulercraft has it
off**: in the battle at South_America_Quarry (below), the defenders who
took the banner back earned 10 a holder every 20 seconds, as anyone
holding it does. Retaking the banner is worth no more than holding it.

**Deaths.** A player of either side who dies in the siege zone during a
session gives the other side the kill points, whether an enemy killed them
or not. A death also ends a capture in progress, but never takes a holder's
banner control away.

**The siege balance.** At the end of each session the balance moves by the
attacker's battle points minus the defender's (positive favours the
attacker), held within the cap, and both sides' battle points, the banner
and the reversals start again from nothing. After the last session the side
the balance favours wins; a margin under 3,500 points is a close victory.

**What the map shows.** SiegeWar's marker on the Rulercraft map (refreshed
by the plugin every 15 seconds) gives the town, the siege type, the war
chest, sessions done of how many, the status, the balance, who holds the
banner and how many holders, both sides' battle points in this session, and
the time left in it. It doesn't give the banner's height, who the holders
are, or how many reversals there have been.

## Seen in a battle

Logged from the Rulercraft map every 2 seconds through the battle session
of 31 October 2026, 19:00 CET: The Balkan Kingdom besieging Cyprus
(Syrian Empire), the second of three sessions, the balance at +3,280 to
the attacker. The map's live feed carries SiegeWar's siege marker each
time the plugin rewrites it, and every player's position, health and
armour.

- **Checks every 20 seconds.** SiegeWar does everything on Towny's short
  tick, every 20 seconds (here at about :10, :30 and :50 past each
  minute): starting the session, counting who is in the banner zone,
  finishing captures and paying banner points. A player who stepped a
  few seconds out of the zone between two checks wasn't noticed; that
  says nothing about how wide the zone is.
- **The marker** is rewritten every 15 seconds exactly; the session
  started on the check after 19:00 (the marker turned to crossed swords
  at 19:00:22).
- **Capture: 5 minutes from the first check that finds a player in the
  zone.** Two attackers stood in the zone before the session; the banner
  became theirs on the check five minutes after the session's first
  ("Attackers (2)" at 19:05:38 on the marker). A third attacker, in the
  zone from 19:22:57, joined the holders on the check five minutes after
  the first that found him (19:28:23 on the marker), and the points went
  from +20 to +30 a tick at once: joining the holders brings no bonus and
  costs none.
- **10 points a holder every 20 seconds**: +20 a tick with two holders,
  +30 with three, 4,240 in 55 minutes.
- **Holders keep control wherever they go**: both first holders teleported
  away at 19:07, and for the next 50 minutes nobody of either side stood
  within 200 blocks of the banner, while the attackers earned their +20
  and then +30 a tick to the end.
- **100 points a kill**: a defender died at the banner at 19:02:48
  (health 4, then 0) and the attackers had +100 two seconds later; he
  came back 791 blocks away.
- **An outsider removed**: a player of neither side stood at the banner
  for 48 seconds and was taken away at full health (back 24,847 blocks
  off), as the rules say of spectators; nobody got points for it.
- **The balance cap is 7,000.** The session ended at +4,340 to 0 (the
  last check at about 20:00:10, the marker at 20:00:39), which would have
  taken the balance from 3,280 to 7,620; it became 7,000. The battle
  points, the banner and its holders started again from nothing, and the
  siege showed 2 of 3 sessions done.

Logged the same way through the battle session of 1 November 2026, 01:00
CET (00:00–01:00 UTC), with two battles on: the last of Cyprus's three,
and the first of Sul America's siege of South_America_Quarry (held by the
American Syndicate), laid during the session:

- **Defenders' points are written with a minus.** The marker reads
  "+730 / -1530" for 730 to the attackers and 1,530 to the defenders; the
  balance after the session was 730 − 1,530 = −800. The sign is the way the
  points move the balance; both are points earned. (Azania Maps read the
  minus as negative points until then.)
- **No reversal bonus.** At South_America_Quarry the attackers held the
  banner from 00:13:50 with one holder (+10 a tick to 730), the defenders
  took it back at 00:38:20 with one holder and earned 10 a tick, 20 with
  two from 00:44:48: no ×3.
- **A kill is 100, again**: four attackers died in the siege zone (00:38:40,
  00:47:52, 00:53:10, 00:59:22, by health and respawn on the live feed),
  and each time the defenders' points jumped by 100 on top of the tick.
- **A siege laid in a session's first ten minutes fights that session**:
  South_America_Quarry's banner went up at 00:08:35, its battle began at
  once (51.6 minutes left), and the session counted as its first (0/3 →
  1/3).
- **Allies fight.** The two players who took South_America_Quarry's banner
  back for the defenders live in Imperial Avalonia's town, not the American
  Syndicate's. Who lives where can't say who fights for whom; the tracker
  tells it from their play (src/maps/fights.ts → sideShownBy), and from
  that, that Imperial Avalonia and the American Syndicate are allied (see
  Who fights for whom, above).
- **Cyprus fell.** Its last session ended at +4,750 to 0 with the balance at
  the cap of +7,000, and SiegeWar removed the siege's marker at 01:00:33:
  the attackers won.
- **Holders who leave keep it**: Cyprus's two attackers who took the banner
  at 00:05:35 teleported away two seconds later (thousands of blocks off,
  at full health), and the attackers went on earning for two holders.

**Told in game** (a player's chat as a capture starts, forwarded on 1
November 2026): "Banner control session started. Remain within 18 blocks
of the banner, but staying out of the town, for 5 minutes. If your session
succeeds, you will gain banner control for your side (or be added to the
banner control list)." So the banner zone is 18 blocks, not SiegeWar's
default 16, and a capture counts only off the town's claims (SiegeWar's
`banner_control_session_check_wilderness`). In SiegeWar's code the 18 holds
up and down as well as across the ground; the map gives no banner height,
so Azania Maps checks the ground only, and leaves out readings on any town's
claims (src/maps/battle.ts → inBannerZone). The five minutes are confirmed
the same way. It fits the captures logged so far: at SiegeWar's checks the
capturers stood within about 15 blocks.

Not seen, and so still the plugin's default: the siege zone's radius (200),
and deaths outside the siege zone.

## Differences in the older wiki guide

The Rulercraft wiki's War Guide (possibly outdated) gives the session times
in CET, says quarry nations must be on the same continent (or take the
nearest quarry), lists no 6-day cooldown for declaring war, and lets
capitals be peaceful (without managing alliances). Its overview speaks of 2
battles per war; its detailed section, like the current rules, of 3.
