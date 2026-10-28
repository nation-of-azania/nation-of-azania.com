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
    name: '20261028_141151_siege_sessions'
  },
];
