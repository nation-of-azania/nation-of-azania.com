import * as migration_20260709_235205 from './20260709_235205';
import * as migration_20260710_001958_username_auth from './20260710_001958_username_auth';
import * as migration_20260710_223018_add_article_section from './20260710_223018_add_article_section';
import * as migration_20261017_160020_byline_profiles from './20261017_160020_byline_profiles';
import * as migration_20261017_160850_ipaaat_byline_profiles from './20261017_160850_ipaaat_byline_profiles';
import * as migration_20261018_062606_contexts from './20261018_062606_contexts';
import * as migration_20261018_113846_styles from './20261018_113846_styles';
import * as migration_20261018_123000_girlietown from './20261018_123000_girlietown';
import * as migration_20261018_131500_girlietown_samples from './20261018_131500_girlietown_samples';

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
];
