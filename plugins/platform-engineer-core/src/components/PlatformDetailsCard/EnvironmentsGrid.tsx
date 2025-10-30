import React from 'react';
import { Box } from '@material-ui/core';
import { EnvironmentCard } from './EnvironmentCard';
import { useStyles } from './styles';

interface Environment {
  organization: string;
  name: string;
  displayName?: string;
  isProduction: boolean;
  dnsPrefix: string;
  componentCount?: number;
  status: string;
}

interface EnvironmentsGridProps {
  environments: Environment[];
}

export const EnvironmentsGrid: React.FC<EnvironmentsGridProps> = ({
  environments,
}) => {
  const classes = useStyles();

  return (
    <Box className={classes.environmentGrid}>
      {environments
        .sort((a, b) => {
          // Sort non-production first, then production
          if (a.isProduction === b.isProduction) return 0;
          return a.isProduction ? 1 : -1;
        })
        .map(environment => (
          <EnvironmentCard
            key={`${environment.organization}-${environment.name}`}
            environment={environment}
          />
        ))}
    </Box>
  );
};
