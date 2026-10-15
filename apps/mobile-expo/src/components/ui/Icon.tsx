import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { colors } from '@/theme';

/**
 * The web dashboard draws icons as inline 24x24 stroke SVGs
 * (apps/web-dashboard/src/components/common/Icons.tsx) - that set is Feather,
 * so we reuse the identical glyph family via @expo/vector-icons instead of
 * hand-porting 37 SVG path trees. Feather ships in Expo Go, so this adds no
 * bundle cost on device.
 *
 * Consumers use the SAME camelCase names as the web, so page code ports over
 * with a 1:1 <Icon name="checkCircle" /> in both places.
 */
export type IconName =
  | 'dashboard'
  | 'users'
  | 'heart'
  | 'fileText'
  | 'alert'
  | 'barChart'
  | 'box'
  | 'settings'
  | 'shield'
  | 'key'
  | 'server'
  | 'bell'
  | 'menu'
  | 'chevronDown'
  | 'chevronUp'
  | 'chevronLeft'
  | 'chevronRight'
  | 'logOut'
  | 'plus'
  | 'download'
  | 'refresh'
  | 'x'
  | 'check'
  | 'search'
  | 'filter'
  | 'calendar'
  | 'mapPin'
  | 'phone'
  | 'activity'
  | 'checkCircle'
  | 'upload'
  | 'more'
  | 'edit'
  | 'trash'
  | 'globe'
  | 'eye'
  | 'eyeOff'
  | 'save'
  /**
   * Error-screen glyphs. The web draws these as inline SVGs inside
   * packages/design-system/react/src/components/ErrorScreens.tsx rather than
   * through the shared Icon set, so they have no web-side IconName equivalent.
   */
  | 'wifiOff'
  | 'lock'
  | 'alertCircle'
  | 'tool'
  | 'arrowLeft'
  | 'inbox'
  | 'info';

const FEATHER: Record<IconName, ComponentProps<typeof Feather>['name']> = {
  dashboard: 'grid',
  users: 'users',
  heart: 'heart',
  fileText: 'file-text',
  alert: 'alert-triangle',
  barChart: 'bar-chart-2',
  box: 'box',
  settings: 'settings',
  shield: 'shield',
  key: 'key',
  server: 'server',
  bell: 'bell',
  menu: 'menu',
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  chevronLeft: 'chevron-left',
  chevronRight: 'chevron-right',
  logOut: 'log-out',
  plus: 'plus',
  download: 'download',
  refresh: 'refresh-cw',
  x: 'x',
  check: 'check',
  search: 'search',
  filter: 'filter',
  calendar: 'calendar',
  mapPin: 'map-pin',
  phone: 'phone',
  activity: 'activity',
  checkCircle: 'check-circle',
  upload: 'upload',
  more: 'more-horizontal',
  edit: 'edit-2',
  trash: 'trash-2',
  globe: 'globe',
  eye: 'eye',
  eyeOff: 'eye-off',
  save: 'save',
  wifiOff: 'wifi-off',
  lock: 'lock',
  alertCircle: 'alert-circle',
  tool: 'tool',
  arrowLeft: 'arrow-left',
  inbox: 'inbox',
  info: 'info',
};

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 20, color = colors.onSurfaceVariant }: IconProps) {
  return <Feather name={FEATHER[name]} size={size} color={color} />;
}
