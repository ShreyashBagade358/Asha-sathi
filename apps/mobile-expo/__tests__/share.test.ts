import { Share } from 'react-native';

import { shareText } from '@/utils/share';

describe('shareText', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hands the rendered payload to the OS share sheet', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

    await expect(shareText('My Family', 'Rahul\nSunita')).resolves.toBe(true);

    expect(share).toHaveBeenCalledWith(
      { message: 'Rahul\nSunita', title: 'My Family' },
      { dialogTitle: 'My Family' },
    );
  });

  it('reports nothing shared when the sheet is dismissed', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' });

    await expect(shareText('My Family', 'Rahul')).resolves.toBe(false);
  });

  it('swallows a platform failure instead of rejecting', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('share unavailable'));

    await expect(shareText('My Family', 'Rahul')).resolves.toBe(false);
  });
});
