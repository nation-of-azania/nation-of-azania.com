import * as migration_20260709_235205 from './20260709_235205';
import * as migration_20260710_001958_username_auth from './20260710_001958_username_auth';
import * as migration_20260710_223018_add_article_section from './20260710_223018_add_article_section';
import * as migration_20261017_160020_byline_profiles from './20261017_160020_byline_profiles';
import * as migration_20261017_160850_ipaaat_byline_profiles from './20261017_160850_ipaaat_byline_profiles';
import * as migration_20261018_062606_contexts from './20261018_062606_contexts';
import * as migration_20261018_113846_styles from './20261018_113846_styles';
import * as migration_20261018_123000_girlietown from './20261018_123000_girlietown';
import * as migration_20261018_131500_girlietown_samples from './20261018_131500_girlietown_samples';
import * as migration_20261018_155642_discord_announcements from './20261018_155642_discord_announcements';
import * as migration_20261019_021903_discord_settings from './20261019_021903_discord_settings';
import * as migration_20261019_022500_luixtiter from './20261019_022500_luixtiter';
import * as migration_20261020_092846_azania_maps from './20261020_092846_azania_maps';
import * as migration_20261020_140712_map_polish from './20261020_140712_map_polish';
import * as migration_20261021_043939_server_sites from './20261021_043939_server_sites';
import * as migration_20261023_030000_azania_nation from './20261023_030000_azania_nation';
import * as migration_20261023_063403_diplomacy from './20261023_063403_diplomacy';
import * as migration_20261028_054308_outposts from './20261028_054308_outposts';
import * as migration_20261028_134537_siege_alerts from './20261028_134537_siege_alerts';
import * as migration_20261028_141151_siege_sessions from './20261028_141151_siege_sessions';
import * as migration_20261028_143909_siege_sessions_utc from './20261028_143909_siege_sessions_utc';
import * as migration_20261028_235257_town_religion from './20261028_235257_town_religion';
import * as migration_20261029_102339_map_snapshot from './20261029_102339_map_snapshot';
import * as migration_20261029_123043_diplomacy_allies from './20261029_123043_diplomacy_allies';
import * as migration_20261029_155746_draft_links from './20261029_155746_draft_links';
import * as migration_20261029_232807_lists from './20261029_232807_lists';
import * as migration_20261030_090000_severe_sanction_list from './20261030_090000_severe_sanction_list';
import * as migration_20261031_231112_battles_presence from './20261031_231112_battles_presence';
import * as migration_20261101_051659_battles_respawns from './20261101_051659_battles_respawns';
import * as migration_20261101_113822_alliances from './20261101_113822_alliances';
import * as migration_20261101_131717_battles_analysis from './20261101_131717_battles_analysis';
import * as migration_20261102_090000_clayton_leaves_ia from './20261102_090000_clayton_leaves_ia';
import * as migration_20261102_100000_update_boxes from './20261102_100000_update_boxes';
import * as migration_20261104_135608_guest_role from './20261104_135608_guest_role';
import * as migration_20261104_142338_airmail_style from './20261104_142338_airmail_style';
import * as migration_20261104_142400_guest_column from './20261104_142400_guest_column';
import * as migration_20261104_150000_road_junctions from './20261104_150000_road_junctions';
import * as migration_20261104_233645_road_lanes from './20261104_233645_road_lanes';

