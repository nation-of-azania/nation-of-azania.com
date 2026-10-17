import * as migration_20260709_235205 from './20260709_235205';
import * as migration_20260710_001958_username_auth from './20260710_001958_username_auth';
import * as migration_20260710_223018_add_article_section from './20260710_223018_add_article_section';
import * as migration_20261017_160020_byline_profiles from './20261017_160020_byline_profiles';
import * as migration_20261017_160850_ipaaat_byline_profiles from './20261017_160850_ipaaat_byline_profiles';

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
    name: '20261017_160850_ipaaat_byline_profiles'
  },
];
