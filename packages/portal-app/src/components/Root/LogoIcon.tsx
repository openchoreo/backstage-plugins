import { OpenChoreoIcon } from '@openchoreo/backstage-design-system';
import { useBranding } from '../../branding';

const LogoIcon = () => {
  const branding = useBranding();

  if (branding.iconLogo) {
    return (
      <img
        src={branding.iconLogo}
        alt=""
        style={{ height: 24, flexShrink: 0 }}
      />
    );
  }

  return <OpenChoreoIcon />;
};

export default LogoIcon;