export const migrations = [
  {
    up: migration_20260709_235205.up,
    down: migration_20260709_235205.down,
    name: '20260709_235205',
  },
  {
    up: migration_20260710_001958_username_auth.up,
    down: migration_20260710_001958_username_auth.down,
    name: '20260710_001958_username_auth',
  },
  {
    up: migration_20260710_223018_add_article_section.up,
    down: migration_20260710_223018_add_article_section.down,
    name: '20260710_223018_add_article_section',
  },
  {
    up: migration_20261017_160020_byline_profiles.up,
    down: migration_20261017_160020_byline_profiles.down,
    name: '20261017_160020_byline_profiles',
  },
  {
    up: migration_20261017_160850_ipaaat_byline_profiles.up,
    down: migration_20261017_160850_ipaaat_byline_profiles.down,
    name: '20261017_160850_ipaaat_byline_profiles',
  },
  {
    up: migration_20261018_062606_contexts.up,
    down: migration_20261018_062606_contexts.down,
    name: '20261018_062606_contexts',
  },
  {
    up: migration_20261018_113846_styles.up,
    down: migration_20261018_113846_styles.down,
    name: '20261018_113846_styles',
  },
  {
    up: migration_20261018_123000_girlietown.up,
    down: migration_20261018_123000_girlietown.down,
    name: '20261018_123000_girlietown',
  },
  {
    up: migration_20261018_131500_girlietown_samples.up,
    down: migration_20261018_131500_girlietown_samples.down,
    name: '20261018_131500_girlietown_samples',
  },
  {
    up: migration_20261018_155642_discord_announcements.up,
    down: migration_20261018_155642_discord_announcements.down,
    name: '20261018_155642_discord_announcements',
  },
  {
    up: migration_20261019_021903_discord_settings.up,
    down: migration_20261019_021903_discord_settings.down,
    name: '20261019_021903_discord_settings',
  },
  {
    up: migration_20261019_022500_luixtiter.up,
    down: migration_20261019_022500_luixtiter.down,
    name: '20261019_022500_luixtiter',
  },
  {
    up: migration_20261020_092846_azania_maps.up,
    down: migration_20261020_092846_azania_maps.down,
    name: '20261020_092846_azania_maps',
  },
  {
    up: migration_20261020_140712_map_polish.up,
    down: migration_20261020_140712_map_polish.down,
    name: '20261020_140712_map_polish',
  },
  {
    up: migration_20261021_043939_server_sites.up,
    down: migration_20261021_043939_server_sites.down,
    name: '20261021_043939_server_sites',
  },
  {
    up: migration_20261023_030000_azania_nation.up,
    down: migration_20261023_030000_azania_nation.down,
    name: '20261023_030000_azania_nation',
  },
  {
    up: migration_20261023_063403_diplomacy.up,
    down: migration_20261023_063403_diplomacy.down,
    name: '20261023_063403_diplomacy',
  },
  {
    up: migration_20261028_054308_outposts.up,
    down: migration_20261028_054308_outposts.down,
    name: '20261028_054308_outposts',
  },
  {
    up: migration_20261028_134537_siege_alerts.up,
    down: migration_20261028_134537_siege_alerts.down,
    name: '20261028_134537_siege_alerts',
  },
  {
    up: migration_20261028_141151_siege_sessions.up,
    down: migration_20261028_141151_siege_sessions.down,
    name: '20261028_141151_siege_sessions',
  },
  {
    up: migration_20261028_143909_siege_sessions_utc.up,
    down: migration_20261028_143909_siege_sessions_utc.down,
    name: '20261028_143909_siege_sessions_utc',
  },
  {
    up: migration_20261028_235257_town_religion.up,
    down: migration_20261028_235257_town_religion.down,
    name: '20261028_235257_town_religion',
  },
  {
    up: migration_20261029_102339_map_snapshot.up,
    down: migration_20261029_102339_map_snapshot.down,
    name: '20261029_102339_map_snapshot',
  },
  {
    up: migration_20261029_123043_diplomacy_allies.up,
    down: migration_20261029_123043_diplomacy_allies.down,
    name: '20261029_123043_diplomacy_allies',
  },
  {
    up: migration_20261029_155746_draft_links.up,
    down: migration_20261029_155746_draft_links.down,
    name: '20261029_155746_draft_links',
  },
  {
    up: migration_20261029_232807_lists.up,
    down: migration_20261029_232807_lists.down,
    name: '20261029_232807_lists',
  },
  {
    up: migration_20261030_090000_severe_sanction_list.up,
    down: migration_20261030_090000_severe_sanction_list.down,
    name: '20261030_090000_severe_sanction_list',
  },
  {
    up: migration_20261031_231112_battles_presence.up,
    down: migration_20261031_231112_battles_presence.down,
    name: '20261031_231112_battles_presence',
  },
  {
    up: migration_20261101_051659_battles_respawns.up,
    down: migration_20261101_051659_battles_respawns.down,
    name: '20261101_051659_battles_respawns',
  },
  {
    up: migration_20261101_113822_alliances.up,
    down: migration_20261101_113822_alliances.down,
    name: '20261101_113822_alliances',
  },
  {
    up: migration_20261101_131717_battles_analysis.up,
    down: migration_20261101_131717_battles_analysis.down,
    name: '20261101_131717_battles_analysis',
  },
  {
    up: migration_20261102_090000_clayton_leaves_ia.up,
    down: migration_20261102_090000_clayton_leaves_ia.down,
    name: '20261102_090000_clayton_leaves_ia',
  },
  {
    up: migration_20261102_100000_update_boxes.up,
    down: migration_20261102_100000_update_boxes.down,
    name: '20261102_100000_update_boxes',
  },
  {
    up: migration_20261104_135608_guest_role.up,
    down: migration_20261104_135608_guest_role.down,
    name: '20261104_135608_guest_role',
  },
  {
    up: migration_20261104_142338_airmail_style.up,
    down: migration_20261104_142338_airmail_style.down,
    name: '20261104_142338_airmail_style',
  },
  {
    up: migration_20261104_142400_guest_column.up,
    down: migration_20261104_142400_guest_column.down,
    name: '20261104_142400_guest_column',
  },
  {
    up: migration_20261104_150000_road_junctions.up,
    down: migration_20261104_150000_road_junctions.down,
    name: '20261104_150000_road_junctions',
  },
  {
    up: migration_20261104_233645_road_lanes.up,
    down: migration_20261104_233645_road_lanes.down,
    name: '20261104_233645_road_lanes'
  },
];
