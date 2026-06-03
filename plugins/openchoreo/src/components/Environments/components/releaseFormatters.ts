import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';

/** Map from releaseName → list of environment names where it is currently bound. */
export type ReleaseDeployments = Record<string, string[]>;

export const formatRelativeTime = (iso?: string): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
};

export const extractImage = (release: ComponentRelease): string | undefined => {
  const workload = release.spec?.workload as
    | { container?: { image?: string } }
    | undefined;
  return workload?.container?.image;
};

export const shortenImage = (image: string): string => {
  const lastSlash = image.lastIndexOf('/');
  return lastSlash >= 0 ? image.slice(lastSlash + 1) : image;
};
