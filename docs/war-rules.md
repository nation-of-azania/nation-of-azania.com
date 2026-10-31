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
| Sessions | 13:00, 19:00 and 01:00 server time (the old guide: CET) | the rules |
| Time to capture the banner | 5 minutes in the zone | the rules (plugin default 7) |
| Banner control points | 10 per holder every 20 seconds (30 a minute) | the rules |
| Points for a kill | 100 to the other side, per death in the siege zone | the rules (plugin default 150) |
| Banner control zone | a town block's width (16 blocks) around the banner, horizontally and vertically, in the wild, at or above the banner's height | **assumed** |
| Siege zone | 200 blocks around the banner, horizontally: no teleporting in, deaths cost points | **assumed** |
| Banner control reversal bonus | on, ×3 | **assumed** |
| Siege balance cap | ±20,000 | **assumed** |
| End of a session | the balance moves by attacker points − defender points | **assumed** (plugin default; "winner takes all" off) |

**Banner control.** A player who stays in the zone for the capture time,
alive, not flying or gliding, finishes a capture. If their side already
holds the banner they join its holders; otherwise (nobody holds it, or the
enemy does) their side takes it and they become its only holder, and the
enemy's holders lose it. Holders keep it until the enemy takes the banner
or the session ends, wherever they go and even if they die. Every 20
seconds the holding side earns 10 points per holder.

**Reversal bonus.** Taking the banner from the enemy is a reversal. After
the first, the holding side's banner points are multiplied by 3; after the
second, by 6; and so on (the number of reversals × 3), for whichever side
holds it. Retaking the banner is therefore worth far more than holding it
from the start.

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

## Differences in the older wiki guide

The Rulercraft wiki's War Guide (possibly outdated) gives the session times
in CET, says quarry nations must be on the same continent (or take the
nearest quarry), lists no 6-day cooldown for declaring war, and lets
capitals be peaceful (without managing alliances). Its overview speaks of 2
battles per war; its detailed section, like the current rules, of 3.
